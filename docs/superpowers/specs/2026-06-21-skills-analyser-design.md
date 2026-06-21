# Skills Analyser — Design Spec
**Date:** 2026-06-21
**Hackathon:** PyCon Singapore 2026 — Track 1: Job and Skills Track
**Stack:** FastAPI (Python) + React

---

## Problem Statement

Current skills assessments are either flat (all skills weighted equally) or biased (self-reported or manager-evaluated). This app addresses both:

1. **Skill ranking** — tier skills into Essential / Important / Nice-to-have for a given role, using SkillsFuture data + LLM reasoning
2. **Portfolio-based skill inference** — extract skills objectively from a user's resume with evidence snippets, removing self-report bias

---

## User

A job seeker or career climber who wants to understand where they stand, what gaps they have, and what concrete steps to take next.

---

## User Flow

1. Upload resume (PDF or paste text)
2. Choose mode:
   - **Target role mode** — pick a role from a searchable dropdown of SkillsFuture roles
   - **Auto-fit mode** — app infers the top 3 best-matching roles from the resume
3. View **Gap Analysis Dashboard**
4. Optionally click "View Career Path" to see the **Career Progression view**

---

## Architecture

### Backend — FastAPI

```
/api
  POST /upload        → parse resume (PyMuPDF), return raw text
  POST /analyse       → run full AI pipeline, return structured result
  GET  /roles         → search/list SkillsFuture roles
  GET  /progress/{role} → career ladder for a given role
```

**Core AI Pipeline (`POST /analyse`):**
1. Resume text → OpenAI: extract skills, each with an evidence snippet (the specific line/project that proves the skill)
2. Load SkillsFuture skill list for the target role
3. OpenAI: rank those skills into tiers (Essential / Important / Nice-to-have) using role context
4. Gap analysis: diff extracted user skills against tiered role skills
5. OpenAI: generate prioritised, concrete next steps to close top gaps

**Career Progression Pipeline (`GET /progress/{role}`):**
1. Load SkillsFuture skill profile for the role
2. OpenAI: infer vertical ladder (junior → current → next → long-term) from role names and skill overlap
3. For each rung: pull skill requirements from SkillsFuture, compute transferability score against user's current profile
4. OpenAI: generate milestone breakdowns between current and next rung

**Data Layer:**
- SkillsFuture CSVs loaded at startup into in-memory dicts (no database needed)
- All OpenAI calls logged to a per-session JSONL file (satisfies mandatory interaction log submission)

### Frontend — React

Four views, navigated sequentially:

| View | Purpose |
|------|---------|
| Upload | Resume upload (PDF drag-drop or text paste) + mode selection |
| Role Selection | Searchable role dropdown (target mode) or top-3 inferred role cards (auto-fit mode) |
| Gap Dashboard | Three-column layout: Your Skills / Role Requirements / Gap Summary |
| Career Progression | Progressive disclosure career map |

**State management:** React Query for async API calls, Zustand for global user session (resume + selected role + analysis result).

**Visualisations:** Recharts for skill radar/bar charts; custom CSS timeline for career ladder.

---

## Gap Analysis Dashboard

Three-column layout:

- **Your Skills** — inferred skills from resume, each with:
  - Confidence badge (High / Medium / Low)
  - Expandable evidence snippet showing the exact resume text that supports the skill
- **Role Requirements** — skills tiered and colour-coded:
  - 🔴 Essential
  - 🟡 Important
  - 🟢 Nice-to-have
- **Gap Summary** — skill coverage score (e.g. "7/12 Essential skills met") + prioritised list of gaps to close first

---

## Career Progression View

Triggered by "View Career Path" button on the Gap Dashboard.

### Primary Card — Immediate Next Role
- Role title + transferability percentage
- Skill delta: what new skills are needed to reach this role
- 3–5 milestone steps to get there (concrete, actionable)

### Full Career Ladder (Progressive Disclosure)
- Rendered as a vertical timeline
- Current role highlighted; next role shown as the primary call-to-action
- All higher roles rendered faint/greyed with a guiding label (e.g. *"This role is a key stepping stone toward becoming a Principal Architect"*)
- Long-term destination subtly highlighted at the top as a north-star goal

### Interactions
- **Role tooltip** — clicking any future role shows a popover with:
  - Transferability score from user's current profile
  - 1-line LLM-generated "why this fits you" rationale
- **Milestone chips** — clickable steps between current and next role
- **Skill radar chart** — overlays user's current profile vs. next role's requirements to visualise the shape of the gap

---

## AI Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Skill extraction | OpenAI with evidence anchoring | Forces the model to cite specific resume text, making output verifiable and bias-resistant |
| Skill tier ranking | SkillsFuture (ground truth list) + OpenAI (ranking weights) | SkillsFuture ensures relevance to Singapore market; LLM adds nuanced prioritisation |
| Career ladder inference | OpenAI from role names + skill overlap | SkillsFuture does not encode explicit progression paths; LLM infers from structure |
| Interaction logging | Per-session JSONL | Satisfies mandatory hackathon submission requirement; transparent audit trail |

---

## Out of Scope (for this hackathon)

- GitHub/LinkedIn profile analysis (resume only)
- Lateral career moves (vertical only)
- User accounts / persistence (session-only)
- Mobile-optimised layout
