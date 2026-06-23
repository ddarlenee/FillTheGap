# Task 2 Report: Backend LLM — update prompt and parsing

## Status: DONE

## Files Changed
- `backend/services/career_ladder.py` — updated import (added `CareerNextStep`), replaced `SYSTEM_PROMPT` with next_steps-aware version, updated parsing loop to populate `next_steps` from JSON
- `backend/tests/test_career_ladder.py` — replaced `MOCK_LADDER_JSON` to include `next_steps` in first rung and `[]` in second rung; added two new tests

## Test Command & Output

```
cd backend && pytest tests/test_career_ladder.py -v
```

```
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\darle\OneDrive\pycon26\backend
cachedir: .pytest_cache
rootdir: C:\Users\darle\OneDrive\pycon26\backend
plugins: anyio-4.14.0, asyncio-1.4.0
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 7 items

tests/test_career_ladder.py::test_build_career_ladder_returns_progress_response PASSED [ 14%]
tests/test_career_ladder.py::test_build_career_ladder_milestone_count PASSED [ 28%]
tests/test_career_ladder.py::test_build_career_ladder_empty_ladder_raises PASSED [ 42%]
tests/test_career_ladder.py::test_career_next_step_model PASSED          [ 57%]
tests/test_career_ladder.py::test_career_rung_next_steps_defaults_empty PASSED [ 71%]
tests/test_career_ladder.py::test_build_career_ladder_next_steps_on_immediate_next PASSED [ 85%]
tests/test_career_ladder.py::test_build_career_ladder_full_ladder_next_steps_empty PASSED [100%]

============================== warnings summary ===============================
config.py:4
  C:\Users\darle\OneDrive\pycon26\backend\config.py:4: PydanticDeprecatedSince20: Support for class-based `config` is deprecated, use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0. See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.13/migration/
    class Settings(BaseSettings):

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================== 7 passed, 1 warning in 3.82s =========================
```

## Commits Made
- `13a8b9e` — feat: update career ladder LLM prompt to generate per-skill next steps

## Self-Review Notes
- All 5 task steps implemented verbatim per brief.
- The `SYSTEM_PROMPT` now instructs the LLM to include `next_steps` only on the first (closest) rung and `[]` for all others.
- Parsing loop uses `r.get("next_steps", [])` so it degrades gracefully if the LLM omits the key.
- `test_build_career_ladder_full_ladder_next_steps_empty` checks `result.full_ladder[0]` (the second ladder entry, "Data Science Manager"), which correctly has `next_steps == []`.
- One pre-existing Pydantic deprecation warning (`class-based config`) in `config.py` — not introduced by this task, no action needed.
- No new pip packages used.
