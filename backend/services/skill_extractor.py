import json
from openai import OpenAI
from config import settings
from models.schemas import ExtractedSkill
from services.interaction_logger import log_interaction

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a skills analyst. Given a resume, extract every professional skill mentioned.
For each skill, provide:
- name: concise skill name (e.g. "Python", "Stakeholder Management")
- evidence: the exact resume text or paraphrase that proves this skill, with context
- confidence: "High" if clearly demonstrated, "Medium" if implied, "Low" if tangential

Return ONLY valid JSON in this exact format:
{"skills": [{"name": "...", "evidence": "...", "confidence": "High|Medium|Low"}]}"""

def extract_skills(resume_text: str, session_id: str) -> list[ExtractedSkill]:
    prompt = f"Resume:\n{resume_text}"
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "skill_extraction", prompt, content)
    data = json.loads(content)
    return [ExtractedSkill(**s) for s in data["skills"]]
