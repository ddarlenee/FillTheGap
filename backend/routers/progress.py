import json
from fastapi import APIRouter, HTTPException, Header
from models.schemas import ProgressRequest, ProgressResponse
from services.career_ladder import build_career_ladder
from services.session_store import load_session, save_session
from services.auth_service import decode_token

router = APIRouter()

@router.post("/progress", response_model=ProgressResponse)
def get_progress(request: ProgressRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    email = decode_token(authorization.removeprefix("Bearer "))
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    try:
        result = build_career_ladder(request, email)
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
