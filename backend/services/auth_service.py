import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError

SECRET_KEY = "change-this-to-a-random-secret-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# File-based user store — no database needed yet
USERS_FILE = Path("data/users.json")

def _load_users() -> dict:
    if not USERS_FILE.exists():
        USERS_FILE.parent.mkdir(exist_ok=True)
        return {}
    return json.loads(USERS_FILE.read_text())

def _save_users(users: dict):
    USERS_FILE.write_text(json.dumps(users, indent=2))

def register_user(email: str, password: str, name: str) -> dict:
    users = _load_users()
    if email in users:
        raise ValueError("Email already registered")
    user_id = str(uuid.uuid4())
    users[email] = {
        "id": user_id,
        "email": email,
        "name": name,
        "hashed_password": pwd_context.hash(password),
        "history": [],
    }
    _save_users(users)
    return {"id": user_id, "email": email, "name": name}

def login_user(email: str, password: str) -> dict:
    users = _load_users()
    user = users.get(email)
    if not user or not pwd_context.verify(password, user["hashed_password"]):
        raise ValueError("Invalid email or password")
    return {"id": user["id"], "email": email, "name": user["name"]}

def create_token(user: dict) -> str:
    payload = {
        "sub": user["email"],
        "name": user["name"],
        "id": user["id"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise ValueError("Invalid or expired token")

def save_analysis(email: str, role: str, coverage: dict, gaps: list):
    users = _load_users()
    if email not in users:
        return
    entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "role": role,
        "coverage": coverage,
        "gaps": [g["skill"] for g in gaps[:5]],
    }
    users[email]["history"].append(entry)
    _save_users(users)

def get_history(email: str) -> list:
    users = _load_users()
    return users.get(email, {}).get("history", [])