import json
from openai import OpenAI
from config import settings
from models.schemas import GapItem
from services.interaction_logger import log_interaction

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a career coach. Given a target role and a list of skill gaps,
generate 3–5 concrete, specific, actionable next steps to close those gaps.
Prioritise by gap tier (Essential > Important > Nice-to-have).
Each step should be specific enough to act on today (e.g. name a specific course, certification, or project).

For each step, also record which exact skill from the input gap list it addresses.

Return ONLY valid JSON:
{"next_steps": [{"text": "step description", "skill": "exact skill name from the gap list"}]}"""


def generate_next_steps(role: str, gaps: list[GapItem], session_id: str) -> list[dict]:
    """Return a list of {text, skill} dicts — one per recommended next step."""
    gap_summary = "\n".join(f"- {g.skill} ({g.tier})" for g in gaps[:8])
    prompt = f"Target role: {role}\nSkill gaps:\n{gap_summary}"
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "next_steps", prompt, content)
    steps = json.loads(content)["next_steps"]

    # Normalise: accept both {text, skill} objects and plain strings (backwards compat)
    result = []
    for s in steps:
        if isinstance(s, dict):
            result.append({"text": s.get("text", ""), "skill": s.get("skill", "")})
        else:
            result.append({"text": str(s), "skill": ""})
    return result
