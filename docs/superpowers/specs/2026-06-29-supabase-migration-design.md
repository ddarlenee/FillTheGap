# Supabase Migration Design

**Date:** 2026-06-29
**Status:** Approved

## Summary

Replace all file-based data storage (JSON files, JSONL logs) and custom auth logic with Supabase Auth + Supabase PostgreSQL. The FastAPI backend remains the single entry point — the frontend is unchanged.

## Architecture

```
Frontend (React)
     │
     │ HTTP (unchanged — same endpoints, same JWT format)
     ▼
FastAPI Backend
     ├─ auth_service.py       →  Supabase Auth (sign_up / sign_in_with_password)
     ├─ session_store.py      →  Supabase PostgreSQL (sessions table)
     ├─ interaction_logger.py →  Supabase PostgreSQL (interaction_logs table)
     └─ supabase_client.py    →  singleton supabase-py client (new file)
```

The backend uses the **service role key** to bypass Row Level Security, appropriate since FastAPI is the trusted auth boundary. The frontend never interacts with Supabase directly.

## Database Schema

Four tables in the `public` schema. Supabase manages `auth.users` automatically.

```sql
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE interaction_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event      JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

`gaps`, `next_steps`, `user_skills`, and `coverage` remain JSONB — they are variable-shape and already structured as JSON in the existing code. They remain queryable via PostgreSQL JSON operators if needed later.

### Row Level Security

RLS is enabled on all four tables. Policy on each: `user_id = auth.uid()`. These exist as a safety net; the FastAPI service role key bypasses them in practice.

## Auth Flow

### Register (`POST /auth/register`)
1. Call `supabase.auth.admin.create_user(email, password, email_confirm=True)`
2. Insert row into `user_profiles` with the returned Supabase user UUID, email, and name
3. Issue FastAPI JWT — same format as today (`sub`, `name`, `id`, `exp`)

### Login (`POST /auth/login`)
1. Call `supabase.auth.sign_in_with_password(email, password)`
2. Fetch `user_profiles` row to get name
3. Issue FastAPI JWT — same format as today

### History & Progress
- `save_analysis` → `INSERT INTO analysis_history`
- `get_history` → `SELECT * FROM analysis_history WHERE user_id = ? ORDER BY created_at`
- `complete_step` → fetch the specific row, mutate `next_steps`/`gaps`/`coverage` in Python, `UPDATE` the row

The JWT payload `id` field will now be the Supabase UUID (real UUID from `auth.users`) rather than the locally-generated one.

## Code Changes

| File | Change |
|------|--------|
| `backend/services/supabase_client.py` | **New** — singleton Supabase client (service role key) |
| `backend/config.py` | Add `supabase_url` and `supabase_service_key` fields |
| `backend/services/auth_service.py` | **Full rewrite** — remove JSON file logic, use Supabase Auth + DB |
| `backend/services/session_store.py` | **Rewrite** — `upsert`/`select` on `sessions` table |
| `backend/services/interaction_logger.py` | **Rewrite** — `insert` into `interaction_logs` table; function signature gains `user_id: str` param since the table links by UUID, not email |
| `backend/requirements.txt` | Add `supabase>=2.0.0` |
| `backend/.env.example` | Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` |
| `backend/.gitignore` | Add `data/users.json`, `sessions/`, `logs/` |

## Files Deleted

All existing test data is discarded (confirmed — these are test accounts only):
- `backend/data/users.json`
- `backend/sessions/*.json`
- `backend/logs/*.jsonl`
- `backend/services/user_store.py` (unused SQLite store)

## Data Migration

None required. All existing accounts are test data and will be deleted. Users will re-register against Supabase Auth from a clean state.

## Prerequisites (manual steps before implementation)

1. Create a Supabase project at supabase.com
2. Run the schema SQL above in the Supabase SQL editor
3. Enable RLS on all four tables and add the `user_id = auth.uid()` policy to each
4. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (service role key, not anon key) into `backend/.env`

## Out of Scope

- Supabase Storage (file uploads still handled by existing FastAPI logic)
- Supabase Realtime
- Frontend Supabase client (`@supabase/supabase-js`)
- Email verification flows
