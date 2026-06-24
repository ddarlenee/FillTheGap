# Interaction Logs

This document links to all evidence of AI-human and human-human collaboration in this project.

---

## AI-Human Interaction Logs

### 1. Live GPT-4o Session Logs — `backend/logs/sample/`

Every GPT-4o call the application makes is logged in real time by [`backend/services/interaction_logger.py`](../../backend/services/interaction_logger.py). Each `.jsonl` file contains one JSON object per line, one per AI call.

**Sample log:** [`backend/logs/sample/sample-session.jsonl`](../../backend/logs/sample/sample-session.jsonl)

This sample shows all five GPT-4o call types from a single user session, in order:

| Call type | What it does |
|---|---|
| `skill_extraction` | Reads the resume and extracts skills with evidence quotes and confidence levels |
| `skill_ranking` | Takes SkillsFuture-grounded skills and tiers them (Essential / Important / Nice-to-have) using a hybrid data + AI approach |
| `gap_analysis` | Semantically matches user skills against role requirements (not just string matching) |
| `next_steps` | Generates one specific, actionable learning recommendation per skill gap |
| `career_ladder` | Builds a personalised career progression path with transferability scores and per-skill learning steps |

Live session logs (with real user data) are stored locally in `backend/logs/` and are excluded from version control to protect user privacy.

---

### 2. AI-Assisted Design & Planning — `docs/superpowers/`

The career stage gating feature was designed and implemented collaboratively with Claude (Anthropic) as a coding assistant. The full design conversation is captured in:

- **[Design spec](../superpowers/specs/2026-06-24-career-stage-gating-design.md)** — requirements, architecture, UI design, and edge cases produced through iterative AI-human dialogue
- **[Implementation plan](../superpowers/plans/2026-06-24-career-stage-gating.md)** — step-by-step plan including complete code, test cases, and commands, generated from the approved spec

These documents reflect the AI-human design loop: the human defined goals and constraints, the AI proposed approaches, the human approved or redirected, and the AI produced artefacts.

---

## Human-Human Collaboration
Soon Zi Ni Darlene
- ideation
- implementation of baseline code
- your skills section
- role requirements 
- career stage gating
- role readiness 
- coverage score
- extraction of pdf to text implementation
- code testing

ALicia Goh Jin Bao
- semantic gap matching
- improved UI
- code testing

Suh Sumin
- login & authentication
- overall competency chart

### Git commit history

All contributions are tracked in the repository's commit history. Run `git log --oneline` to see the full record of who built what and when.

Key commits:
- `d784a11` — Role requirements with resume evidence quotes; competency chart; SkillsFuture-based skill ranking; history with next-step checkboxes
- `b42064a` — Role readiness bar; next-step completion updates coverage score; multi-stage career advancement
- `ce914ed` — Skills page under profile; career path progression gating
- `6d7c9fd` — Fixed role requirements; competency chart redesign; next-stage flow
- `22550ac` — Career stage gating: per-skill next-step checklists; locked future stages

### User testing

The app was tested by multiple users (evidenced by 14 distinct session logs generated on 24 June 2026). Testing covered:
- Different resume types and roles
- Edge cases: empty skill delta, partial gap coverage, multi-stage career paths
- Feedback incorporated into UI iterations (see commit history above)
