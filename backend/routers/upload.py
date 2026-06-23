from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
from services.resume_parser import parse_pdf, parse_text
from services.session_store import load_session, save_session
from services.auth_service import decode_token
from models.schemas import UploadResponse

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_resume(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    authorization: str = Header(...),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    email = decode_token(authorization.removeprefix("Bearer "))
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if file:
        pdf_bytes = await file.read()
        try:
            resume_text = parse_pdf(pdf_bytes)
        except ValueError as e:
            return JSONResponse(status_code=400, content={"detail": str(e)})
    elif text:
        resume_text = parse_text(text)
    else:
        return JSONResponse(status_code=400, content={"detail": "Provide either a file or text"})

    existing = load_session(email) or {}
    existing["resume_text"] = resume_text
    save_session(email, existing)

    return UploadResponse(resume_text=resume_text)
