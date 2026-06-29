# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all file-based storage (JSON files, JSONL logs) and custom auth with Supabase Auth + PostgreSQL, keeping the FastAPI API surface and JWT format completely unchanged.

**Architecture:** FastAPI wraps Supabase Auth (register/login) and Supabase PostgreSQL (history, sessions, logs). All service function signatures are unchanged — email is still the external key; UUIDs are resolved internally by the service layer. No router files are touched.

**Tech Stack:** Python 3.11+, FastAPI, supabase-py 2.15.2, Supabase PostgreSQL, python-jose (JWT, unchanged)

## Global Constraints

- Supabase project must be created and schema applied before running any code
- Use the **service role key** (not the anon key) — it bypasses Row Level Security
- All FastAPI route signatures remain unchanged
- JWT payload format unchanged: `{"sub": email, "name": str, "id": str, "exp": int}`
- No router files are modified
- `passlib` and `bcrypt` remain in requirements (used elsewhere); only `auth_service.py` stops calling them
- Python target: 3.11+

---

### Task 1: Infrastructure — Schema, Config, Supabase Client

**Files:**
- Create: `backend/supabase_schema.sql`
- Modify: `backend/requirements.txt`
- Modify: `backend/config.py`
- Create: `backend/services/supabase_client.py`
- Create: `backend/tests/test_supabase_client.py`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `get_supabase() -> Client` — imported by auth_service, session_store, interaction_logger in subsequent tasks

**Before writing any code:** Create a Supabase project at supabase.com, then copy `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (Settings → API → service_role) into `backend/.env`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_supabase_client.py`:
```python
import sys
from unittest.mock import patch, MagicMock


def test_get_supabase_returns_client():
    # Remove cached module so singleton resets
    sys.modules.pop("services.supabase_client", None)

    mock_client = MagicMock()
    with patch("supabase.create_client", return_value=mock_client) as mock_create:
        from services.supabase_client import get_supabase
        client = get_supabase()

    mock_create.assert_called_once()
    assert client is mock_client


def test_get_supabase_is_singleton():
    sys.modules.pop("services.supabase_client", None)

    mock_client = MagicMock()
    with patch("supabase.create_client", return_value=mock_client):
        from services.supabase_client import get_supabase
        c1 = get_supabase()
        c2 = get_supabase()

    assert c1 is c2
```

- [ ] **Step 2: Run test to verify it fails**

```
cd backend && python -m pytest tests/test_supabase_client.py -v
```
Expected: ImportError — `services.supabase_client` does not exist yet.

- [ ] **Step 3: Add supabase to requirements.txt**

Add after `bcrypt==4.1.3`:
```
supabase==2.15.2
```

Install:
```
pip install supabase==2.15.2
```

- [ ] **Step 4: Update config.py**

Replace `backend/config.py` with:
```python
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    supabase_url: str
    supabase_service_key: str
    skillsfuture_data_dir: str = "data/skillsfuture"
    log_dir: str = "logs"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_hours: int = 24

    class Config:
        env_file = Path(__file__).parent / ".env"


settings = Settings()
```

- [ ] **Step 5: Create backend/services/supabase_client.py**

```python
from supabase import create_client, Client
from config import settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client
```

- [ ] **Step 6: Update .env.example**

Add to `backend/.env.example`:
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

- [ ] **Step 7: Create the schema SQL file and run it in Supabase**

Create `backend/supabase_schema.sql`:
```sql
-- Extends auth.users with display name
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per analysis run (replaces users.json "history" array entries)
CREATE TABLE analysis_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL,
  coverage              JSONB NOT NULL DEFAULT '{}',
  gaps                  JSONB NOT NULL DEFAULT '[]',
  next_steps            JSONB NOT NULL DEFAULT '[]',
  user_skills           JSONB NOT NULL DEFAULT '[]',
  transferability_score INTEGER,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX analysis_history_user_id_idx ON analysis_history(user_id);

-- Keyed by email, stores active session blob (replaces sessions/*.json)
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM call audit log (replaces logs/*.jsonl); user_id nullable for pre-auth calls
CREATE TABLE interaction_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event      JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_logs ENABLE ROW LEVEL SECURITY;

-- Safety-net policies (backend uses service role key which bypasses these)
CREATE POLICY "users_own_profile" ON user_profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "users_own_history" ON analysis_history
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "users_own_logs" ON interaction_logs
  FOR ALL USING (user_id = auth.uid());
```

