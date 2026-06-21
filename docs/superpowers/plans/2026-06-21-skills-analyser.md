# Skills Analyser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that objectively extracts skills from a resume, tiers them by importance against SkillsFuture role frameworks, identifies gaps, and maps a vertical career progression ladder.

**Architecture:** FastAPI backend orchestrates OpenAI GPT-4o for skill extraction, tier ranking, gap analysis, and career ladder inference. **Hybrid data layer:** SkillsFuture skills dataset loaded into in-memory dict at startup (snappy lookups); user session data (analysis + career results) persisted as JSON files on disk per session_id (enables resume-pathway feature). React + Vite frontend has 4 sequential views (Upload → Role Selection → Gap Dashboard → Career Progression) with Zustand for session state and TanStack Query for async API calls.

**Tech Stack:** Python 3.11+, FastAPI, PyMuPDF, OpenAI SDK, pandas, openpyxl, pytest, httpx; React 18, TypeScript, Vite, Zustand, TanStack Query v5, Recharts, axios, Tailwind CSS

## Global Constraints

- Python ≥ 3.11
- OpenAI model: `gpt-4o` for all calls
- All OpenAI calls logged to `backend/logs/<session_id>.jsonl`
- SkillsFuture Excel files placed in `backend/data/skillsfuture/` (downloaded manually from jobsandskills.skillsfuture.gov.sg/skills-frameworks)
- CORS: backend allows `http://localhost:5173`
- Backend port: 8000 | Frontend port: 5173
- All API JSON keys: camelCase (FastAPI `alias_generator`)
- **Read-only data (SkillsFuture):** loaded into in-memory dict at startup — never re-read from disk per request
- **User session data:** persisted as `backend/sessions/<session_id>.json` on disk — enables resume-pathway feature
- No external database required

## File Map

```
backend/
  main.py                        — FastAPI app, CORS, router registration, health endpoint
  config.py                      — pydantic-settings Settings class
  .env.example                   — OPENAI_API_KEY=, SKILLSFUTURE_DATA_DIR=data/skillsfuture
  requirements.txt
  logs/                          — per-session JSONL interaction logs (gitignored)
  sessions/                      — per-session JSON snapshots of analysis + progress results (gitignored)
  data/
    skillsfuture/                — place downloaded .xlsx files here
    skillsfuture_loader.py       — loads Excel files → in-memory role→skill index
  models/
    schemas.py                   — all Pydantic request/response models
  services/
    interaction_logger.py        — logs every OpenAI call to JSONL
    resume_parser.py             — PDF bytes → plain text via PyMuPDF
    skill_extractor.py           — OpenAI: resume text → [ExtractedSkill]
    skill_ranker.py              — OpenAI: role skills list → [TieredSkill]
    gap_analyser.py              — pure function: diff user skills vs tiered role skills
    next_steps.py                — OpenAI: gaps → [str] concrete actions
    career_ladder.py             — OpenAI: role + user skills → ProgressResponse
  services/
    session_store.py             — save/load user session JSON to/from disk
  routers/
    upload.py                    — POST /api/upload
    analyse.py                   — POST /api/analyse
    roles.py                     — GET /api/roles
    progress.py                  — POST /api/progress
    session.py                   — GET /api/session/{session_id} (resume pathway)
  tests/
    test_skillsfuture_loader.py
    test_resume_parser.py
    test_skill_extractor.py
    test_skill_ranker.py
    test_gap_analyser.py
    test_career_ladder.py
    test_endpoints.py

frontend/
  index.html
  vite.config.ts
  tsconfig.json
  tailwind.config.ts
  package.json
  src/
    main.tsx                     — ReactDOM render, QueryClientProvider
    App.tsx                      — React Router routes
    store/
      useSessionStore.ts         — Zustand: resumeText, selectedRole, analysisResult
    api/
      client.ts                  — axios instance (baseURL http://localhost:8000)
      upload.ts                  — postUpload(file | text)
      analyse.ts                 — postAnalyse(request)
      roles.ts                   — getRoles(query)
      progress.ts                — postProgress(request)
    pages/
      UploadPage.tsx             — PDF drag-drop + text paste + mode toggle
      RoleSelectionPage.tsx      — searchable dropdown (target) or top-3 cards (auto-fit)
      GapDashboardPage.tsx       — 3-column layout + coverage score
      CareerProgressionPage.tsx  — progressive disclosure career map
    components/
      SkillCard.tsx              — skill name + confidence badge + expandable evidence
      TieredSkillList.tsx        — skills grouped/coloured by tier
      GapSummary.tsx             — coverage score + prioritised gap list
      CareerLadder.tsx           — vertical timeline with faint future roles
      RoleTooltip.tsx            — popover: transferability % + why-good-fit
      MilestoneChips.tsx         — clickable milestone steps
      SkillRadarChart.tsx        — Recharts RadarChart: user profile vs next role
```

---

## Task 1: Backend scaffold

**Files:**
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `backend/.env.example`
- Create: `backend/requirements.txt`
- Create: `backend/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/models/__init__.py`
- Create: `backend/data/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_endpoints.py` (health check only for now)

**Interfaces:**
- Produces: `app` FastAPI instance importable from `main`; `settings` importable from `config`

- [ ] **Step 1: Create `backend/requirements.txt`**

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

- [ ] **Step 2: Create `backend/.env.example`**

```
OPENAI_API_KEY=sk-...
SKILLSFUTURE_DATA_DIR=data/skillsfuture
LOG_DIR=logs
```

Copy to `.env` and fill in your real `OPENAI_API_KEY`.

- [ ] **Step 3: Create `backend/config.py`**

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

- [ ] **Step 4: Create empty `__init__.py` files**

```bash
cd backend
mkdir -p routers services models data logs tests
touch routers/__init__.py services/__init__.py models/__init__.py data/__init__.py tests/__init__.py
```

- [ ] **Step 5: Create `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Skills Analyser")

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

- [ ] **Step 6: Write failing health check test in `backend/tests/test_endpoints.py`**

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 7: Run test to verify it fails (no app yet)**

```bash
cd backend
pip install -r requirements.txt
pytest tests/test_endpoints.py::test_health -v
```

Expected: ImportError or FAIL (main not found yet — that's expected, we're in TDD).

- [ ] **Step 8: Run test to verify it passes now that `main.py` exists**

```bash
pytest tests/test_endpoints.py::test_health -v
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git init  # if not already a git repo
git add backend/
git commit -m "feat: backend scaffold with health endpoint"
```

---

## Task 2: SkillsFuture data loader + Pydantic schemas

**Files:**
- Create: `backend/data/skillsfuture_loader.py`
- Create: `backend/models/schemas.py`
- Create: `backend/tests/test_skillsfuture_loader.py`

**Interfaces:**
- Produces: `skillsfuture` singleton (instance of `SkillsFutureLoader`) importable from `data.skillsfuture_loader`
  - `skillsfuture.get_roles(query: str = "") -> list[str]`
  - `skillsfuture.get_skills_for_role(role: str) -> list[str]`
- Produces: All Pydantic models in `models.schemas` (see Step 2)

- [ ] **Step 1: Write failing tests in `backend/tests/test_skillsfuture_loader.py`**

```python
import pytest
from data.skillsfuture_loader import SkillsFutureLoader

def test_demo_data_loads():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    roles = loader.get_roles()
    assert len(roles) > 0

def test_get_roles_filter():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    results = loader.get_roles("data")
    assert all("data" in r.lower() for r in results)

def test_get_skills_for_role():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    roles = loader.get_roles()
    skills = loader.get_skills_for_role(roles[0])
    assert isinstance(skills, list)
    assert len(skills) > 0

def test_unknown_role_returns_empty():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    assert loader.get_skills_for_role("Nonexistent Role XYZ") == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_skillsfuture_loader.py -v
```

Expected: ImportError — module not found

- [ ] **Step 3: Create `backend/data/skillsfuture_loader.py`**

```python
import pandas as pd
from pathlib import Path
import logging
from config import settings

logger = logging.getLogger(__name__)

