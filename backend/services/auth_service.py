import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError
from config import settings

ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

USERS_FILE = Path(__file__).parent.parent / "data" / "users.json"


def _load_users() -> dict:
    if not USERS_FILE.exists():
        USERS_FILE.parent.mkdir(exist_ok=True)
        return {}
    return json.loads(USERS_FILE.read_text())


def _save_users(users: dict):
    USERS_FILE.write_text(json.dumps(users, indent=2))


def register_user(email: str, password: str, name: str) -> dict:
    users = _load_users()
    if email in users:
        raise ValueError("Email already registered")
    user_id = str(uuid.uuid4())
    users[email] = {
        "id": user_id,
        "email": email,
        "name": name,
        "hashed_password": pwd_context.hash(password),
        "history": [],
    }
    _save_users(users)
    return {"id": user_id, "email": email, "name": name}


def login_user(email: str, password: str) -> dict:
    users = _load_users()
    user = users.get(email)
    if not user or not pwd_context.verify(password, user["hashed_password"]):
        raise ValueError("Invalid email or password")
    return {"id": user["id"], "email": email, "name": user["name"]}


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
):
    users = _load_users()
    if email not in users:
        return

    # Normalise gaps to [{skill, tier}] regardless of what came in
    structured_gaps = []
    for g in gaps:
        if isinstance(g, dict):
            structured_gaps.append({"skill": g.get("skill", ""), "tier": g.get("tier", "Important")})
        else:
            structured_gaps.append({"skill": str(g), "tier": "Important"})

    # Normalise next_steps to [{text, skill, completed}]
    structured_steps = []
    for s in (next_steps or []):
        if isinstance(s, dict):
            structured_steps.append({
                "text": s.get("text", ""),
                "skill": s.get("skill", ""),
                "completed": bool(s.get("completed", False)),
            })
        else:
            structured_steps.append({"text": str(s), "skill": "", "completed": False})

    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "role": role,
        "coverage": coverage,
        "gaps": structured_gaps,
        "next_steps": structured_steps,
        "user_skills": user_skills or [],
    }
    users[email]["history"].append(entry)
    _save_users(users)


def complete_step(email: str, entry_id: str, step_index: int) -> dict | None:
    """
    Mark a next-step as completed. If the step has a target skill:
    - add it to user_skills
    - remove it from gaps
    - increment the tier's coverage numerator
    Returns the updated history entry, or None if not found.
    """
    users = _load_users()
    user = users.get(email)
    if not user:
        return None

    for entry in user["history"]:
        if entry["id"] != entry_id:
            continue

        steps = entry.get("next_steps", [])
        if step_index < 0 or step_index >= len(steps):
            return None

        step = steps[step_index]

        # Normalise to dict in-place
        if not isinstance(step, dict):
            step = {"text": str(step), "skill": "", "completed": False}
            steps[step_index] = step

        # Toggle: check → uncheck or uncheck → check
        was_completed = bool(step.get("completed", False))
        step["completed"] = not was_completed
        skill = step.get("skill", "")

        if skill:
            user_skills: list = entry.get("user_skills", [])
            gaps: list = entry.get("gaps", [])

            if not was_completed:
                # Completing: add skill, remove from gaps, increment coverage
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
                # Uncompleting: remove skill, add back to gaps, decrement coverage
                if skill in user_skills:
                    user_skills.remove(skill)
                    entry["user_skills"] = user_skills

                # Find what tier this skill belongs to by scanning next_steps
                gap_tier = None
                # All steps for this skill share the same skill name; use any to find tier.
                # We don't store tier in step, so try to find it from the original gaps or
                # infer from other completed steps. Best we can do: use Important as fallback.
                gap_tier = "Important"
                # Re-add to gaps
                gaps.append({"skill": skill, "tier": gap_tier})
                entry["gaps"] = gaps

                _adjust_coverage(entry, gap_tier, delta=-1)

        _save_users(users)
        return entry

    return None


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


def get_history(email: str) -> list:
    users = _load_users()
    return users.get(email, {}).get("history", [])