**Run this SQL in the Supabase dashboard → SQL Editor before continuing.**

- [ ] **Step 8: Run tests to verify they pass**

```
cd backend && python -m pytest tests/test_supabase_client.py -v
```
Expected: 2 tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/supabase_schema.sql backend/services/supabase_client.py \
        backend/requirements.txt backend/config.py \
        backend/.env.example backend/tests/test_supabase_client.py
git commit -m "feat: add Supabase infrastructure — client, schema, config"
```

---

### Task 2: Rewrite auth_service.py

**Files:**
- Modify: `backend/services/auth_service.py` (full rewrite)
- Create: `backend/tests/test_auth_service.py`

**Interfaces:**
- Consumes: `get_supabase() -> Client` from `services.supabase_client`
- Produces (all signatures unchanged):
  - `register_user(email: str, password: str, name: str) -> dict` — `{"id": str, "email": str, "name": str}`
  - `login_user(email: str, password: str) -> dict` — `{"id": str, "email": str, "name": str}`
  - `create_token(user: dict) -> str`
  - `decode_token(token: str) -> dict`
  - `save_analysis(email, role, coverage, gaps, next_steps, user_skills, transferability_score) -> None`
  - `get_history(email: str) -> list`
  - `complete_step(email: str, entry_id: str, step_index: int) -> dict | None`

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_auth_service.py`:
```python
import pytest
from unittest.mock import patch, MagicMock


def _make_sb(user_id="uuid-123", name="Alice"):
    """Supabase mock where all table ops chain to the same `t` mock."""
    sb = MagicMock()
    mock_user = MagicMock()
    mock_user.id = user_id
    sb.auth.admin.create_user.return_value = MagicMock(user=mock_user)
    sb.auth.sign_in_with_password.return_value = MagicMock(user=mock_user)
    t = MagicMock()
    sb.table.return_value = t
    for m in ["select", "insert", "update", "upsert", "eq", "order"]:
        getattr(t, m).return_value = t
    t.execute.return_value = MagicMock(data=[{"id": user_id, "name": name}])
    return sb, t


def test_register_user_creates_auth_and_profile():
    from services.auth_service import register_user
    sb, t = _make_sb("uuid-abc", "Bob")
    with patch("services.auth_service.get_supabase", return_value=sb):
        result = register_user("bob@example.com", "password123", "Bob")
    sb.auth.admin.create_user.assert_called_once()
    t.insert.assert_called_once()
    assert result == {"id": "uuid-abc", "email": "bob@example.com", "name": "Bob"}


def test_register_user_raises_on_duplicate():
    from services.auth_service import register_user
    sb, t = _make_sb()
    sb.auth.admin.create_user.side_effect = Exception("User already registered")
    with patch("services.auth_service.get_supabase", return_value=sb):
        with pytest.raises(ValueError, match="Email already registered"):
            register_user("dup@example.com", "password123", "Dup")


def test_login_user_returns_user_dict():
    from services.auth_service import login_user
    sb, t = _make_sb("uuid-xyz", "Carol")
    t.execute.return_value = MagicMock(data=[{"name": "Carol"}])
    with patch("services.auth_service.get_supabase", return_value=sb):
        result = login_user("carol@example.com", "pass")
    assert result == {"id": "uuid-xyz", "email": "carol@example.com", "name": "Carol"}


def test_login_user_raises_on_bad_credentials():
    from services.auth_service import login_user
    sb, t = _make_sb()
    sb.auth.sign_in_with_password.side_effect = Exception("Invalid credentials")
    with patch("services.auth_service.get_supabase", return_value=sb):
        with pytest.raises(ValueError, match="Invalid email or password"):
            login_user("bad@example.com", "wrong")


def test_save_analysis_inserts_row():
    from services.auth_service import save_analysis
    sb, t = _make_sb("uuid-456")
    t.execute.side_effect = [
        MagicMock(data=[{"id": "uuid-456"}]),  # _get_user_id
        MagicMock(data=None),                   # insert
    ]
    with patch("services.auth_service.get_supabase", return_value=sb):
        save_analysis("user@example.com", "Data Analyst", {"essential": "1/1"}, [], [], [])
    inserted = t.insert.call_args[0][0]
    assert inserted["role"] == "Data Analyst"
    assert inserted["user_id"] == "uuid-456"


def test_get_history_returns_rows():
    from services.auth_service import get_history
    sb, t = _make_sb("uuid-789")
    history_rows = [{"id": "entry-1", "role": "Data Analyst", "user_id": "uuid-789"}]
    t.execute.side_effect = [
        MagicMock(data=[{"id": "uuid-789"}]),  # _get_user_id
        MagicMock(data=history_rows),           # select history
    ]
    with patch("services.auth_service.get_supabase", return_value=sb):
        result = get_history("user@example.com")
    assert result == history_rows


def test_complete_step_toggles_completion():
    from services.auth_service import complete_step
    sb, t = _make_sb("uuid-001")
    entry = {
        "id": "entry-1", "user_id": "uuid-001", "role": "Software Engineer",
        "coverage": {"essential": "0/1"},
        "gaps": [{"skill": "Python", "tier": "Essential"}],
        "next_steps": [{"summary": "Learn Python", "text": "Take a course",
                        "skill": "Python", "tier": "Essential", "completed": False}],
        "user_skills": [],
    }
    t.execute.side_effect = [
        MagicMock(data=[{"id": "uuid-001"}]),  # _get_user_id
        MagicMock(data=[entry]),                # select entry
        MagicMock(data=None),                   # update
    ]
    with patch("services.auth_service.get_supabase", return_value=sb):
        result = complete_step("user@example.com", "entry-1", 0)
    assert result is not None
    assert result["next_steps"][0]["completed"] is True
    assert result["coverage"]["essential"] == "1/1"
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd backend && python -m pytest tests/test_auth_service.py -v
```
Expected: FAIL — old auth_service reads JSON files, mocks don't apply.

