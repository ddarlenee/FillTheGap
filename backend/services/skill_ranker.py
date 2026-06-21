import json
from openai import OpenAI
from config import settings
from models.schemas import TieredSkill
from services.interaction_logger import log_interaction

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a career specialist with expertise in Singapore's job market.
Given a job role and its list of skills, rank each skill into exactly one tier:
- Essential: must-have for day-one performance
- Important: significantly boosts effectiveness
- Nice-to-have: helpful but not critical

Return ONLY valid JSON:
{"tiered_skills": [{"name": "...", "tier": "Essential|Important|Nice-to-have", "reasoning": "..."}]}
Include ALL provided skills in your response."""

def rank_skills(role: str, skills: list[str], session_id: str) -> list[TieredSkill]:
    prompt = f"Role: {role}\nSkills to rank:\n" + "\n".join(f"- {s}" for s in skills)
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
    return [TieredSkill(**s) for s in data["tiered_skills"]]
