import json
from openai import OpenAI
from config import settings
from models.schemas import ExtractedSkill, TieredSkill, GapItem, CoverageScore
from services.interaction_logger import log_interaction

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a skills matching specialist.
Given a user's skills and a role's required skills, determine which required skills the user already has — including semantic and partial matches (e.g. "SQL" counts toward "Data Collection and Analysis", "Python scripting" counts toward "Python").

Return ONLY valid JSON:
{
  "matches": [
    {"role_skill": "exact role skill name", "matched_by": ["user skill name"]}
  ],
  "unmatched": ["exact role skill name", ...]
}

Every role skill must appear in either matches or unmatched. Never omit any."""

STRICT_SYSTEM_PROMPT = """You are a skills matching specialist.
Given a user's skills and a role's required skills, determine which required skills the user already possesses.

STRICT RULES — only match if the skills are identical or very close variants:
✓  "Python" matches "Python Programming" or "Python Scripting"
✓  "SQL" matches "MySQL", "SQL Querying", "SQL Database Management"
✗  "SQL" does NOT match "Data Collection and Analysis"
✗  "Data Analysis" does NOT match "Machine Learning" or "Statistical Modelling"
✗  "Excel" does NOT match "Financial Modelling" unless explicitly stated
✗  "Data Visualisation" does NOT match "Leadership" or "Stakeholder Management"

If in doubt, mark the skill as UNMATCHED. Be conservative — missing a true match is acceptable; a false match inflates the score unfairly.

Return ONLY valid JSON:
{
  "matches": [
    {"role_skill": "exact role skill name", "matched_by": ["user skill name"]}
  ],
  "unmatched": ["exact role skill name", ...]
}

Every role skill must appear in exactly one of matches or unmatched. Never omit any."""


def analyse_gaps(
    user_skills: list[ExtractedSkill],
    tiered_role_skills: list[TieredSkill],
    session_id: str,
    strict: bool = False,
) -> tuple[list[GapItem], CoverageScore, dict[str, list[str]]]:
    user_skill_names = [s.name for s in user_skills]
    role_skill_names = [ts.name for ts in tiered_role_skills]

    prompt = (
        "User's skills:\n" + "\n".join(f"- {s}" for s in user_skill_names) +
        "\n\nRole's required skills:\n" + "\n".join(f"- {s}" for s in role_skill_names)
    )
    system_prompt = STRICT_SYSTEM_PROMPT if strict else SYSTEM_PROMPT
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "gap_analysis", prompt, content)
    data = json.loads(content)

    # Build lookup: role_skill -> matched_by list
    matches_map: dict[str, list[str]] = {}
    for m in data.get("matches", []):
        matches_map[m["role_skill"]] = m.get("matched_by", [])

    unmatched_set = {s.lower() for s in data.get("unmatched", [])}

    tier_order = {"Essential": 0, "Important": 1, "Nice-to-have": 2}
    counts = {"Essential": [0, 0], "Important": [0, 0], "Nice-to-have": [0, 0]}
    gaps: list[GapItem] = []

    for ts in tiered_role_skills:
        tier = ts.tier
        if tier not in counts:
            tier = "Nice-to-have"
        counts[tier][1] += 1
        if ts.name in matches_map:
            counts[tier][0] += 1
        else:
            gaps.append(GapItem(skill=ts.name, tier=tier, action=""))

    gaps.sort(key=lambda g: tier_order.get(g.tier, 3))

    coverage = CoverageScore(
        essential=f"{counts['Essential'][0]}/{counts['Essential'][1]}",
        important=f"{counts['Important'][0]}/{counts['Important'][1]}",
        nice_to_have=f"{counts['Nice-to-have'][0]}/{counts['Nice-to-have'][1]}",
    )
    return gaps, coverage, matches_map