- [ ] **Step 3: Rewrite backend/services/auth_service.py**

```python
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from config import settings
from services.supabase_client import get_supabase

ALGORITHM = "HS256"


def _get_user_id(email: str) -> str | None:
    res = get_supabase().table("user_profiles").select("id").eq("email", email).execute()
    return res.data[0]["id"] if res.data else None


def register_user(email: str, password: str, name: str) -> dict:
    sb = get_supabase()
    try:
        auth_resp = sb.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })
    except Exception as e:
        raise ValueError("Email already registered") from e
    user_id = auth_resp.user.id
    sb.table("user_profiles").insert({"id": user_id, "email": email, "name": name}).execute()
    return {"id": user_id, "email": email, "name": name}


def login_user(email: str, password: str) -> dict:
    sb = get_supabase()
    try:
        auth_resp = sb.auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        raise ValueError("Invalid email or password")
    user_id = auth_resp.user.id
    profile = sb.table("user_profiles").select("name").eq("id", user_id).execute()
    name = profile.data[0]["name"] if profile.data else email
    return {"id": user_id, "email": email, "name": name}


def create_token(user: dict) -> str:
    payload = {
        "sub": user["email"],
        "name": user["name"],
        "id": user["id"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        raise ValueError("Invalid or expired token")


def save_analysis(
    email: str,
    role: str,
    coverage: dict,
    gaps: list,
    next_steps: list | None = None,
    user_skills: list | None = None,
    transferability_score: int | None = None,
):
    user_id = _get_user_id(email)
    if not user_id:
        return

    structured_gaps = []
    for g in gaps:
        if isinstance(g, dict):
            structured_gaps.append({"skill": g.get("skill", ""), "tier": g.get("tier", "Important")})
        else:
            structured_gaps.append({"skill": str(g), "tier": "Important"})

    structured_steps = []
    for s in (next_steps or []):
        if hasattr(s, "model_dump"):
            s = s.model_dump()
        if isinstance(s, dict):
            structured_steps.append({
                "summary": s.get("summary", ""),
                "text": s.get("text", ""),
                "skill": s.get("skill", ""),
                "tier": s.get("tier", "Important"),
                "completed": bool(s.get("completed", False)),
            })
        else:
            structured_steps.append({"summary": "", "text": str(s), "skill": "", "tier": "Important", "completed": False})

    row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "role": role,
        "coverage": coverage,
        "gaps": structured_gaps,
        "next_steps": structured_steps,
        "user_skills": user_skills or [],
    }
    if transferability_score is not None:
        row["transferability_score"] = transferability_score

    get_supabase().table("analysis_history").insert(row).execute()


def get_history(email: str) -> list:
    user_id = _get_user_id(email)
    if not user_id:
        return []
    res = get_supabase().table("analysis_history").select("*").eq("user_id", user_id).order("created_at").execute()
    return res.data or []


def complete_step(email: str, entry_id: str, step_index: int) -> dict | None:
    user_id = _get_user_id(email)
    if not user_id:
        return None
    sb = get_supabase()
    res = sb.table("analysis_history").select("*").eq("id", entry_id).eq("user_id", user_id).execute()
    if not res.data:
        return None

    entry = res.data[0]
    steps = entry.get("next_steps", [])
    if step_index < 0 or step_index >= len(steps):
        return None

    step = steps[step_index]
    if not isinstance(step, dict):
        step = {"text": str(step), "skill": "", "completed": False}
        steps[step_index] = step

    was_completed = bool(step.get("completed", False))
    step["completed"] = not was_completed
    skill = step.get("skill", "")

    if skill:
        user_skills = entry.get("user_skills", [])
        gaps = entry.get("gaps", [])
        if not was_completed:
            if skill not in user_skills:
                user_skills.append(skill)
                entry["user_skills"] = user_skills
            gap_tier = None
            new_gaps = []
            for g in gaps:
                if isinstance(g, dict):
                    if g.get("skill") == skill:
                        gap_tier = g.get("tier", "Important")
                    else:
                        new_gaps.append(g)
                else:
                    if str(g) != skill:
                        new_gaps.append(g)
                    else:
                        gap_tier = "Important"
            entry["gaps"] = new_gaps
            if gap_tier:
                _adjust_coverage(entry, gap_tier, delta=+1)
        else:
            if skill in user_skills:
                user_skills.remove(skill)
                entry["user_skills"] = user_skills
            gap_tier = step.get("tier", "Important")
            gaps.append({"skill": skill, "tier": gap_tier})
            entry["gaps"] = gaps
            _adjust_coverage(entry, gap_tier, delta=-1)

    sb.table("analysis_history").update({
        "next_steps": steps,
        "gaps": entry["gaps"],
        "user_skills": entry["user_skills"],
        "coverage": entry["coverage"],
    }).eq("id", entry_id).execute()
    return entry


def _adjust_coverage(entry: dict, tier: str, delta: int):
    tier_key = {"Essential": "essential", "Important": "important", "Nice-to-have": "nice_to_have"}.get(tier)
    if not tier_key:
        return
    cov = entry.get("coverage", {})
    raw = str(cov.get(tier_key, "0/0"))
    parts = raw.split("/")
    if len(parts) != 2:
        return
    try:
        have, total = int(parts[0]), int(parts[1])
        entry["coverage"][tier_key] = f"{max(0, min(have + delta, total))}/{total}"
    except ValueError:
        pass
```

