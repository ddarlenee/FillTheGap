from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
from services.auth_service import register_user, login_user, create_token, decode_token, get_history, complete_step, save_analysis, is_role_ready
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
    source_entry_id: Optional[str] = None


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

    history = get_history(email)
    if not history:
        raise HTTPException(status_code=400, detail="Complete an initial analysis before starting a career stage.")

    # The user's true current stage is always the LATEST history entry — never
    # trust a cached ladder for this. A ladder cached in the session (from the
    # last /api/progress call) can go stale relative to actual history: e.g. the
    # Career Path nav link used to restore whatever ladder was last computed,
    # which could predate a later advance and still show an old "immediate next"
    # tied to an already-completed (thus already-ready) entry — letting a user
    # skip past their real, incomplete current stage undetected.
    latest_entry = history[-1]
    current_role = latest_entry.get("role")

    session = load_session(email) or {}
    progress = session.get("progress") or {}
    immediate_next = progress.get("immediate_next")
    # Require the cached ladder to have been computed for the ACTUAL current
    # stage (not a stale one) and to actually offer req.role as next — prevents
    # skipping ahead to a distant career stage via an out-of-date ladder.
    if not immediate_next or progress.get("current_role") != current_role or immediate_next.get("role") != req.role:
        raise HTTPException(
            status_code=403,
            detail="Your career path is out of date. Please refresh your career path before advancing.",
        )

    # A career-stage entry for this role already exists (e.g. the user revisited
    # the career path via the nav link and clicked "Start now" again) — refuse the
    # duplicate rather than creating a second in-progress entry for the same stage.
    already_started = any(
        e.get("role") == req.role and e.get("transferability_score") is not None
        for e in history
    )
    if already_started:
        raise HTTPException(
            status_code=409,
            detail="You've already started this career stage.",
        )

    # The user must have actually closed all essential and important skill gaps
    # in their CURRENT (latest) role before advancing — enforced here (not just
    # hidden in the UI) so it can't be bypassed via the Career Path nav link or
    # a direct API call. is_role_ready() checks the coverage counters, which
    # complete_step() keeps in sync with which next_steps have been ticked off.
    if not is_role_ready(latest_entry):
        raise HTTPException(
            status_code=403,
            detail="Close all essential and important skill gaps in your current role before advancing.",
        )

    n = len(req.skill_delta)
    # coverage is synthetic: "0/N" important so the checklist drives progress.
    # The readiness bar uses transferability_score as the fixed base (not this coverage).
    # source_entry_id links back to the history entry the user advanced from, so the
    # UI can hide that entry's "start next stage" prompt once it's been acted on.
    coverage = {"essential": "0/0", "important": f"0/{n}", "nice_to_have": "0/0", "source_entry_id": req.source_entry_id}

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