DEMO_DATA: dict[str, list[str]] = {
    "Data Analyst": [
        "Data Visualisation", "SQL", "Python", "Statistical Analysis",
        "Business Intelligence Tools", "Data Storytelling", "Excel",
        "Communication", "Problem Solving", "Data Governance",
    ],
    "Senior Data Analyst": [
        "Data Visualisation", "SQL", "Python", "Statistical Analysis",
        "Machine Learning Fundamentals", "Data Strategy", "Stakeholder Management",
        "Team Leadership", "Data Governance", "Communication",
    ],
    "Data Engineer": [
        "Python", "SQL", "ETL Pipeline Design", "Apache Spark", "Cloud Platforms",
        "Data Modelling", "Database Administration", "Data Quality Management",
        "DevOps Fundamentals", "Communication",
    ],
    "Software Engineer": [
        "Python", "Software Architecture", "Version Control (Git)",
        "Testing and Quality Assurance", "API Design", "Cloud Deployment",
        "Agile Methodologies", "Communication", "Problem Solving",
    ],
    "Product Manager": [
        "Product Strategy", "User Research", "Data Analysis", "Agile Methodologies",
        "Stakeholder Management", "Communication", "Roadmap Planning",
        "Market Analysis", "Problem Solving", "Business Acumen",
    ],
    "UX Designer": [
        "User Research", "Wireframing", "Prototyping", "Usability Testing",
        "Information Architecture", "Visual Design", "Communication",
        "Problem Solving", "Figma", "Accessibility Design",
    ],
    "Machine Learning Engineer": [
        "Python", "Machine Learning", "Deep Learning", "MLOps", "Cloud Platforms",
        "Feature Engineering", "Model Evaluation", "SQL", "Statistics",
        "Communication",
    ],
}

class SkillsFutureLoader:
    def __init__(self):
        self._role_index: dict[str, list[str]] = {}
        self._all_roles: list[str] = []

    def load(self):
        data_dir = Path(settings.skillsfuture_data_dir)
        if not data_dir.exists() or not list(data_dir.glob("*.xlsx")):
            logger.warning("No SkillsFuture Excel files found — using demo data")
            self.seed_demo_data()
            return
        for xlsx_file in data_dir.glob("*.xlsx"):
            self._load_file(xlsx_file)
        if not self._role_index:
            logger.warning("Excel files found but no roles extracted — using demo data")
            self.seed_demo_data()
        self._all_roles = sorted(self._role_index.keys())
        logger.info(f"Loaded {len(self._all_roles)} roles from SkillsFuture data")

    def seed_demo_data(self):
        self._role_index = {k: list(v) for k, v in DEMO_DATA.items()}
        self._all_roles = sorted(self._role_index.keys())

    def _load_file(self, path: Path):
        try:
            xl = pd.ExcelFile(path)
            for sheet_name in xl.sheet_names:
                df = pd.read_excel(path, sheet_name=sheet_name, header=None)
                self._extract_pairs(df.fillna("").astype(str))
        except Exception as e:
            logger.error(f"Failed to load {path.name}: {e}")

    def _extract_pairs(self, df: pd.DataFrame):
        role_keywords = {"job role", "role title", "occupation", "job title"}
        for col_idx, col in enumerate(df.columns):
            header = df.iloc[0, col_idx].lower()
            if any(kw in header for kw in role_keywords):
                skill_col = col_idx + 1
                if skill_col >= len(df.columns):
                    continue
                for _, row in df.iloc[1:].iterrows():
                    role = row.iloc[col_idx].strip()
                    skill = row.iloc[skill_col].strip()
                    if role and skill:
                        self._role_index.setdefault(role, [])
                        if skill not in self._role_index[role]:
                            self._role_index[role].append(skill)
                break

    def get_roles(self, query: str = "") -> list[str]:
        if not query:
            return self._all_roles
        q = query.lower()
        return [r for r in self._all_roles if q in r.lower()]

    def get_skills_for_role(self, role: str) -> list[str]:
        return self._role_index.get(role, [])

skillsfuture = SkillsFutureLoader()
```

- [ ] **Step 4: Create `backend/models/schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional

class UploadResponse(BaseModel):
    session_id: str
    resume_text: str

class ExtractedSkill(BaseModel):
    name: str
    evidence: str
    confidence: str  # "High" | "Medium" | "Low"

class TieredSkill(BaseModel):
    name: str
    tier: str  # "Essential" | "Important" | "Nice-to-have"
    reasoning: str

class GapItem(BaseModel):
    skill: str
    tier: str
    action: str

class CoverageScore(BaseModel):
    essential: str
    important: str
    nice_to_have: str

class AnalyseRequest(BaseModel):
    session_id: str
    resume_text: str
    target_role: Optional[str] = None  # None triggers auto-fit mode

class AnalyseResponse(BaseModel):
    session_id: str
    target_roles: list[str]
    user_skills: list[ExtractedSkill]
    tiered_role_skills: list[TieredSkill]
    coverage_score: CoverageScore
    gaps: list[GapItem]
    next_steps: list[str]

class RoleSearchResponse(BaseModel):
    roles: list[str]

class Milestone(BaseModel):
    description: str
    skill_focus: str

class CareerRung(BaseModel):
    role: str
    transferability_score: int  # 0–100
    skill_delta: list[str]
    why_good_fit: str
    milestones: list[Milestone]

class ProgressRequest(BaseModel):
    current_role: str
    user_skill_names: list[str]

class ProgressResponse(BaseModel):
    current_role: str
    immediate_next: CareerRung
    full_ladder: list[CareerRung]
    long_term_destination: str
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_skillsfuture_loader.py -v
```

Expected: 4 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/data/ backend/models/ backend/tests/test_skillsfuture_loader.py
git commit -m "feat: SkillsFuture loader with demo data fallback + Pydantic schemas"
```

---

## Task 3: Interaction logger

**Files:**
- Create: `backend/services/interaction_logger.py`

**Interfaces:**
- Produces: `log_interaction(session_id: str, call_type: str, prompt: str, response: str) -> None`

- [ ] **Step 1: Create `backend/services/interaction_logger.py`**

No test needed — pure I/O side effect, verified by inspection in later tasks.

```python
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from config import settings

def log_interaction(session_id: str, call_type: str, prompt: str, response: str) -> None:
    log_dir = Path(settings.log_dir)
    log_dir.mkdir(exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "session_id": session_id,
        "type": call_type,
        "model": "gpt-4o",
        "prompt": prompt,
        "response": response,
    }
    log_path = log_dir / f"{session_id}.jsonl"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/interaction_logger.py
git commit -m "feat: per-session JSONL interaction logger for OpenAI calls"
```

---

## Task 3.5: Session store service (user data persistence)

**Files:**
- Create: `backend/services/session_store.py`
- Create: `backend/routers/session.py`

**Interfaces:**
- Produces: `save_session(session_id: str, data: dict) -> None`
- Produces: `load_session(session_id: str) -> dict | None`
- Produces: `GET /api/session/{session_id}` → saved session JSON or 404

- [ ] **Step 1: Create `backend/services/session_store.py`**

```python
import json
from pathlib import Path
from config import settings

def _session_path(session_id: str) -> Path:
    sessions_dir = Path("sessions")
    sessions_dir.mkdir(exist_ok=True)
    return sessions_dir / f"{session_id}.json"

def save_session(session_id: str, data: dict) -> None:
    path = _session_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_session(session_id: str) -> dict | None:
    path = _session_path(session_id)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
```

- [ ] **Step 2: Create `backend/routers/session.py`**

```python
from fastapi import APIRouter, HTTPException
from services.session_store import load_session

router = APIRouter()

@router.get("/session/{session_id}")
def get_session(session_id: str):
    data = load_session(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return data
```

- [ ] **Step 3: Register session router in `backend/main.py`**

Add to imports and `app.include_router(session_router.router, prefix="/api")`.

- [ ] **Step 4: Commit**

```bash
git add backend/services/session_store.py backend/routers/session.py backend/main.py
git commit -m "feat: disk-persisted user session store + GET /api/session/{id} endpoint"
```

---

## Task 4: Resume parser + /upload endpoint

