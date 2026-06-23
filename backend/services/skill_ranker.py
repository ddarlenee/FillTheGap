import json
from openai import OpenAI
from config import settings
from models.schemas import TieredSkill
from services.interaction_logger import log_interaction
from data.skillsfuture_loader import _level_to_int

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a talent specialist who knows what major employers — MNCs, big tech, banks, consulting firms, and leading Singapore companies — actually require for each role.

Given a job role and its SkillsFuture-grounded skills, assign each skill to exactly one tier:

Essential   — Must-have on Day 1. Hiring managers reject candidates lacking these.
              These are the core execution skills for the role (e.g. for a Data Analyst:
              data analysis, data modelling, programming; for a Software Engineer:
              software design, applications development, software testing).

Important   — Strong differentiators listed as "preferred" in job postings.
              The role can start without them but they unlock real impact quickly.

Nice-to-have — Helpful but learnable on the job. Supporting or adjacent competencies
              that matter more at senior levels (e.g. stakeholder management, project
              management, sustainability topics at junior levels).

Use the proficiency level as your primary signal — a skill required at level 4-6 carries more weight than the same skill at level 1-2 for this role. Within the same proficiency level, prioritise skills that are most directly tied to the role's core output.

STRICT RULES:
1. Every skill in the input MUST appear in your response exactly once, with the exact same name.
2. All three tiers MUST have at least one skill.
3. Target roughly: Essential 25-35%, Important 40-55%, Nice-to-have 15-25%.
4. Do not invent skills not in the input list.

Return ONLY valid JSON:
{"tiered_skills": [{"name": "...", "tier": "Essential|Important|Nice-to-have", "reasoning": "..."}]}"""


def _data_driven_tiers(
    skills_with_proficiency: list[tuple[str, str | None]],
) -> dict[str, str]:
    """
    Pure data-driven first-pass tier assignment based on proficiency levels.
    Returns a dict of skill_name -> suggested_tier.
    Skills with no proficiency level get None (LLM must decide).
    """
    levels = [(name, _level_to_int(lv) if lv else None) for name, lv in skills_with_proficiency]
    known = [v for _, v in levels if v is not None and v > 0]
    if not known:
        return {}

    max_lv = max(known)
    min_lv = min(known)
    span = max_lv - min_lv

    suggestions: dict[str, str] = {}
    for name, lv in levels:
        if lv is None or lv == 0:
            continue
        if span == 0:
            # All skills at the same level — no signal, leave to LLM
            continue
        # Relative position within range: 1.0 = top, 0.0 = bottom
        rel = (lv - min_lv) / span
        if rel >= 0.66:
            suggestions[name] = "Essential"
        elif rel >= 0.33:
            suggestions[name] = "Important"
        else:
            suggestions[name] = "Nice-to-have"

    return suggestions


def rank_skills(
    role: str,
    skills_with_proficiency: list[tuple[str, str | None]],
    session_id: str,
) -> list[TieredSkill]:
    if not skills_with_proficiency:
        return []

    # First pass: data-driven suggestions from proficiency levels
    suggestions = _data_driven_tiers(skills_with_proficiency)

    # Build prompt — include proficiency level AND the data-driven suggestion where we have one
    skill_lines = []
    for name, level in skills_with_proficiency:
        parts = [f"- {name}"]
        if level:
            parts.append(f"(SkillsFuture Proficiency Level: {level})")
        if name in suggestions:
            parts.append(f"[suggested: {suggestions[name]}]")
        skill_lines.append(" ".join(parts))

    prompt = f"Role: {role}\nSkills to classify:\n" + "\n".join(skill_lines)
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "skill_ranking", prompt, content)
    data = json.loads(content)
    result = [TieredSkill(**s) for s in data["tiered_skills"]]

    # --- Verification: ensure every input skill is present in the output ---
    input_names = {name for name, _ in skills_with_proficiency}
    output_names = {s.name for s in result}
    for name, level in skills_with_proficiency:
        if name not in output_names:
            # Assign using data-driven suggestion, falling back to Nice-to-have
            fallback_tier = suggestions.get(name, "Nice-to-have")
            result.append(TieredSkill(
                name=name,
                tier=fallback_tier,
                reasoning="Assigned from SkillsFuture proficiency data.",
            ))

    # --- Guarantee every tier has at least one skill ---
    all_tiers = ["Essential", "Important", "Nice-to-have"]
    tier_map: dict[str, list[TieredSkill]] = {t: [] for t in all_tiers}
    for s in result:
        if s.tier in tier_map:
            tier_map[s.tier].append(s)

    for missing_tier in all_tiers:
        if not tier_map[missing_tier] and result:
            # Donate from the most-populated tier
            donor = max(all_tiers, key=lambda t: len(tier_map[t]))
            moved = tier_map[donor].pop()
            replacement = TieredSkill(
                name=moved.name,
                tier=missing_tier,
                reasoning=moved.reasoning,
            )
            result = [replacement if s.name == moved.name else s for s in result]
            tier_map[missing_tier].append(replacement)

    # --- Rebalance if one tier dominates (>80% of skills) ---
    total = len(result)
    if total >= 6:
        for over_tier in all_tiers:
            if len(tier_map[over_tier]) / total > 0.80:
                # Move skills to the emptiest tier until each tier has at least 15% of total
                target_min = max(1, round(total * 0.15))
                for under_tier in all_tiers:
                    if under_tier == over_tier:
                        continue
                    while len(tier_map[under_tier]) < target_min and tier_map[over_tier]:
                        moved = tier_map[over_tier].pop()
                        replacement = TieredSkill(
                            name=moved.name,
                            tier=under_tier,
                            reasoning=moved.reasoning,
                        )
                        result = [replacement if s.name == moved.name else s for s in result]
                        tier_map[under_tier].append(replacement)

    return result
