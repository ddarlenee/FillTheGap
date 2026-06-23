# Auth & User Accounts — Design Spec
**Date:** 2026-06-22
**Feature:** Login / Registration + PostgreSQL user persistence

---

## Problem Statement

Users currently analyse their resume anonymously. Results are stored in per-session JSON files on disk but are not linked to any identity, making them inaccessible across devices or after clearing the browser. This feature adds optional user accounts so that past analyses and career progress can be retrieved on any device.

---

## User Flow

1. User uploads resume and completes gap analysis as before (no login required).
2. On the Gap Dashboard, a **"Save your results"** banner is shown to unauthenticated users.
3. Clicking it opens an **AuthModal** with Login and Register tabs.
4. **Register:** enter email + password → account created → current session linked → modal closes, banner replaced with "Saved ✓".
5. **Login:** enter email + password → JWT issued → current session linked → same result.
6. Logged-in users see a **Navbar** with their email and a "My Results" link.
7. **My Results page** lists all past sessions: role analysed, date, coverage score. Each row restores that session in the Gap Dashboard.

---

## Architecture

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `backend/db/engine.py` | SQLAlchemy engine + session factory |
| `backend/db/models.py` | `User` and `UserSession` ORM models |
| `backend/services/auth_service.py` | Password hashing (bcrypt), JWT create/verify |
| `backend/routers/auth.py` | All `/api/auth/*` endpoints |
| `backend/alembic/` | Migration scripts (initial schema) |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/store/useAuthStore.ts` | Zustand slice: user, token, setAuth, logout |
| `frontend/src/components/AuthModal.tsx` | Login + Register tabbed modal |
| `frontend/src/components/Navbar.tsx` | Top bar: email + My Results (auth) or Save Results (anon) |
| `frontend/src/pages/MyResultsPage.tsx` | Protected page listing user's past sessions |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `frontend/src/api/client.ts` | Axios interceptor: attach `Bearer` token when present |
| `frontend/src/App.tsx` | Add `/my-results` route; wrap with Navbar |
| `frontend/src/pages/GapDashboardPage.tsx` | Add "Save your results" banner for anon users |

---

## Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);
```

`user_sessions.session_id` matches the existing UUID used throughout the app. No changes to existing session JSON files on disk — `user_sessions` is purely a mapping table.

---

## API Endpoints

All endpoints are under `/api/auth/`.

| Method | Path | Auth | Request body | Response |
|--------|------|------|--------------|----------|
| POST | `/register` | No | `{email, password}` | `{token, user: {id, email}}` |
| POST | `/login` | No | `{email, password}` | `{token, user: {id, email}}` |
| GET | `/me` | JWT | — | `{id, email}` |
| POST | `/claim-session` | JWT | `{session_id}` | `{ok: true}` |
| GET | `/sessions` | JWT | — | `[{session_id, role, date, coverage_score}]` |

### Validation rules
- Email: must be valid format
- Password: minimum 8 characters
- Duplicate email on register → 409 Conflict
- Wrong password on login → 401 Unauthorized (generic message, no hint)

---

## Auth Implementation

### Password hashing
`passlib[bcrypt]` with default cost factor (12). `CryptContext(schemes=["bcrypt"])`.

### JWT
- Library: `python-jose[cryptography]`
- Algorithm: HS256
- Expiry: 7 days
- Secret: `JWT_SECRET` env var (added to `.env` and `.env.example`)
- Payload: `{"sub": user_id, "exp": ...}`

### Token transport
- Frontend stores token in `localStorage` under key `"auth_token"`
- Axios interceptor in `client.ts` reads from `useAuthStore` and attaches `Authorization: Bearer <token>` to every request
- FastAPI dependency `get_current_user` decodes token, looks up user in DB, raises 401 if invalid

---

## Frontend State

### `useAuthStore` (Zustand)
```ts
interface AuthState {
  user: { id: string; email: string } | null
  token: string | null
  setAuth: (user: AuthState['user'], token: string) => void
  logout: () => void
}
```
On `setAuth`: writes token to `localStorage`.
On `logout`: clears store + `localStorage`.
On app load (`main.tsx`): reads token from `localStorage` to rehydrate store.

---

## My Results Page

- Route: `/my-results` — redirects to `/` if not logged in
- Calls `GET /api/auth/sessions` → list of sessions
- Each row shows: role analysed, date, essential coverage score (e.g. "7/12")
- Clicking a row calls `GET /api/session/{session_id}`, restores `analysisResult` in Zustand, navigates to `/gap-dashboard`

---

## Security Notes

- Passwords never logged, never returned in any response
- Generic error message for wrong credentials (no hint whether email or password was wrong)
- JWT secret must be set in production — app fails to start without it (pydantic-settings required field)
- `ON DELETE CASCADE` on `user_sessions` — deleting a user removes all session links

---

## Dependencies to Add (requirements.txt)

```
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
sqlalchemy==2.0.30
psycopg2-binary==2.9.9
alembic==1.13.1
```

---

## Out of Scope

- Email verification
- Password reset / forgot password
- OAuth (Google, GitHub)
- Token refresh flow
- Rate limiting on login endpoint