**Files:**
- Create: `backend/services/resume_parser.py`
- Create: `backend/routers/upload.py`
- Create: `backend/tests/test_resume_parser.py`

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces: `parse_pdf(pdf_bytes: bytes) -> str` from `services.resume_parser`
- Produces: `POST /api/upload` → `UploadResponse`

- [ ] **Step 1: Write failing test in `backend/tests/test_resume_parser.py`**

```python
import pytest
from services.resume_parser import parse_pdf, parse_text

def test_parse_text_passthrough():
    result = parse_text("Python developer with 5 years experience")
    assert result == "Python developer with 5 years experience"

def test_parse_pdf_invalid_bytes_raises():
    with pytest.raises(ValueError, match="Invalid PDF"):
        parse_pdf(b"not a pdf")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_resume_parser.py -v
```

Expected: ImportError

- [ ] **Step 3: Create `backend/services/resume_parser.py`**

```python
import fitz  # PyMuPDF

def parse_pdf(pdf_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        raise ValueError("Invalid PDF — could not open file")
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    if not text.strip():
        raise ValueError("Invalid PDF — no text content found")
    return text.strip()

def parse_text(text: str) -> str:
    return text.strip()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_resume_parser.py -v
```

Expected: 2 PASS

- [ ] **Step 5: Create `backend/routers/upload.py`**

```python
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
        resume_text = parse_pdf(pdf_bytes)
    elif text:
        resume_text = parse_text(text)
    else:
        return JSONResponse(status_code=400, content={"detail": "Provide either a file or text"})
    return UploadResponse(session_id=session_id, resume_text=resume_text)
```

- [ ] **Step 6: Register router in `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload as upload_router

app = FastAPI(title="Skills Analyser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Test the endpoint manually**

```bash
cd backend
uvicorn main:app --reload
# In another terminal:
curl -X POST http://localhost:8000/api/upload \
  -F "text=Python developer with 5 years experience in data engineering"
```

Expected: `{"session_id": "<uuid>", "resume_text": "Python developer..."}`

- [ ] **Step 8: Commit**

```bash
git add backend/services/resume_parser.py backend/routers/upload.py backend/main.py backend/tests/test_resume_parser.py
git commit -m "feat: resume parser + /api/upload endpoint"
```

---

## Task 5: Skill extractor service (OpenAI)

**Files:**
- Create: `backend/services/skill_extractor.py`
- Create: `backend/tests/test_skill_extractor.py`

**Interfaces:**
- Consumes: `log_interaction` from `services.interaction_logger`
- Produces: `extract_skills(resume_text: str, session_id: str) -> list[ExtractedSkill]`

- [ ] **Step 1: Write failing test in `backend/tests/test_skill_extractor.py`**

```python
import json
import pytest
from unittest.mock import MagicMock, patch
from services.skill_extractor import extract_skills
from models.schemas import ExtractedSkill

MOCK_RESPONSE_JSON = json.dumps({
    "skills": [
        {"name": "Python", "evidence": "Built ETL pipelines in Python — line 4", "confidence": "High"},
        {"name": "SQL", "evidence": "Queried PostgreSQL databases daily — line 6", "confidence": "High"},
        {"name": "Tableau", "evidence": "Created dashboards in Tableau — line 8", "confidence": "Medium"},
    ]
})

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_extract_skills_returns_list():
    with patch("services.skill_extractor.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_extractor.log_interaction"):
            result = extract_skills("dummy resume text", "test-session")
    assert isinstance(result, list)
    assert len(result) == 3

def test_extract_skills_fields():
    with patch("services.skill_extractor.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_extractor.log_interaction"):
            result = extract_skills("dummy resume text", "test-session")
    assert result[0].name == "Python"
    assert result[0].confidence == "High"
    assert "ETL" in result[0].evidence
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_skill_extractor.py -v
```

Expected: ImportError

- [ ] **Step 3: Create `backend/services/skill_extractor.py`**

```python
import json
from openai import OpenAI
from config import settings
from models.schemas import ExtractedSkill
from services.interaction_logger import log_interaction

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a skills analyst. Given a resume, extract every professional skill mentioned.
For each skill, provide:
- name: concise skill name (e.g. "Python", "Stakeholder Management")
- evidence: the exact resume text or paraphrase that proves this skill, with context
- confidence: "High" if clearly demonstrated, "Medium" if implied, "Low" if tangential

Return ONLY valid JSON in this exact format:
{"skills": [{"name": "...", "evidence": "...", "confidence": "High|Medium|Low"}]}"""

def extract_skills(resume_text: str, session_id: str) -> list[ExtractedSkill]:
    prompt = f"Resume:\n{resume_text}"
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "skill_extraction", prompt, content)
    data = json.loads(content)
    return [ExtractedSkill(**s) for s in data["skills"]]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_skill_extractor.py -v
```

Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/skill_extractor.py backend/tests/test_skill_extractor.py
git commit -m "feat: OpenAI skill extractor with evidence anchoring"
```

---

## Task 6: Skill ranker service (OpenAI)

**Files:**
- Create: `backend/services/skill_ranker.py`
- Create: `backend/tests/test_skill_ranker.py`

**Interfaces:**
- Consumes: `log_interaction` from `services.interaction_logger`
- Produces: `rank_skills(role: str, skills: list[str], session_id: str) -> list[TieredSkill]`

- [ ] **Step 1: Write failing test in `backend/tests/test_skill_ranker.py`**

```python
import json
import pytest
from unittest.mock import MagicMock, patch
from services.skill_ranker import rank_skills

MOCK_RESPONSE_JSON = json.dumps({
    "tiered_skills": [
        {"name": "Python", "tier": "Essential", "reasoning": "Core language for data work"},
        {"name": "SQL", "tier": "Essential", "reasoning": "Required for data querying"},
        {"name": "Tableau", "tier": "Nice-to-have", "reasoning": "Useful but not required"},
    ]
})

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_rank_skills_returns_tiered_list():
    with patch("services.skill_ranker.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_ranker.log_interaction"):
            result = rank_skills("Data Analyst", ["Python", "SQL", "Tableau"], "test-session")
    assert len(result) == 3
    tiers = {s.tier for s in result}
    assert tiers <= {"Essential", "Important", "Nice-to-have"}

def test_rank_skills_fields():
    with patch("services.skill_ranker.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_ranker.log_interaction"):
            result = rank_skills("Data Analyst", ["Python", "SQL", "Tableau"], "test-session")
    assert result[0].name == "Python"
    assert result[0].tier == "Essential"
    assert result[0].reasoning != ""
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_skill_ranker.py -v
```

Expected: ImportError

- [ ] **Step 3: Create `backend/services/skill_ranker.py`**

```python
import json
from openai import OpenAI
from config import settings
from models.schemas import TieredSkill
from services.interaction_logger import log_interaction

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a career specialist with expertise in Singapore's job market.
Given a job role and its list of skills, rank each skill into exactly one tier:
- Essential: must-have for day-one performance
- Important: significantly boosts effectiveness
- Nice-to-have: helpful but not critical

Return ONLY valid JSON:
{"tiered_skills": [{"name": "...", "tier": "Essential|Important|Nice-to-have", "reasoning": "..."}]}
Include ALL provided skills in your response."""

def rank_skills(role: str, skills: list[str], session_id: str) -> list[TieredSkill]:
    prompt = f"Role: {role}\nSkills to rank:\n" + "\n".join(f"- {s}" for s in skills)
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "skill_ranking", prompt, content)
    data = json.loads(content)
    return [TieredSkill(**s) for s in data["tiered_skills"]]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_skill_ranker.py -v
```

Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/skill_ranker.py backend/tests/test_skill_ranker.py
git commit -m "feat: OpenAI skill ranker — tiers skills into Essential/Important/Nice-to-have"
```

---

## Task 7: Gap analyser + next steps generator

**Files:**
- Create: `backend/services/gap_analyser.py`
- Create: `backend/services/next_steps.py`
- Create: `backend/tests/test_gap_analyser.py`

