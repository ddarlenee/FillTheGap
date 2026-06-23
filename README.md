# FillTheGap

**A Singapore job market skills gap analyser that tells professionals exactly what they're missing — and what to do about it.**

---

## The Problem (Track 1)

Singapore's workforce faces a persistent skills gap challenge. Professionals know they want to advance but don't know:

- Which of their existing skills actually transfer to their target role
- What new skills are essential vs. just nice to have
- What concrete steps to take to bridge the gap
- How far they are from being role-ready

Existing tools give generic career advice. SkillsFuture publishes detailed, role-specific competency frameworks — but they're buried in spreadsheets no one reads.

---

## The Solution

FillTheGap connects your resume to Singapore's SkillsFuture dataset and gives you a personalised, actionable skills gap analysis in ~30 seconds.

1. **Upload your resume** (PDF or paste text)
2. **AI extracts your skills** with evidence from your own resume text
3. **Matched against SkillsFuture** role requirements, tiered by importance
4. **Get a gap report**: what you have, what you're missing, what to do next
5. **Follow your career ladder**: see the full path to your long-term goal, one stage at a time
6. **Track your progress**: tick off learning goals in History as you acquire skills

---

## Features

| Feature | Description |
|---|---|
| Resume parsing | PDF upload or text paste; GPT-4o extracts skills with resume quotations as evidence |
| Role matching | Automatically identifies top 3 matching roles from SkillsFuture dataset |
| Tiered gap analysis | Classifies each role skill as Essential / Important / Nice-to-have |
| Competency radar chart | Visual overview of skill coverage across all three tiers |
| Evidence-backed skills | Each matched skill shows the exact resume quote that demonstrates it |
| Personalised next steps | One actionable step per gap skill (platform + action, expandable for detail) |
| Role readiness bar | Starts at your real skill-transfer %, reaches 100% only when all required steps are done |
| Career progression ladder | Multi-stage path to your long-term goal with transferability scores per rung |
| History & progress tracking | Every analysis saved; tick off next steps to unlock skills and advance stages |
| My Skills page | Unified view of all skills accumulated across career stages |
| Authentication | Email + password with JWT sessions |

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Framework | [FastAPI](https://fastapi.tiangolo.com/) 0.111 |
| Language | Python 3.12 |
| AI / LLM | OpenAI GPT-4o (skill extraction, gap matching, next steps, career progression) |
| Skills dataset | SkillsFuture Singapore (loaded from Excel via pandas) |
| PDF parsing | PyMuPDF |
| Auth | JWT (`python-jose`) + bcrypt password hashing (`passlib`) |
| Data store | JSON flat-file (`data/users.json`) |
| Testing | pytest + httpx |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 |
| Routing | React Router v7 |
| State | Zustand 5 (persisted session) |
| Server state | TanStack Query v5 |
| Charts | Recharts 3 |
| HTTP | Axios |

---

## Project Structure

```
pycon26/
├── backend/
│   ├── data/
│   │   ├── skillsfuture_loader.py   # loads the SkillsFuture Excel dataset
│   │   └── users.json               # user accounts + history (flat-file DB)
│   ├── models/
│   │   └── schemas.py               # Pydantic request/response models
│   ├── routers/
│   │   ├── auth.py                  # register, login, history, career-stage save
│   │   ├── analyse.py               # resume → skills gap analysis
│   │   ├── progress.py              # career progression ladder
│   │   ├── upload.py                # PDF → text extraction
│   │   └── roles.py                 # SkillsFuture role search
│   ├── services/
│   │   ├── skill_extractor.py       # GPT-4o: resume → ExtractedSkill[]
│   │   ├── skill_ranker.py          # GPT-4o: rank role skills by tier
│   │   ├── gap_analyser.py          # GPT-4o: match user skills to role requirements
│   │   ├── next_steps.py            # GPT-4o: generate actionable next steps per gap
│   │   ├── auth_service.py          # user store, JWT, history persistence
│   │   └── session_store.py         # in-memory session cache
│   ├── main.py
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── api/                     # typed API clients (auth, analyse, progress)
    │   ├── components/
    │   │   ├── CareerLadder.tsx     # multi-stage career path visualisation
    │   │   ├── GapSummary.tsx       # next steps checklist with skill badges
    │   │   ├── TieredSkillList.tsx  # role requirements with match/gap status
    │   │   ├── SkillRadarChart.tsx  # Recharts radar chart (3 tiers)
    │   │   └── Navbar.tsx           # profile dropdown (My Skills, History)
    │   ├── pages/
    │   │   ├── GapDashboardPage.tsx      # main analysis view
    │   │   ├── CareerProgressionPage.tsx # career ladder page
    │   │   ├── HistoryPage.tsx           # progress history + step tracking
    │   │   └── SkillsPage.tsx            # aggregated skills view
    │   ├── store/
    │   │   └── useSessionStore.ts   # Zustand store (token, analysisResult, etc.)
    │   └── types.ts                 # shared TypeScript interfaces
    └── package.json
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- An OpenAI API key (`gpt-4o` access)
- SkillsFuture dataset Excel file (place in `backend/data/`)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Create .env
echo "OPENAI_API_KEY=sk-..." > .env
echo "JWT_SECRET=your-secret-here" >> .env

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## How the Gap Analysis Works

```
Resume PDF/text
       │
       ▼
  skill_extractor     → GPT-4o identifies skills with resume evidence quotes
       │
       ▼
  SkillsFuture data   → fetches required skills for the matched role
       │
       ▼
  skill_ranker        → GPT-4o tiers each role skill (Essential / Important / Nice-to-have)
       │
       ▼
  gap_analyser        → GPT-4o matches user skills to role requirements
       │               (strict mode for career-stage transitions — no semantic over-matching)
       ▼
  next_steps          → GPT-4o generates one actionable step per gap skill
       │
       ▼
  AnalyseResponse     → sent to frontend for display
```

### Career Stage Transitions

When a user advances to the next career stage via the ladder, the analysis **does not re-run GPT gap matching**. Instead, the career rung's `skill_delta` and `transferability_score` are saved directly to History. This guarantees:

- Role readiness never starts at 100%
- The base readiness = actual % of current skills that transfer
- Only completing the required next steps (ticking off checklist items) can push readiness to 100%

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `GET` | `/api/auth/history` | Fetch analysis history |
| `POST` | `/api/auth/history/{id}/complete-step` | Toggle a next-step checkbox |
| `POST` | `/api/auth/history/career-stage` | Save a career-stage progression entry |
| `POST` | `/api/upload` | PDF → extracted text |
| `GET` | `/api/roles` | Search SkillsFuture roles |
| `POST` | `/api/analyse` | Run full gap analysis |
| `POST` | `/api/progress` | Generate career progression ladder |

---

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o) |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRE_HOURS` | Token expiry in hours (default: 24) |

---

## Built for PyConSG 2026 Hackathon
