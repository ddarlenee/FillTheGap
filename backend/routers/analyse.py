import json
from fastapi import APIRouter, HTTPException, Header
from openai import OpenAI
from config import settings
from models.schemas import AnalyseRequest, AnalyseResponse
from data.skillsfuture_loader import skillsfuture
from services.skill_extractor import extract_skills
from services.skill_ranker import rank_skills
from services.gap_analyser import analyse_gaps
from services.next_steps import generate_next_steps
from services.session_store import load_session, save_session
from services.interaction_logger import log_interaction
from services.auth_service import decode_token, save_analysis

router = APIRouter()
openai_client = OpenAI(api_key=settings.openai_api_key)

def _infer_top_roles(resume_text: str, user_key: str) -> list[str]:
    all_roles = skillsfuture.get_roles()
    roles_list = "\n".join(f"- {r}" for r in all_roles[:80])
    prompt = (
        f"Resume:\n{resume_text[:2000]}\n\n"
        f"Available roles:\n{roles_list}\n\n"
        'Return the 3 best-matching roles as JSON: {"roles": ["role1", "role2", "role3"]}'
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You match resumes to job roles. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(user_key, "role_inference", prompt, content)
    return json.loads(content).get("roles", all_roles[:3])

@router.post("/analyse", response_model=AnalyseResponse)
def analyse(request: AnalyseRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = decode_token(authorization.removeprefix("Bearer "))
        email = payload["sub"]
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    try:
        if request.target_role:
            target_roles = [request.target_role]
        else:
            target_roles = _infer_top_roles(request.resume_text, email)

        primary_role = target_roles[0]

        if request.user_skill_names is not None:
            # Skip extraction — caller already knows the skill list (e.g. career progression)
            from models.schemas import ExtractedSkill as _ES
            user_skills = [
                _ES(name=n, evidence="Prior learning and completed goals", confidence="High")
                for n in request.user_skill_names
            ]
        elif request.resume_text:
            user_skills = extract_skills(request.resume_text, email)
        else:
            raise HTTPException(status_code=400, detail="Provide resume_text or user_skill_names.")

        role_skill_names = skillsfuture.get_skills_for_role(primary_role)
        if not role_skill_names:
            role_skill_names = [s.name for s in user_skills[:10]]

        skills_with_proficiency = [
            (name, skillsfuture.get_proficiency(primary_role, name))
            for name in role_skill_names
        ]
        tiered_skills = rank_skills(primary_role, skills_with_proficiency, email)

        gaps, coverage, matches_map = analyse_gaps(user_skills, tiered_skills, email)

        tiered_skills = [
            ts.model_copy(update={"matched_by": matches_map.get(ts.name, [])})
            for ts in tiered_skills
        ]
        next_steps = generate_next_steps(primary_role, gaps, email)

        result = AnalyseResponse(
            target_roles=target_roles,
            user_skills=user_skills,
            tiered_role_skills=tiered_skills,
            coverage_score=coverage,
            gaps=gaps,
            next_steps=next_steps,
        )
        existing = load_session(email) or {}
        existing["analyse"] = result.model_dump()
        save_session(email, existing)

        try:
            save_analysis(
                email,
                primary_role,
                {"essential": coverage.essential, "important": coverage.important, "nice_to_have": coverage.nice_to_have},
                [{"skill": g.skill, "tier": g.tier} for g in gaps],
                next_steps=[s.model_dump() for s in result.next_steps],
                user_skills=[s.name for s in user_skills],
            )
        except Exception:
            pass

        return result
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI response parse error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