**Interfaces:**
- Consumes: `ExtractedSkill`, `TieredSkill`, `GapItem`, `CoverageScore` from `models.schemas`
- Consumes: `log_interaction` from `services.interaction_logger`
- Produces: `analyse_gaps(user_skills: list[ExtractedSkill], tiered_role_skills: list[TieredSkill]) -> tuple[list[GapItem], CoverageScore]`
- Produces: `generate_next_steps(role: str, gaps: list[GapItem], session_id: str) -> list[str]`

- [ ] **Step 1: Write failing tests in `backend/tests/test_gap_analyser.py`**

```python
import pytest
import json
from unittest.mock import MagicMock, patch
from models.schemas import ExtractedSkill, TieredSkill
from services.gap_analyser import analyse_gaps
from services.next_steps import generate_next_steps

USER_SKILLS = [
    ExtractedSkill(name="Python", evidence="Used Python daily", confidence="High"),
    ExtractedSkill(name="SQL", evidence="Queried databases", confidence="High"),
]

TIERED_SKILLS = [
    TieredSkill(name="Python", tier="Essential", reasoning="Core language"),
    TieredSkill(name="SQL", tier="Essential", reasoning="Data querying"),
    TieredSkill(name="Machine Learning", tier="Important", reasoning="Models"),
    TieredSkill(name="Tableau", tier="Nice-to-have", reasoning="Visualisation"),
]

def test_analyse_gaps_identifies_missing():
    gaps, score = analyse_gaps(USER_SKILLS, TIERED_SKILLS)
    gap_names = [g.skill for g in gaps]
    assert "Machine Learning" in gap_names
    assert "Python" not in gap_names
    assert "SQL" not in gap_names

def test_coverage_score_format():
    _, score = analyse_gaps(USER_SKILLS, TIERED_SKILLS)
    assert "/" in score.essential
    assert "/" in score.important
    assert "/" in score.nice_to_have

MOCK_STEPS_JSON = json.dumps({
    "next_steps": [
        "Complete a Machine Learning course on Coursera (e.g. Andrew Ng's ML Specialization)",
        "Build a personal project applying ML to a real dataset",
    ]
})

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_generate_next_steps_returns_list():
    from models.schemas import GapItem
    gaps = [GapItem(skill="Machine Learning", tier="Important", action="")]
    with patch("services.next_steps.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_STEPS_JSON)):
        with patch("services.next_steps.log_interaction"):
            result = generate_next_steps("Data Analyst", gaps, "test-session")
    assert isinstance(result, list)
    assert len(result) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_gap_analyser.py -v
```

Expected: ImportError

- [ ] **Step 3: Create `backend/services/gap_analyser.py`**

```python
from models.schemas import ExtractedSkill, TieredSkill, GapItem, CoverageScore

def analyse_gaps(
    user_skills: list[ExtractedSkill],
    tiered_role_skills: list[TieredSkill],
) -> tuple[list[GapItem], CoverageScore]:
    user_skill_names = {s.name.lower() for s in user_skills}
    gaps: list[GapItem] = []

    counts = {"Essential": [0, 0], "Important": [0, 0], "Nice-to-have": [0, 0]}

    for ts in tiered_role_skills:
        tier = ts.tier
        counts[tier][1] += 1
        if ts.name.lower() in user_skill_names:
            counts[tier][0] += 1
        else:
            gaps.append(GapItem(
                skill=ts.name,
                tier=tier,
                action="",  # filled by next_steps service
            ))

    score = CoverageScore(
        essential=f"{counts['Essential'][0]}/{counts['Essential'][1]}",
        important=f"{counts['Important'][0]}/{counts['Important'][1]}",
        nice_to_have=f"{counts['Nice-to-have'][0]}/{counts['Nice-to-have'][1]}",
    )

    # Sort gaps: Essential first, then Important, then Nice-to-have
    tier_order = {"Essential": 0, "Important": 1, "Nice-to-have": 2}
    gaps.sort(key=lambda g: tier_order.get(g.tier, 3))

    return gaps, score
```

- [ ] **Step 4: Create `backend/services/next_steps.py`**

```python
import json
from openai import OpenAI
from config import settings
from models.schemas import GapItem
from services.interaction_logger import log_interaction

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a career coach. Given a target role and a list of skill gaps, 
generate 3–5 concrete, specific, actionable next steps to close those gaps.
Prioritise by gap tier (Essential > Important > Nice-to-have).
Each step should be specific enough to act on today (e.g. name a specific course, certification, or project).
Return ONLY valid JSON: {"next_steps": ["step 1", "step 2", ...]}"""

def generate_next_steps(role: str, gaps: list[GapItem], session_id: str) -> list[str]:
    gap_summary = "\n".join(f"- {g.skill} ({g.tier})" for g in gaps[:8])
    prompt = f"Target role: {role}\nSkill gaps:\n{gap_summary}"
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "next_steps", prompt, content)
    return json.loads(content)["next_steps"]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_gap_analyser.py -v
```

Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add backend/services/gap_analyser.py backend/services/next_steps.py backend/tests/test_gap_analyser.py
git commit -m "feat: gap analyser + OpenAI next-steps generator"
```

---

## Task 8: Career ladder service (OpenAI)

**Files:**
- Create: `backend/services/career_ladder.py`
- Create: `backend/tests/test_career_ladder.py`

**Interfaces:**
- Consumes: `log_interaction`, `SkillsFutureLoader` singleton, `ProgressRequest`, `ProgressResponse`, `CareerRung`, `Milestone` from schemas
- Produces: `build_career_ladder(request: ProgressRequest, session_id: str) -> ProgressResponse`

- [ ] **Step 1: Write failing test in `backend/tests/test_career_ladder.py`**

```python
import json
import pytest
from unittest.mock import MagicMock, patch
from models.schemas import ProgressRequest, ProgressResponse
from services.career_ladder import build_career_ladder

