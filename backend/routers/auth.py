from fastapi import APIRouter, HTTPException, Header
from models.user import UserRegister, UserLogin, TokenResponse, UserOut
from services.auth_service import register_user, login_user, create_token, decode_token, get_history

router = APIRouter()

@router.post("/auth/register", response_model=TokenResponse)
def register(body: UserRegister):
    try:
        user = register_user(body.email, body.password, body.name)
        token = create_token(user)
        return TokenResponse(access_token=token, user=UserOut(**user))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/login", response_model=TokenResponse)
def login(body: UserLogin):
    try:
        user = login_user(body.email, body.password)
        token = create_token(user)
        return TokenResponse(access_token=token, user=UserOut(**user))
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/auth/history")
def history(authorization: str = Header(...)):
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
        return {"history": get_history(payload["sub"])}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))