- [ ] **Step 4: Run auth_service tests to verify they pass**

```
cd backend && python -m pytest tests/test_auth_service.py -v
```
Expected: All 7 tests PASS

- [ ] **Step 5: Run existing endpoint tests to check for regressions**

```
cd backend && python -m pytest tests/test_endpoints.py -v
```
Expected: All tests PASS. They mock `decode_token` at the router level and never call `_load_users`, so they are unaffected.

- [ ] **Step 6: Commit**

```bash
git add backend/services/auth_service.py backend/tests/test_auth_service.py
git commit -m "feat: rewrite auth_service to use Supabase Auth and PostgreSQL"
```

---

### Task 3: Rewrite session_store.py

**Files:**
- Modify: `backend/services/session_store.py` (full rewrite)
- Create: `backend/tests/test_session_store.py`

**Interfaces:**
- Consumes: `get_supabase() -> Client` from `services.supabase_client`
- Produces (unchanged signatures):
  - `save_session(session_id: str, data: dict) -> None`
  - `load_session(session_id: str) -> dict | None`

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_session_store.py`:
```python
from unittest.mock import patch, MagicMock


def _make_sb():
    sb = MagicMock()
    t = MagicMock()
    sb.table.return_value = t
    for m in ["select", "upsert", "eq"]:
        getattr(t, m).return_value = t
    t.execute.return_value = MagicMock(data=None)
    return sb, t