MOCK_LADDER_JSON = json.dumps({
    "long_term_destination": "Principal Data Scientist",
    "ladder": [
        {
            "role": "Senior Data Analyst",
            "transferability_score": 72,
            "skill_delta": ["Machine Learning", "Stakeholder Management"],
            "why_good_fit": "High transferability from your analytics background",
            "milestones": [
                {"description": "Lead one end-to-end analytics project", "skill_focus": "Leadership"},
                {"description": "Complete Andrew Ng ML course", "skill_focus": "Machine Learning"},
            ]
        },
        {
            "role": "Data Science Manager",
            "transferability_score": 45,
            "skill_delta": ["Team Leadership", "Budget Management", "ML Engineering"],
            "why_good_fit": "Natural progression from senior analytics roles",
            "milestones": []
        }
    ]
})

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_build_career_ladder_returns_progress_response():
    req = ProgressRequest(current_role="Data Analyst", user_skill_names=["Python", "SQL"])
    with patch("services.career_ladder.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_LADDER_JSON)):
        with patch("services.career_ladder.log_interaction"):
            with patch("services.career_ladder.skillsfuture.get_skills_for_role", return_value=[]):
                result = build_career_ladder(req, "test-session")
    assert isinstance(result, ProgressResponse)
    assert result.current_role == "Data Analyst"
    assert result.immediate_next.role == "Senior Data Analyst"
    assert result.long_term_destination == "Principal Data Scientist"

def test_build_career_ladder_milestone_count():
    req = ProgressRequest(current_role="Data Analyst", user_skill_names=["Python"])
    with patch("services.career_ladder.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_LADDER_JSON)):
        with patch("services.career_ladder.log_interaction"):
            with patch("services.career_ladder.skillsfuture.get_skills_for_role", return_value=[]):
                result = build_career_ladder(req, "test-session")
    assert len(result.immediate_next.milestones) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_career_ladder.py -v
```

Expected: ImportError

- [ ] **Step 3: Create `backend/services/career_ladder.py`**

```python
import json
from openai import OpenAI
from config import settings
from models.schemas import ProgressRequest, ProgressResponse, CareerRung, Milestone
from services.interaction_logger import log_interaction
from data.skillsfuture_loader import skillsfuture

openai_client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a career progression specialist with deep knowledge of Singapore's job market and SkillsFuture frameworks.
Given a current role and the user's skills, infer a realistic vertical career progression ladder (2–4 future roles above the current one).

For each future role provide:
- role: exact role title
- transferability_score: 0–100 (how much of user's current skills transfer)
- skill_delta: list of new skills needed that the user doesn't currently have
- why_good_fit: one sentence explaining transferability from user's background
- milestones: 2–4 concrete, specific steps to reach THIS role from the previous rung (empty list for distant future roles)

Also identify the long_term_destination: the most senior role this path leads toward.

Return ONLY valid JSON:
{
  "long_term_destination": "...",
  "ladder": [
    {"role": "...", "transferability_score": 0, "skill_delta": [], "why_good_fit": "...", "milestones": [{"description": "...", "skill_focus": "..."}]}
  ]
}
Order ladder from closest to most distant future role."""

def build_career_ladder(request: ProgressRequest, session_id: str) -> ProgressResponse:
    role_skills = skillsfuture.get_skills_for_role(request.current_role)
    skills_context = ", ".join(role_skills[:15]) if role_skills else "not available"
    user_skills_str = ", ".join(request.user_skill_names[:20])

    prompt = (
        f"Current role: {request.current_role}\n"
        f"User's skills: {user_skills_str}\n"
        f"SkillsFuture skills for this role: {skills_context}"
    )

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "career_ladder", prompt, content)
    data = json.loads(content)

    ladder = [
        CareerRung(
            role=r["role"],
            transferability_score=r["transferability_score"],
            skill_delta=r["skill_delta"],
            why_good_fit=r["why_good_fit"],
            milestones=[Milestone(**m) for m in r.get("milestones", [])],
        )
        for r in data["ladder"]
    ]

    return ProgressResponse(
        current_role=request.current_role,
        immediate_next=ladder[0],
        full_ladder=ladder[1:],
        long_term_destination=data["long_term_destination"],
    )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_career_ladder.py -v
```

Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/career_ladder.py backend/tests/test_career_ladder.py
git commit -m "feat: OpenAI career ladder service with vertical progression inference"
```

---

## Task 9: /analyse + /roles + /progress endpoints

**Files:**
- Create: `backend/routers/analyse.py`
- Create: `backend/routers/roles.py`
- Create: `backend/routers/progress.py`
- Modify: `backend/main.py` — register all routers + call `skillsfuture.load()` on startup

**Interfaces:**
- Consumes: all services from Tasks 5–8, `skillsfuture` singleton, all schemas
- Produces: `POST /api/analyse` → `AnalyseResponse`; `GET /api/roles` → `RoleSearchResponse`; `POST /api/progress` → `ProgressResponse`

- [ ] **Step 1: Create `backend/routers/roles.py`**

```python
from fastapi import APIRouter, Query
from models.schemas import RoleSearchResponse
from data.skillsfuture_loader import skillsfuture

router = APIRouter()

@router.get("/roles", response_model=RoleSearchResponse)
def get_roles(q: str = Query("", description="Filter roles by name")):
    return RoleSearchResponse(roles=skillsfuture.get_roles(q))
```

- [ ] **Step 2: Create `backend/routers/progress.py`**

```python
from fastapi import APIRouter
from models.schemas import ProgressRequest, ProgressResponse
from services.career_ladder import build_career_ladder
from services.session_store import load_session, save_session

router = APIRouter()

@router.post("/progress", response_model=ProgressResponse)
def get_progress(request: ProgressRequest):
    session_id = "progress-" + request.current_role.replace(" ", "-").lower()
    result = build_career_ladder(request, session_id)
    # Merge progress result into existing session data (if any)
    existing = load_session(session_id) or {}
    existing["progress"] = result.model_dump()
    save_session(session_id, existing)
    return result
```

- [ ] **Step 3: Create `backend/routers/analyse.py`**

```python
from fastapi import APIRouter
from models.schemas import AnalyseRequest, AnalyseResponse, CoverageScore
from data.skillsfuture_loader import skillsfuture
from services.skill_extractor import extract_skills
from services.skill_ranker import rank_skills
from services.gap_analyser import analyse_gaps
from services.next_steps import generate_next_steps
import json
from openai import OpenAI
from config import settings
from services.interaction_logger import log_interaction

router = APIRouter()
openai_client = OpenAI(api_key=settings.openai_api_key)

def _infer_top_roles(resume_text: str, session_id: str) -> list[str]:
    all_roles = skillsfuture.get_roles()
    roles_list = "\n".join(f"- {r}" for r in all_roles[:80])
    prompt = (
        f"Resume:\n{resume_text[:2000]}\n\n"
        f"Available roles:\n{roles_list}\n\n"
        "Return the 3 best-matching roles as JSON: {\"roles\": [\"role1\", \"role2\", \"role3\"]}"
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You match resumes to job roles. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    log_interaction(session_id, "role_inference", prompt, content)
    return json.loads(content).get("roles", all_roles[:3])

@router.post("/analyse", response_model=AnalyseResponse)
def analyse(request: AnalyseRequest):
    session_id = request.session_id

    # Determine target roles
    if request.target_role:
        target_roles = [request.target_role]
    else:
        target_roles = _infer_top_roles(request.resume_text, session_id)

    primary_role = target_roles[0]

    # Extract skills from resume
    user_skills = extract_skills(request.resume_text, session_id)

    # Get role skills from SkillsFuture, rank them
    role_skill_names = skillsfuture.get_skills_for_role(primary_role)
    if not role_skill_names:
        role_skill_names = [s.name for s in user_skills[:10]]  # fallback
    tiered_skills = rank_skills(primary_role, role_skill_names, session_id)

    # Analyse gaps and generate next steps
    gaps, coverage = analyse_gaps(user_skills, tiered_skills)
    next_steps = generate_next_steps(primary_role, gaps, session_id)

    result = AnalyseResponse(
        session_id=session_id,
        target_roles=target_roles,
        user_skills=user_skills,
        tiered_role_skills=tiered_skills,
        coverage_score=coverage,
        gaps=gaps,
        next_steps=next_steps,
    )
    # Persist user session data to disk for resume-pathway feature
    save_session(session_id, {"analyse": result.model_dump()})
    return result
```

- [ ] **Step 4: Update `backend/main.py` to register all routers and load SkillsFuture data on startup**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload as upload_router
from routers import analyse as analyse_router
from routers import roles as roles_router
from routers import progress as progress_router
from routers import session as session_router
from data.skillsfuture_loader import skillsfuture

@asynccontextmanager
async def lifespan(app: FastAPI):
    skillsfuture.load()
    yield

app = FastAPI(title="Skills Analyser", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router.router, prefix="/api")
app.include_router(analyse_router.router, prefix="/api")
app.include_router(roles_router.router, prefix="/api")
app.include_router(progress_router.router, prefix="/api")
app.include_router(session_router.router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Smoke test all endpoints**

```bash
cd backend
uvicorn main:app --reload

# Terminal 2 — test roles endpoint
curl http://localhost:8000/api/roles
# Expected: {"roles": ["Data Analyst", "Data Engineer", ...]}

curl "http://localhost:8000/api/roles?q=data"
# Expected: roles filtered to contain "data"
```

- [ ] **Step 6: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All tests PASS (OpenAI tests are mocked)

- [ ] **Step 7: Commit**

```bash
git add backend/routers/ backend/main.py
git commit -m "feat: wire up all API endpoints — /upload /analyse /roles /progress"
```

---

## Task 10: Frontend scaffold

**Files:**
- Create: `frontend/` (Vite + React + TypeScript project)

**Interfaces:**
- Produces: running React app at `http://localhost:5173` that renders a placeholder home page

- [ ] **Step 1: Scaffold the Vite project**

```bash
cd C:\Users\darle\OneDrive\pycon26
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @tanstack/react-query axios zustand react-router-dom recharts
npm install -D tailwindcss postcss autoprefixer @types/recharts
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind — update `frontend/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

- [ ] **Step 4: Update `frontend/src/index.css` to include Tailwind directives**

Replace entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Update `frontend/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
```

- [ ] **Step 6: Create placeholder `frontend/src/App.tsx`**

```tsx
import { Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<div className="p-8 text-2xl font-bold">Skills Analyser</div>} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 7: Verify dev server starts**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` — should render "Skills Analyser" heading.

- [ ] **Step 8: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: Vite + React + TS + Tailwind + TanStack Query frontend scaffold"
```

---

## Task 11: Zustand store + API client layer

**Files:**
- Create: `frontend/src/store/useSessionStore.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/upload.ts`
- Create: `frontend/src/api/analyse.ts`
- Create: `frontend/src/api/roles.ts`
- Create: `frontend/src/api/progress.ts`
- Create: `frontend/src/types.ts`

**Interfaces:**
- Produces: `useSessionStore` hook with `resumeText`, `sessionId`, `selectedRole`, `analysisResult`, `progressResult` + setters
- Produces: typed API functions matching backend schemas

- [ ] **Step 1: Create `frontend/src/types.ts`**

```ts
export interface ExtractedSkill {
  name: string
  evidence: string
  confidence: 'High' | 'Medium' | 'Low'
}

export interface TieredSkill {
  name: string
  tier: 'Essential' | 'Important' | 'Nice-to-have'
  reasoning: string
}

export interface GapItem {
  skill: string
  tier: string
  action: string
}

export interface CoverageScore {
  essential: string
  important: string
  nice_to_have: string
}

export interface AnalyseResponse {
  session_id: string
  target_roles: string[]
  user_skills: ExtractedSkill[]
  tiered_role_skills: TieredSkill[]
  coverage_score: CoverageScore
  gaps: GapItem[]
  next_steps: string[]
}

export interface Milestone {
  description: string
  skill_focus: string
}

export interface CareerRung {
  role: string
  transferability_score: number
  skill_delta: string[]
  why_good_fit: string
  milestones: Milestone[]
}

export interface ProgressResponse {
  current_role: string
  immediate_next: CareerRung
  full_ladder: CareerRung[]
  long_term_destination: string
}
```

- [ ] **Step 2: Create `frontend/src/store/useSessionStore.ts`**

```ts
import { create } from 'zustand'
import type { AnalyseResponse, ProgressResponse } from '../types'

interface SessionState {
  sessionId: string | null
  resumeText: string | null
  selectedRole: string | null
  mode: 'target' | 'auto'
  analysisResult: AnalyseResponse | null
  progressResult: ProgressResponse | null
  setSessionId: (id: string) => void
  setResumeText: (text: string) => void
  setSelectedRole: (role: string) => void
  setMode: (mode: 'target' | 'auto') => void
  setAnalysisResult: (result: AnalyseResponse) => void
  setProgressResult: (result: ProgressResponse) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  resumeText: null,
  selectedRole: null,
  mode: 'target',
  analysisResult: null,
  progressResult: null,
  setSessionId: (id) => set({ sessionId: id }),
  setResumeText: (text) => set({ resumeText: text }),
  setSelectedRole: (role) => set({ selectedRole: role }),
  setMode: (mode) => set({ mode }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setProgressResult: (result) => set({ progressResult: result }),
  reset: () => set({
    sessionId: null, resumeText: null, selectedRole: null,
    mode: 'target', analysisResult: null, progressResult: null,
  }),
}))
```

- [ ] **Step 3: Create `frontend/src/api/client.ts`**

```ts
import axios from 'axios'

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
})
```

- [ ] **Step 4: Create `frontend/src/api/upload.ts`**

```ts
import { apiClient } from './client'

export async function postUpload(payload: { file?: File; text?: string }) {
  const form = new FormData()
  if (payload.file) form.append('file', payload.file)
  if (payload.text) form.append('text', payload.text)
  const res = await apiClient.post<{ session_id: string; resume_text: string }>('/api/upload', form)
  return res.data
}
```

- [ ] **Step 5: Create `frontend/src/api/analyse.ts`**

```ts
import { apiClient } from './client'
import type { AnalyseResponse } from '../types'

export async function postAnalyse(payload: {
  session_id: string
  resume_text: string
  target_role?: string
}) {
  const res = await apiClient.post<AnalyseResponse>('/api/analyse', payload)
  return res.data
}
```

- [ ] **Step 6: Create `frontend/src/api/roles.ts`**

```ts
import { apiClient } from './client'

export async function getRoles(q = '') {
  const res = await apiClient.get<{ roles: string[] }>('/api/roles', { params: { q } })
  return res.data.roles
}
```

- [ ] **Step 7: Create `frontend/src/api/progress.ts`**

```ts
import { apiClient } from './client'
import type { ProgressResponse } from '../types'

export async function postProgress(payload: {
  current_role: string
  user_skill_names: string[]
}) {
  const res = await apiClient.post<ProgressResponse>('/api/progress', payload)
  return res.data
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/
git commit -m "feat: Zustand session store + typed API client layer"
```

---

## Task 12: Upload page + Role selection page

**Files:**
- Create: `frontend/src/pages/UploadPage.tsx`
- Create: `frontend/src/pages/RoleSelectionPage.tsx`
- Modify: `frontend/src/App.tsx` — add routes

**Interfaces:**
- Consumes: `useSessionStore`, `postUpload`, `getRoles`, `postAnalyse`
- Produces: working Upload → Role Selection navigation flow

- [ ] **Step 1: Create `frontend/src/pages/UploadPage.tsx`**

```tsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import { postUpload } from '../api/upload'

export default function UploadPage() {
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'target' | 'auto'>('target')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { setSessionId, setResumeText, setMode: storeSetMode } = useSessionStore()

  async function handleSubmit(file?: File) {
    setLoading(true)
    setError('')
    try {
      const result = await postUpload({ file, text: file ? undefined : text })
      setSessionId(result.session_id)
      setResumeText(result.resume_text)
      storeSetMode(mode)
      navigate('/role-selection')
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 p-8">
      <h1 className="text-3xl font-bold mb-2">Skills Analyser</h1>
      <p className="text-gray-500 mb-8">Upload your resume to get a personalised skills gap analysis and career roadmap.</p>

      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center mb-6 cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleSubmit(f) }}
        onClick={() => fileRef.current?.click()}
      >
        <p className="text-gray-500">Drag & drop a PDF resume here, or click to browse</p>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSubmit(f) }} />
      </div>

      <p className="text-center text-gray-400 mb-4">— or paste your resume text —</p>

      <textarea
        className="w-full border rounded-lg p-3 h-36 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="Paste resume text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('target')}
          className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${mode === 'target' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
        >
          I know my target role
        </button>
        <button
          onClick={() => setMode('auto')}
          className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${mode === 'auto' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
        >
          Show me what fits
        </button>
      </div>

      {text && (
        <button
          onClick={() => handleSubmit()}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? 'Analysing...' : 'Analyse Resume'}
        </button>
      )}

      {error && <p className="text-red-500 mt-3 text-sm">{error}</p>}

      {/* Resume session */}
      <div className="mt-8 border-t pt-6">
        <p className="text-sm text-gray-400 mb-2">Have a session ID? Resume your pathway:</p>
        <ResumeSession />
      </div>
    </div>
  )
}

function ResumeSession() {
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const { setSessionId, setAnalysisResult, setProgressResult } = useSessionStore()

  async function handleResume() {
    try {
      const res = await fetch(`http://localhost:8000/api/session/${id}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setSessionId(id)
      if (data.analyse) { setAnalysisResult(data.analyse); navigate('/gap-dashboard') }
    } catch {
      alert('Session not found. Check the ID and try again.')
    }
  }

  return (
    <div className="flex gap-2">
      <input
        className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="Session ID (e.g. 3f8a2c1d-...)"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button
        onClick={handleResume}
        disabled={!id}
        className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-40"
      >
        Resume
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/pages/RoleSelectionPage.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSessionStore } from '../store/useSessionStore'
import { getRoles } from '../api/roles'
import { postAnalyse } from '../api/analyse'

export default function RoleSelectionPage() {
  const navigate = useNavigate()
  const { sessionId, resumeText, mode, selectedRole, setSelectedRole, setAnalysisResult } = useSessionStore()
  const [query, setQuery] = useState('')

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', query],
    queryFn: () => getRoles(query),
    enabled: mode === 'target',
  })

  const mutation = useMutation({
    mutationFn: () => postAnalyse({
      session_id: sessionId!,
      resume_text: resumeText!,
      target_role: mode === 'target' ? selectedRole ?? undefined : undefined,
    }),
    onSuccess: (data) => {
      setAnalysisResult(data)
      navigate('/gap-dashboard')
    },
  })

  if (!sessionId || !resumeText) {
    navigate('/')
    return null
  }

  return (
    <div className="max-w-2xl mx-auto mt-16 p-8">
      <h2 className="text-2xl font-bold mb-2">
        {mode === 'target' ? 'Select your target role' : 'Finding your best matches...'}
      </h2>

      {mode === 'target' && (
        <>
          <input
            className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Search roles (e.g. Data Analyst, Software Engineer)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="border rounded-lg divide-y max-h-72 overflow-y-auto mb-6">
            {roles.map((role) => (
              <li
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-4 py-3 cursor-pointer hover:bg-blue-50 ${selectedRole === role ? 'bg-blue-100 font-semibold' : ''}`}
              >
                {role}
              </li>
            ))}
          </ul>
        </>
      )}

      {mode === 'auto' && (
        <p className="text-gray-500 mb-6">The AI will identify the top 3 roles that best match your resume.</p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || (mode === 'target' && !selectedRole)}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
      >
        {mutation.isPending ? 'Analysing (this takes ~20 seconds)...' : 'Analyse Skills Gap'}
      </button>

      {mutation.isError && <p className="text-red-500 mt-3 text-sm">Analysis failed. Please try again.</p>}
    </div>
  )
}
```

- [ ] **Step 3: Update `frontend/src/App.tsx` with all routes**

```tsx
import { Routes, Route } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import RoleSelectionPage from './pages/RoleSelectionPage'
import GapDashboardPage from './pages/GapDashboardPage'
import CareerProgressionPage from './pages/CareerProgressionPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/role-selection" element={<RoleSelectionPage />} />
        <Route path="/gap-dashboard" element={<GapDashboardPage />} />
        <Route path="/career-progression" element={<CareerProgressionPage />} />
      </Routes>
    </div>
  )
}
```

Add placeholder pages so the app compiles — create empty stubs:

`frontend/src/pages/GapDashboardPage.tsx`:
```tsx
export default function GapDashboardPage() {
  return <div className="p-8 text-xl font-bold">Gap Dashboard — coming next</div>
}
```

`frontend/src/pages/CareerProgressionPage.tsx`:
```tsx
export default function CareerProgressionPage() {
  return <div className="p-8 text-xl font-bold">Career Progression — coming next</div>
}
```

- [ ] **Step 4: Verify the app compiles and navigates**

```bash
cd frontend && npm run dev
```

Visit `http://localhost:5173`, drag a PDF or paste text, select a mode, proceed to Role Selection page.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ frontend/src/App.tsx
git commit -m "feat: Upload page + Role Selection page with mode toggle"
```

---

## Task 13: Gap dashboard page

**Files:**
- Create: `frontend/src/components/SkillCard.tsx`
- Create: `frontend/src/components/TieredSkillList.tsx`
- Create: `frontend/src/components/GapSummary.tsx`
- Create: `frontend/src/components/SkillRadarChart.tsx`
- Modify: `frontend/src/pages/GapDashboardPage.tsx`

**Interfaces:**
- Consumes: `analysisResult` from `useSessionStore`

- [ ] **Step 1: Create `frontend/src/components/SkillCard.tsx`**

```tsx
import { useState } from 'react'
import type { ExtractedSkill } from '../types'

const confidenceColour = { High: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700', Low: 'bg-gray-100 text-gray-600' }

export default function SkillCard({ skill }: { skill: ExtractedSkill }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-lg p-3 mb-2 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{skill.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColour[skill.confidence]}`}>{skill.confidence}</span>
      </div>
      {open && <p className="text-xs text-gray-500 mt-2 italic">"{skill.evidence}"</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/TieredSkillList.tsx`**

```tsx
import type { TieredSkill } from '../types'

const tierStyle = {
  Essential: 'border-red-300 bg-red-50 text-red-700',
  Important: 'border-amber-300 bg-amber-50 text-amber-700',
  'Nice-to-have': 'border-green-300 bg-green-50 text-green-700',
}

const tierOrder = ['Essential', 'Important', 'Nice-to-have'] as const

export default function TieredSkillList({ skills }: { skills: TieredSkill[] }) {
  return (
    <div className="space-y-4">
      {tierOrder.map((tier) => {
        const items = skills.filter((s) => s.tier === tier)
        if (!items.length) return null
        return (
          <div key={tier}>
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1">{tier}</h4>
            {items.map((s) => (
              <div key={s.name} className={`border rounded px-3 py-2 mb-1 text-sm ${tierStyle[tier as keyof typeof tierStyle]}`} title={s.reasoning}>
                {s.name}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/components/GapSummary.tsx`**

```tsx
import type { CoverageScore, GapItem } from '../types'

const tierColour = { Essential: 'text-red-600', Important: 'text-amber-600', 'Nice-to-have': 'text-green-600' }

export default function GapSummary({ score, gaps, nextSteps }: { score: CoverageScore; gaps: GapItem[]; nextSteps: string[] }) {
  return (
    <div>
      <div className="bg-white border rounded-xl p-4 mb-4">
        <h3 className="font-semibold mb-3">Coverage Score</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-red-600 font-medium">Essential</span><span>{score.essential}</span></div>
          <div className="flex justify-between"><span className="text-amber-600 font-medium">Important</span><span>{score.important}</span></div>
          <div className="flex justify-between"><span className="text-green-600 font-medium">Nice-to-have</span><span>{score.nice_to_have}</span></div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 mb-4">
        <h3 className="font-semibold mb-3">Top Gaps to Close</h3>
        <ul className="space-y-1">
          {gaps.slice(0, 6).map((g) => (
            <li key={g.skill} className="flex items-center gap-2 text-sm">
              <span className={`font-medium w-24 shrink-0 ${tierColour[g.tier as keyof typeof tierColour] ?? 'text-gray-600'}`}>{g.tier}</span>
              <span>{g.skill}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold mb-3">Next Steps</h3>
        <ol className="list-decimal list-inside space-y-2">
          {nextSteps.map((step, i) => (
            <li key={i} className="text-sm text-gray-700">{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/SkillRadarChart.tsx`**

```tsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from 'recharts'
import type { ExtractedSkill, TieredSkill } from '../types'

export default function SkillRadarChart({ userSkills, roleSkills }: { userSkills: ExtractedSkill[]; roleSkills: TieredSkill[] }) {
  const userNames = new Set(userSkills.map((s) => s.name.toLowerCase()))
  const data = roleSkills.slice(0, 8).map((s) => ({
    skill: s.name.length > 14 ? s.name.slice(0, 12) + '…' : s.name,
    Role: 100,
    You: userNames.has(s.name.toLowerCase()) ? 100 : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
        <Radar name="Role Requirement" dataKey="Role" stroke="#e2e8f0" fill="#e2e8f0" fillOpacity={0.5} />
        <Radar name="Your Skills" dataKey="You" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 5: Replace `frontend/src/pages/GapDashboardPage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import SkillCard from '../components/SkillCard'
import TieredSkillList from '../components/TieredSkillList'
import GapSummary from '../components/GapSummary'
import SkillRadarChart from '../components/SkillRadarChart'

export default function GapDashboardPage() {
  const navigate = useNavigate()
  const { analysisResult } = useSessionStore()

  if (!analysisResult) { navigate('/'); return null }

  const { target_roles, user_skills, tiered_role_skills, coverage_score, gaps, next_steps } = analysisResult

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Skills Gap Analysis</h1>
          <p className="text-gray-500 text-sm">Target: <span className="font-medium text-gray-700">{target_roles[0]}</span></p>
        </div>
        <button
          onClick={() => navigate('/career-progression')}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700"
        >
          View Career Path →
        </button>
      </div>

      <div className="mb-6">
        <SkillRadarChart userSkills={user_skills} roleSkills={tiered_role_skills} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">Your Skills ({user_skills.length})</h2>
          {user_skills.map((s) => <SkillCard key={s.name} skill={s} />)}
        </div>
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">Role Requirements</h2>
          <TieredSkillList skills={tiered_role_skills} />
        </div>
        <div>
          <h2 className="font-semibold mb-3 text-gray-700">Gap Summary</h2>
          <GapSummary score={coverage_score} gaps={gaps} nextSteps={next_steps} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify the page renders with real data**

Run both backend and frontend, upload a resume, and verify all 3 columns populate correctly.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ frontend/src/pages/GapDashboardPage.tsx
git commit -m "feat: Gap Dashboard with 3-column layout, radar chart, skill evidence"
```

---

## Task 14: Career progression page

**Files:**
- Create: `frontend/src/components/CareerLadder.tsx`
- Create: `frontend/src/components/MilestoneChips.tsx`
- Modify: `frontend/src/pages/CareerProgressionPage.tsx`

**Interfaces:**
- Consumes: `analysisResult`, `progressResult` from `useSessionStore`; `postProgress` from `api/progress`

- [ ] **Step 1: Create `frontend/src/components/MilestoneChips.tsx`**

```tsx
import type { Milestone } from '../types'

export default function MilestoneChips({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {milestones.map((m, i) => (
        <div key={i} className="group relative">
          <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full cursor-pointer hover:bg-blue-200 font-medium">
            {m.description.length > 40 ? m.description.slice(0, 38) + '…' : m.description}
          </span>
          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 w-48 z-10">
            <p>{m.description}</p>
            <p className="text-gray-300 mt-1">Focus: {m.skill_focus}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/CareerLadder.tsx`**

```tsx
import type { CareerRung } from '../types'
import MilestoneChips from './MilestoneChips'

interface Props {
  currentRole: string
  immediateNext: CareerRung
  fullLadder: CareerRung[]
  longTermDestination: string
}

export default function CareerLadder({ currentRole, immediateNext, fullLadder, longTermDestination }: Props) {
  return (
    <div className="relative pl-6 border-l-2 border-blue-200">
      {/* Long-term destination — faint north star */}
      <div className="mb-6 opacity-40">
        <div className="absolute -left-2 w-4 h-4 rounded-full bg-purple-300 border-2 border-white" />
        <p className="text-xs uppercase tracking-wide text-purple-500 font-semibold ml-4">Long-term goal</p>
        <p className="text-base font-bold text-purple-400 ml-4">{longTermDestination}</p>
      </div>

      {/* Distant future roles — faint */}
      {[...fullLadder].reverse().map((rung) => (
        <div key={rung.role} className="mb-6 opacity-50 group">
          <div className="absolute -left-2 w-4 h-4 rounded-full bg-gray-300 border-2 border-white" />
          <div className="ml-4">
            <p className="text-sm font-semibold text-gray-400">{rung.role}</p>
            <p className="text-xs text-gray-400">{rung.transferability_score}% transferable</p>
            <div className="hidden group-hover:block bg-white border shadow-md rounded-lg p-3 mt-1 text-xs max-w-xs">
              <p className="font-medium text-gray-700 mb-1">{rung.why_good_fit}</p>
              {rung.skill_delta.length > 0 && (
                <p className="text-gray-500">New skills needed: {rung.skill_delta.slice(0, 3).join(', ')}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Immediate next — primary CTA */}
      <div className="mb-6 bg-blue-50 border-2 border-blue-400 rounded-xl p-4">
        <div className="absolute -left-3 w-5 h-5 rounded-full bg-blue-500 border-2 border-white" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-blue-500 font-semibold uppercase mb-1">Next Step</p>
            <p className="text-lg font-bold text-blue-800">{immediateNext.role}</p>
            <p className="text-sm text-blue-600 mt-1">{immediateNext.transferability_score}% of your skills transfer</p>
            <p className="text-sm text-gray-600 mt-1 italic">"{immediateNext.why_good_fit}"</p>
          </div>
        </div>
        {immediateNext.skill_delta.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">New skills needed:</p>
            <div className="flex flex-wrap gap-1">
              {immediateNext.skill_delta.map((s) => (
                <span key={s} className="bg-white border border-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </div>
        )}
        {immediateNext.milestones.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">Milestones to get here:</p>
            <MilestoneChips milestones={immediateNext.milestones} />
          </div>
        )}
      </div>

      {/* Current role */}
      <div className="mb-2">
        <div className="absolute -left-2 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
        <div className="ml-4">
          <p className="text-xs text-green-600 font-semibold uppercase">You are here</p>
          <p className="text-base font-bold text-gray-700">{currentRole}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace `frontend/src/pages/CareerProgressionPage.tsx`**

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSessionStore } from '../store/useSessionStore'
import { postProgress } from '../api/progress'
import CareerLadder from '../components/CareerLadder'

export default function CareerProgressionPage() {
  const navigate = useNavigate()
  const { analysisResult, progressResult, setProgressResult } = useSessionStore()

  const mutation = useMutation({
    mutationFn: () => postProgress({
      current_role: analysisResult!.target_roles[0],
      user_skill_names: analysisResult!.user_skills.map((s) => s.name),
    }),
    onSuccess: setProgressResult,
  })

  useEffect(() => {
    if (!analysisResult) { navigate('/'); return }
    if (!progressResult) mutation.mutate()
  }, [])

  if (!analysisResult) return null

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/gap-dashboard')} className="text-blue-600 text-sm hover:underline">← Back to Gap Analysis</button>
        <h1 className="text-2xl font-bold">Your Career Path</h1>
      </div>

      {mutation.isPending && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Mapping your career progression...</p>
          <p className="text-sm mt-2">This takes about 10 seconds</p>
        </div>
      )}

      {mutation.isError && (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Failed to load career path.</p>
          <button onClick={() => mutation.mutate()} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Retry</button>
        </div>
      )}

      {progressResult && (
        <>
          <p className="text-sm text-gray-500 mb-6">
            This path leads toward <span className="font-semibold text-purple-600">{progressResult.long_term_destination}</span> — your current effort is part of a larger, coherent journey.
          </p>
          <CareerLadder
            currentRole={progressResult.current_role}
            immediateNext={progressResult.immediate_next}
            fullLadder={progressResult.full_ladder}
            longTermDestination={progressResult.long_term_destination}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: End-to-end test — full user journey**

1. Start backend: `cd backend && uvicorn main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Upload a resume PDF or paste text
4. Select mode and proceed to Role Selection
5. Select a role and click Analyse
6. Verify Gap Dashboard renders with 3 columns, radar chart, and coverage scores
7. Click "View Career Path" — verify ladder renders with immediate next role highlighted, future roles faded, and milestone chips
8. Hover over a future role to see the tooltip
9. Confirm `backend/logs/<session_id>.jsonl` was created with all OpenAI call entries

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CareerLadder.tsx frontend/src/components/MilestoneChips.tsx frontend/src/pages/CareerProgressionPage.tsx
git commit -m "feat: Career Progression page with progressive disclosure ladder, milestones, and tooltips"
```

---

## Self-Review Against Spec

| Spec requirement | Task |
|---|---|
| Resume upload (PDF + paste) | Task 4, 12 |
| Target role mode (searchable dropdown) | Task 9 (/roles), Task 12 |
| Auto-fit mode (top 3 inferred roles) | Task 9 (_infer_top_roles) |
| Skill extraction with evidence snippets | Task 5 |
| Skill tier ranking (Essential/Important/Nice-to-have) | Task 6 |
| SkillsFuture data + LLM combined ranking | Task 6, 9 |
| Gap analysis with coverage score | Task 7 |
| Next steps (concrete, prioritised) | Task 7 |
| Vertical career progression ladder | Task 8, 14 |
| Immediate next role as primary CTA | Task 14 (CareerLadder) |
| Full ladder with faint future roles | Task 14 (CareerLadder) |
| Role tooltips (why good fit) | Task 14 (CareerLadder hover) |
| Milestone chips | Task 14 (MilestoneChips) |
| Skill radar chart | Task 13 (SkillRadarChart) |
| OpenAI interaction logging (mandatory submission) | Task 3 |
| SkillsFuture demo data fallback | Task 2 |
