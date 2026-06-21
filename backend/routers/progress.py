import json
from fastapi import APIRouter, HTTPException
from models.schemas import ProgressRequest, ProgressResponse
from services.career_ladder import build_career_ladder
from services.session_store import load_session, save_session

router = APIRouter()

@router.post("/progress", response_model=ProgressResponse)
def get_progress(request: ProgressRequest):
    try:
        result = build_career_ladder(request, request.session_id)
        existing = load_session(request.session_id) or {}
        existing["progress"] = result.model_dump()
        save_session(request.session_id, existing)
        return result
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI response parse error: {e}")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