def test_save_session_upserts_data():
    from services.session_store import save_session
    sb, t = _make_sb()
    with patch("services.session_store.get_supabase", return_value=sb):
        save_session("user@example.com", {"resume_text": "hello"})
    t.upsert.assert_called_once()
    payload = t.upsert.call_args[0][0]
    assert payload["session_id"] == "user@example.com"
    assert payload["data"] == {"resume_text": "hello"}
    assert "updated_at" in payload


def test_load_session_returns_data():
    from services.session_store import load_session
    sb, t = _make_sb()
    t.execute.return_value = MagicMock(data=[{"data": {"resume_text": "loaded"}}])
    with patch("services.session_store.get_supabase", return_value=sb):
        result = load_session("user@example.com")
    assert result == {"resume_text": "loaded"}


def test_load_session_returns_none_when_missing():
    from services.session_store import load_session
    sb, t = _make_sb()
    t.execute.return_value = MagicMock(data=None)
    with patch("services.session_store.get_supabase", return_value=sb):
        result = load_session("ghost@example.com")
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd backend && python -m pytest tests/test_session_store.py -v
```
Expected: FAIL — old file-based session_store doesn't use get_supabase.

- [ ] **Step 3: Rewrite backend/services/session_store.py**

```python
from datetime import datetime, timezone
from services.supabase_client import get_supabase


