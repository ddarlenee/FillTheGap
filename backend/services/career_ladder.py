import json
from openai import OpenAI
from config import settings
from models.schemas import ProgressRequest, ProgressResponse, CareerRung, Milestone
from services.interaction_logger import log_interaction
from data.skillsfuture_loader import skillsfuture

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a career progression specialist with deep knowledge of Singapore's job market and SkillsFuture frameworks.
Given a current role and the user's skills, infer a realistic vertical career progression ladder (2–4 future roles above the current one).

For each future role provide:
- role: exact role title
- transferability_score: 0–100 (how much of user's current skills transfer)
- skill_delta: list of new skills needed that the user doesn't currently have
- why_good_fit: one sentence explaining transferability from user's background
- milestones: 2–4 concrete, specific steps to reach THIS role from the previous rung (empty list for distant future roles)

Also identify the long_term_destination: the most senior role this path leads toward.

Return ONLY valid JSON:
{
  "long_term_destination": "...",
  "ladder": [
    {"role": "...", "transferability_score": 0, "skill_delta": [], "why_good_fit": "...", "milestones": [{"description": "...", "skill_focus": "..."}]}
  ]
}
Order ladder from closest to most distant future role."""

def build_career_ladder(request: ProgressRequest, session_id: str) -> ProgressResponse:
    role_skills = skillsfuture.get_skills_for_role(request.current_role)
    skills_context = ", ".join(role_skills[:15]) if role_skills else "not available"
    user_skills_str = ", ".join(request.user_skill_names[:20])

    prompt = (
        f"Current role: {request.current_role}\n"
        f"User's skills: {user_skills_str}\n"
        f"SkillsFuture skills for this role: {skills_context}"
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "career_ladder", prompt, content)
    data = json.loads(content)

    ladder = [
        CareerRung(
            role=r["role"],
            transferability_score=r["transferability_score"],
            skill_delta=r["skill_delta"],
            why_good_fit=r["why_good_fit"],
            milestones=[Milestone(**m) for m in r.get("milestones", [])],
        )
        for r in data["ladder"]
    ]

    return ProgressResponse(
        current_role=request.current_role,
        immediate_next=ladder[0],
        full_ladder=ladder[1:],
        long_term_destination=data["long_term_destination"],
    )
