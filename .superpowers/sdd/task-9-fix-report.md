# Task 9 Fix Report

## Status: DONE

## Fixes Applied

### Fix 1 — `models/schemas.py`: Added `session_id` to `ProgressRequest`
`ProgressRequest` now has `session_id: str` as its first field, making the field required and consistent with `AnalyseRequest`.

### Fix 2 — `routers/progress.py`: Use `request.session_id` instead of derived ID
Removed the synthetic `"progress-<role>"` key. The router now passes `request.session_id` directly to `build_career_ladder` and `load_session`/`save_session`.

### Fix 3 — `routers/analyse.py`: Merge session data instead of overwriting
- Added `load_session` to the import from `services.session_store`.
- Final save now loads the existing session dict, merges `"analyse"` into it, then saves — preventing other keys (e.g. `"progress"`) from being clobbered.

### Fix 4 — `tests/test_endpoints.py`: Two new mock-based tests
- `test_analyse_with_target_role` — verifies the happy-path response shape for target-role mode.
- `test_analyse_saves_session` — verifies `save_session` is called with the correct session_id and an `"analyse"` key.

### Side-fix — `tests/test_career_ladder.py`: Updated `ProgressRequest` fixtures
All three `ProgressRequest(...)` calls in the career ladder tests now include `session_id="test-session"` to match the updated schema.

## Test Results

```
22 passed, 2 warnings in 9.33s
```

All 22 tests pass (20 pre-existing + 2 new endpoint tests).

## Files Changed

- `backend/models/schemas.py`
- `backend/routers/progress.py`
- `backend/routers/analyse.py`
- `backend/tests/test_endpoints.py`
- `backend/tests/test_career_ladder.py`
