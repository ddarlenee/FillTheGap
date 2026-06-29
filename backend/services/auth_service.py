import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from config import settings
from services.supabase_client import get_supabase

ALGORITHM = "HS256"


def _get_user_id(email: str) -> str | None:
    res = get_supabase().table("user_profiles").select("id").eq("email", email).execute()
    return res.data[0]["id"] if res.data else None


def register_user(email: str, password: str, name: str) -> dict:
    sb = get_supabase()
    try:
        auth_resp = sb.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })
    except Exception as e:
        raise ValueError("Email already registered") from e
    user_id = auth_resp.user.id
    sb.table("user_profiles").insert({"id": user_id, "email": email, "name": name}).execute()
    return {"id": user_id, "email": email, "name": name}


def login_user(email: str, password: str) -> dict:
    sb = get_supabase()
    try:
        auth_resp = sb.auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        raise ValueError("Invalid email or password")
    user_id = auth_resp.user.id
    profile = sb.table("user_profiles").select("name").eq("id", user_id).execute()
    name = profile.data[0]["name"] if profile.data else email
    return {"id": user_id, "email": email, "name": name}


def create_token(user: dict) -> str:
    payload = {
        "sub": user["email"],
        "name": user["name"],
        "id": user["id"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        raise ValueError("Invalid or expired token")


def save_analysis(
    email: str,
    role: str,
    coverage: dict,
    gaps: list,
    next_steps: list | None = None,
    user_skills: list | None = None,
    transferability_score: int | None = None,
):
    user_id = _get_user_id(email)
    if not user_id:
        return

    structured_gaps = []
    for g in gaps:
        if isinstance(g, dict):
            structured_gaps.append({"skill": g.get("skill", ""), "tier": g.get("tier", "Important")})
        else:
            structured_gaps.append({"skill": str(g), "tier": "Important"})

    structured_steps = []
    for s in (next_steps or []):
        if hasattr(s, "model_dump"):
            s = s.model_dump()
        if isinstance(s, dict):
            structured_steps.append({
                "summary": s.get("summary", ""),
                "text": s.get("text", ""),
                "skill": s.get("skill", ""),
                "tier": s.get("tier", "Important"),
                "completed": bool(s.get("completed", False)),
            })
        else:
            structured_steps.append({"summary": "", "text": str(s), "skill": "", "tier": "Important", "completed": False})

    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "role": role,
        "coverage": coverage,
        "gaps": structured_gaps,
        "next_steps": structured_steps,
        "user_skills": user_skills or [],
    }
    if transferability_score is not None:
        row["transferability_score"] = transferability_score

    get_supabase().table("analysis_history").insert(row).execute()


def get_history(email: str) -> list:
    user_id = _get_user_id(email)
    if not user_id:
        return []
    res = get_supabase().table("analysis_history").select("*").eq("user_id", user_id).order("created_at").execute()
    return res.data or []


def complete_step(email: str, entry_id: str, step_index: int) -> dict | None:
    user_id = _get_user_id(email)
    if not user_id:
        return None
    sb = get_supabase()
    res = sb.table("analysis_history").select("*").eq("id", entry_id).eq("user_id", user_id).execute()
    if not res.data:
        return None

    entry = res.data[0]
    steps = entry.get("next_steps", [])
    if step_index < 0 or step_index >= len(steps):
        return None

    step = steps[step_index]
    if not isinstance(step, dict):
        step = {"text": str(step), "skill": "", "completed": False}
        steps[step_index] = step

    was_completed = bool(step.get("completed", False))
    step["completed"] = not was_completed
    skill = step.get("skill", "")

    if skill:
        user_skills = entry.get("user_skills", [])
        gaps = entry.get("gaps", [])
        if not was_completed:
            if skill not in user_skills:
                user_skills.append(skill)
                entry["user_skills"] = user_skills
            gap_tier = None
            new_gaps = []
            for g in gaps:
                if isinstance(g, dict):
                    if g.get("skill") == skill:
                        gap_tier = g.get("tier", "Important")
                    else:
                        new_gaps.append(g)
                else:
                    if str(g) != skill:
                        new_gaps.append(g)
                    else:
                        gap_tier = "Important"
            entry["gaps"] = new_gaps
            if gap_tier:
                _adjust_coverage(entry, gap_tier, delta=+1)
        else:
            if skill in user_skills:
                user_skills.remove(skill)
                entry["user_skills"] = user_skills
            gap_tier = step.get("tier", "Important")
            gaps.append({"skill": skill, "tier": gap_tier})
            entry["gaps"] = gaps
            _adjust_coverage(entry, gap_tier, delta=-1)

    sb.table("analysis_history").update({
        "next_steps": steps,
        "gaps": entry["gaps"],
        "user_skills": entry["user_skills"],
        "coverage": entry["coverage"],
    }).eq("id", entry_id).execute()
    return entry


def _adjust_coverage(entry: dict, tier: str, delta: int):
    tier_key = {"Essential": "essential", "Important": "important", "Nice-to-have": "nice_to_have"}.get(tier)
    if not tier_key:
        return
    cov = entry.get("coverage", {})
    raw = str(cov.get(tier_key, "0/0"))
    parts = raw.split("/")
    if len(parts) != 2:
        return
    try:
        have, total = int(parts[0]), int(parts[1])
        entry["coverage"][tier_key] = f"{max(0, min(have + delta, total))}/{total}"
    except ValueError:
        pass
