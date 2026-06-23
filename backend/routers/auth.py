from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from services.user_store import create_user, get_user
from services.auth_service import hash_password, verify_password, create_token, decode_token
from services.session_store import load_session

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    email: str


@router.post("/signup", response_model=AuthResponse)
def signup(req: SignupRequest):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    hashed = hash_password(req.password)
    created = create_user(req.email, hashed)
    if not created:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    token = create_token(req.email)
    return AuthResponse(token=token, email=req.email)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    user = get_user(req.email)
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_token(req.email)
    return AuthResponse(token=token, email=req.email)


@router.get("/restore")
def restore_session(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token.")
    email = decode_token(authorization.removeprefix("Bearer "))
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    session = load_session(email)
    if not session:
        return {"session": None}
    return {"session": session}
