import uuid
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional
from services.resume_parser import parse_pdf, parse_text
from models.schemas import UploadResponse

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_resume(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
):
    session_id = str(uuid.uuid4())
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
    return UploadResponse(session_id=session_id, resume_text=resume_text)
