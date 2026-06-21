# Task 1: Backend scaffold

## What to build

Create the FastAPI backend skeleton for the Skills Analyser app. No business logic yet — just structure, config, and a health endpoint.

## Files to create

- `backend/main.py` — FastAPI app, CORS middleware allowing `http://localhost:5173`, health endpoint at `GET /api/health` returning `{"status": "ok"}`, and placeholder for router registration
- `backend/config.py` — pydantic-settings `Settings` class with fields: `openai_api_key: str`, `skillsfuture_data_dir: str = "data/skillsfuture"`, `log_dir: str = "logs"`; reads from `.env` file
- `backend/.env.example` — contains `OPENAI_API_KEY=sk-...`, `SKILLSFUTURE_DATA_DIR=data/skillsfuture`, `LOG_DIR=logs`
- `backend/requirements.txt` — exact versions listed below
- `backend/routers/__init__.py` — empty
- `backend/services/__init__.py` — empty
- `backend/models/__init__.py` — empty
- `backend/data/__init__.py` — empty
- `backend/tests/__init__.py` — empty
- `backend/logs/` — directory (add a `.gitkeep`)
- `backend/sessions/` — directory (add a `.gitkeep`)
- `backend/data/skillsfuture/` — directory (add a `.gitkeep` and a README.txt saying "Place SkillsFuture .xlsx files here")
- `backend/tests/test_endpoints.py` — health check test (see below)

## requirements.txt (exact)

```
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
PyMuPDF==1.24.5
openai==1.35.0
pandas==2.2.2
openpyxl==3.1.5
python-dotenv==1.0.1
pydantic==2.7.4
pydantic-settings==2.3.4
pytest==8.2.2
pytest-asyncio==0.23.7
httpx==0.27.0
```

## main.py

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield  # startup/shutdown hooks added in Task 9

app = FastAPI(title="Skills Analyser", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

## config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    skillsfuture_data_dir: str = "data/skillsfuture"
    log_dir: str = "logs"

    class Config:
        env_file = ".env"

settings = Settings()
```

## Test (backend/tests/test_endpoints.py)

Follow TDD:
1. Write the test first
2. Run it — it should fail (ImportError or similar) before main.py exists
3. Create main.py
4. Run it — it should pass

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

## Steps

1. Create all directories and `__init__.py` / `.gitkeep` files
2. Write `requirements.txt`
3. Write `.env.example`
4. Write the failing test in `backend/tests/test_endpoints.py`
5. `cd backend && pip install -r requirements.txt` (run from backend/)
6. Run `pytest tests/test_endpoints.py -v` — expect failure (no main.py yet)
7. Write `config.py` and `main.py`
8. Run `pytest tests/test_endpoints.py -v` — expect 1 PASS
9. Commit everything under `backend/`

## Working directory

`C:\Users\darle\OneDrive\pycon26`

All backend files live under `backend/`. Run pytest from inside `backend/`.

## Notes

- Do NOT create a `.env` file (only `.env.example`) — the real `.env` with the API key is the user's responsibility
- The `config.py` `Settings` class will fail to instantiate if `OPENAI_API_KEY` is not set. This is intentional — it prevents the app from silently starting without credentials. The test doesn't instantiate Settings, so it won't fail.
- Add `*.env` and `sessions/` and `logs/` to `.gitignore`
