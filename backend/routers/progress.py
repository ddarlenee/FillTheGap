import json
from fastapi import APIRouter, HTTPException, Header
from models.schemas import ProgressRequest, ProgressResponse
from services.career_ladder import build_career_ladder
from services.session_store import load_session, save_session
from services.auth_service import decode_token, get_history, is_role_ready

router = APIRouter()

@router.post("/progress", response_model=ProgressResponse)
def get_progress(request: ProgressRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        payload = decode_token(authorization.removeprefix("Bearer "))
        email = payload["sub"]
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    try:
        result = build_career_ladder(request, email)

        # "Ready to advance" mirrors the true source of truth used by
        # /api/auth/history/career-stage: the LATEST history entry, not just
        # whichever role the frontend claims is current. This lets the UI
        # disable "Start now" up front instead of only finding out on submit.
        history = get_history(email)
        latest_entry = history[-1] if history else None
        current_role_ready = bool(
            latest_entry
            and latest_entry.get("role") == request.current_role
            and is_role_ready(latest_entry)
        )
        result = result.model_copy(update={"current_role_ready": current_role_ready})

        existing = load_session(email) or {}
        existing["progress"] = result.model_dump()
        save_session(email, existing)
        return result
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI response parse error: {e}")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
