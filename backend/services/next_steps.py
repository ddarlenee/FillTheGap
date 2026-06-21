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
Return ONLY valid JSON: {"next_steps": ["step 1", "step 2", ...]}"""

def generate_next_steps(role: str, gaps: list[GapItem], session_id: str) -> list[str]:
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
    return json.loads(content)["next_steps"]