def save_session(session_id: str, data: dict) -> None:
    get_supabase().table("sessions").upsert({
        "session_id": session_id,
        "data": data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def load_session(session_id: str) -> dict | None:
    res = (
        get_supabase()
        .table("sessions")
        .select("data")
        .eq("session_id", session_id)
        .execute()
    )
    return res.data[0]["data"] if res.data else None
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd backend && python -m pytest tests/test_session_store.py -v
```
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/services/session_store.py backend/tests/test_session_store.py
git commit -m "feat: rewrite session_store to use Supabase PostgreSQL"
```

---

### Task 4: Rewrite interaction_logger.py

**Files:**
- Modify: `backend/services/interaction_logger.py` (full rewrite)
- Create: `backend/tests/test_interaction_logger.py`

**Interfaces:**
- Consumes: `get_supabase() -> Client` from `services.supabase_client`
- Produces (unchanged signature — all existing callers in services/ and routers/ need no changes):
  - `log_interaction(session_id: str, call_type: str, prompt: str, response: str) -> None`
  - `session_id` is the user's email; UUID is resolved internally with a `user_profiles` lookup

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_interaction_logger.py`:
```python
from unittest.mock import patch, MagicMock


def _make_sb():
    sb = MagicMock()
    t = MagicMock()
    sb.table.return_value = t
    for m in ["select", "insert", "eq"]:
        getattr(t, m).return_value = t
    return sb, t


def test_log_interaction_inserts_event_with_user_id():
    from services.interaction_logger import log_interaction
    sb, t = _make_sb()
    t.execute.side_effect = [
        MagicMock(data=[{"id": "uuid-log-1"}]),  # user_profiles lookup
        MagicMock(data=None),                      # insert
    ]
    with patch("services.interaction_logger.get_supabase", return_value=sb):
        log_interaction("user@example.com", "skill_extraction", "the prompt", "the response")

    t.insert.assert_called_once()
    payload = t.insert.call_args[0][0]
    assert payload["user_id"] == "uuid-log-1"
    assert payload["session_id"] == "user@example.com"
    assert payload["event"]["type"] == "skill_extraction"
    assert payload["event"]["prompt"] == "the prompt"
    assert payload["event"]["response"] == "the response"
    assert "timestamp" in payload["event"]


def test_log_interaction_uses_null_user_id_when_profile_missing():
    from services.interaction_logger import log_interaction
    sb, t = _make_sb()
    t.execute.side_effect = [
        MagicMock(data=[]),    # empty profile lookup
        MagicMock(data=None),  # insert
    ]
    with patch("services.interaction_logger.get_supabase", return_value=sb):
        log_interaction("ghost@example.com", "role_inference", "p", "r")

    payload = t.insert.call_args[0][0]
    assert payload["user_id"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd backend && python -m pytest tests/test_interaction_logger.py -v
```
Expected: FAIL — old logger writes to files, not Supabase.

- [ ] **Step 3: Rewrite backend/services/interaction_logger.py**

```python
from datetime import datetime, timezone
from services.supabase_client import get_supabase


def log_interaction(session_id: str, call_type: str, prompt: str, response: str) -> None:
    sb = get_supabase()
    profile = sb.table("user_profiles").select("id").eq("email", session_id).execute()
    user_id = profile.data[0]["id"] if profile.data else None

    sb.table("interaction_logs").insert({
        "user_id": user_id,
        "session_id": session_id,
        "event": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": session_id,
            "type": call_type,
            "model": "gpt-4o",
            "prompt": prompt,
            "response": response,
        },
    }).execute()
```

- [ ] **Step 4: Run interaction_logger tests to verify they pass**

```
cd backend && python -m pytest tests/test_interaction_logger.py -v
```
Expected: Both tests PASS

- [ ] **Step 5: Run the full test suite**

```
cd backend && python -m pytest -v
```
Expected: All tests pass. Existing tests in `test_career_ladder.py`, `test_gap_analyser.py`, `test_skill_extractor.py`, `test_skill_ranker.py` already mock `log_interaction` at the function level (`patch("services.X.log_interaction")`), so they are unaffected by the rewrite.

- [ ] **Step 6: Commit**

```bash
git add backend/services/interaction_logger.py backend/tests/test_interaction_logger.py
git commit -m "feat: rewrite interaction_logger to write to Supabase PostgreSQL"
```

---

### Task 5: Cleanup

**Files:**
- Delete: `backend/data/users.json`
- Delete: `backend/sessions/*.json`
- Delete: `backend/logs/*.jsonl` (preserve `logs/sample/` directory)
- Delete: `backend/services/user_store.py`
- Modify: `backend/.gitignore`

**Interfaces:** None — cleanup only.

- [ ] **Step 1: Delete old data files**

```bash
rm backend/data/users.json
rm backend/sessions/*.json
rm backend/logs/*.jsonl
rm backend/services/user_store.py
```

Verify nothing important was removed:
```bash
ls backend/data/
# Expected: __init__.py  skillsfuture/  skillsfuture_loader.py

ls backend/sessions/
# Expected: .gitkeep (or empty)

ls backend/logs/
# Expected: .gitkeep  sample/
```

- [ ] **Step 2: Add protections to .gitignore**

Open `backend/.gitignore` and add:
```
# User data — never commit
data/users.json
sessions/*.json
logs/*.jsonl
```

- [ ] **Step 3: Run the full test suite one final time**

```
cd backend && python -m pytest -v
```
Expected: All tests pass. No test imports the deleted files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove file-based data stores, protect .gitignore from user data"
```
