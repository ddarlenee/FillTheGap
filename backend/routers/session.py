from fastapi import APIRouter, HTTPException
from services.session_store import load_session

router = APIRouter()

@router.get("/session/{session_id}")
def get_session(session_id: str):
    data = load_session(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return data
