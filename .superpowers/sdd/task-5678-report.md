# Tasks 5-8 Report: OpenAI Service Layer

**Status:** DONE

## Commit
- `0277326` feat: add Tasks 5-8 — OpenAI service layer (skill extractor, ranker, gap analyser, next steps, career ladder)

## Test Summary
16/16 passed (7 prior + 9 new). All new tests written first (RED on ImportError), then services implemented (GREEN).

## Files Created

### Services
- `backend/services/skill_extractor.py` — `extract_skills(resume_text, session_id) -> list[ExtractedSkill]`
- `backend/services/skill_ranker.py` — `rank_skills(role, skills, session_id) -> list[TieredSkill]`
- `backend/services/gap_analyser.py` — `analyse_gaps(user_skills, tiered_role_skills) -> tuple[list[GapItem], CoverageScore]` (pure logic, no OpenAI)
- `backend/services/next_steps.py` — `generate_next_steps(role, gaps, session_id) -> list[str]`
- `backend/services/career_ladder.py` — `build_career_ladder(request, session_id) -> ProgressResponse`

### Tests
- `backend/tests/test_skill_extractor.py` — 2 tests
- `backend/tests/test_skill_ranker.py` — 2 tests
- `backend/tests/test_gap_analyser.py` — 3 tests (gap analysis + next steps)
- `backend/tests/test_career_ladder.py` — 2 tests

## Notes
- `openai` package was not installed; installed `openai==2.43.0` during implementation.
- All OpenAI calls are mocked in tests — no real API calls made.
- One pre-existing Pydantic V2 deprecation warning (class-based config in `config.py`) is unrelated to this task.
