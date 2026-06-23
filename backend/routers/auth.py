from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
from services.auth_service import register_user, login_user, create_token, decode_token, get_history, complete_step, save_analysis
from services.session_store import load_session

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str


class AuthResponse(BaseModel):
    access_token: str
    user: UserOut


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    try:
        user = register_user(req.email, req.password, req.name)
        token = create_token(user)
        return AuthResponse(access_token=token, user=UserOut(**user))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    try:
        user = login_user(req.email, req.password)
        token = create_token(user)
        return AuthResponse(access_token=token, user=UserOut(**user))
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/history")
def history(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token.")
    try:
        payload = decode_token(authorization.removeprefix("Bearer "))
        return {"history": get_history(payload["sub"])}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


class CompleteStepRequest(BaseModel):
    step_index: int


@router.post("/history/{entry_id}/complete-step")
def toggle_step(entry_id: str, req: CompleteStepRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token.")
    try:
        payload = decode_token(authorization.removeprefix("Bearer "))
        email = payload["sub"]
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    updated = complete_step(email, entry_id, req.step_index)
    if updated is None:
        raise HTTPException(status_code=404, detail="Entry or step not found.")
    return updated


class CareerNextStepIn(BaseModel):
    skill: str
    action: str
    summary: Optional[str] = ""


class SaveCareerStageRequest(BaseModel):
    role: str
    transferability_score: int
    skill_delta: list[str]
    next_steps: list[CareerNextStepIn]
    user_skills: list[str]


@router.post("/history/career-stage")
def save_career_stage(req: SaveCareerStageRequest, authorization: str = Header(...)):
    """
    Save a career-stage progression entry to history using career ladder data directly.
    Bypasses LLM gap analysis — transferability_score becomes the fixed readiness base,
    skill_delta becomes the gaps, and career next_steps become the history checklist.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token.")
    try:
        payload = decode_token(authorization.removeprefix("Bearer "))
        email = payload["sub"]
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    n = len(req.skill_delta)
    # coverage is synthetic: "0/N" important so the checklist drives progress.
    # The readiness bar uses transferability_score as the fixed base (not this coverage).
    coverage = {"essential": "0/0", "important": f"0/{n}", "nice_to_have": "0/0"}

    gaps = [{"skill": s, "tier": "Important"} for s in req.skill_delta]

    next_steps = [
        {
            "summary": s.summary or "",
            "text": s.action,
            "skill": s.skill,
            "tier": "Important",
            "completed": False,
        }
        for s in req.next_steps
    ]

    # Ensure every skill_delta skill has at least one step
    covered_skills = {s["skill"] for s in next_steps}
    for skill in req.skill_delta:
        if skill not in covered_skills:
            next_steps.append({
                "summary": f"Learn {skill}",
                "text": f"Build proficiency in {skill} through online courses or hands-on projects.",
                "skill": skill,
                "tier": "Important",
                "completed": False,
            })

    save_analysis(
        email,
        req.role,
        coverage,
        gaps,
        next_steps=next_steps,
        user_skills=req.user_skills,
        transferability_score=req.transferability_score,
    )
    return {"ok": True}


@router.get("/restore")
def restore_session(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token.")
    try:
        payload = decode_token(authorization.removeprefix("Bearer "))
        session = load_session(payload["sub"])
        return {"session": session or None}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
