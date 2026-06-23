### Task 1: Backend schema — add `CareerNextStep` and update `CareerRung`

**Files:**
- Modify: `backend/models/schemas.py`
- Test: `backend/tests/test_career_ladder.py`

**Interfaces:**
- Produces: `CareerNextStep` Pydantic model with fields `skill: str`, `action: str`, `summary: str = ""`
- Produces: `CareerRung.next_steps: list[CareerNextStep] = []`

- [ ] **Step 1: Add `CareerNextStep` model to `schemas.py`**

Open `backend/models/schemas.py`. After the `Milestone` class (line 51), insert:

```python
class CareerNextStep(BaseModel):
    skill: str       # matches a skill_delta entry exactly
    action: str      # full actionable sentence, e.g. "Complete MLOps Fundamentals on Coursera"
    summary: str = ""  # ≤8-word version, e.g. "MLOps Fundamentals — Coursera"
```

- [ ] **Step 2: Add `next_steps` to `CareerRung`**

In `backend/models/schemas.py`, update the `CareerRung` class to:

```python
class CareerRung(BaseModel):
    role: str
    transferability_score: int  # 0–100
    skill_delta: list[str]
    why_good_fit: str
    milestones: list[Milestone]
    next_steps: list[CareerNextStep] = []
```

- [ ] **Step 3: Write a failing test for the new model**

In `backend/tests/test_career_ladder.py`, add this test at the bottom of the file (before running anything):

```python
def test_career_next_step_model():
    from models.schemas import CareerNextStep
    step = CareerNextStep(skill="MLOps", action="Complete MLOps Fundamentals on Coursera", summary="MLOps Fundamentals — Coursera")
    assert step.skill == "MLOps"
    assert step.action == "Complete MLOps Fundamentals on Coursera"
    assert step.summary == "MLOps Fundamentals — Coursera"

def test_career_rung_next_steps_defaults_empty():
    from models.schemas import CareerRung, Milestone
    rung = CareerRung(
        role="Senior Data Analyst",
        transferability_score=72,
        skill_delta=["MLOps"],
        why_good_fit="Good fit",
        milestones=[],
    )
    assert rung.next_steps == []
```

- [ ] **Step 4: Run tests to confirm they fail**

From the `backend/` directory:
```bash
cd backend && pytest tests/test_career_ladder.py::test_career_next_step_model tests/test_career_ladder.py::test_career_rung_next_steps_defaults_empty -v
```

Expected: **FAIL** — `ImportError: cannot import name 'CareerNextStep'` (because the model doesn't exist yet).

- [ ] **Step 5: Run tests again to confirm they pass**

The models were written in Step 1–2, so they should already exist. Run:

```bash
pytest tests/test_career_ladder.py::test_career_next_step_model tests/test_career_ladder.py::test_career_rung_next_steps_defaults_empty -v
```

Expected: **PASS** for both.

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
pytest tests/test_career_ladder.py -v
```

Expected: all existing tests **PASS** (existing tests use `MOCK_LADDER_JSON` which has no `next_steps` key; the `= []` default means Pydantic will tolerate its absence).

- [ ] **Step 7: Commit**

```bash
git add backend/models/schemas.py backend/tests/test_career_ladder.py
git commit -m "feat: add CareerNextStep model and next_steps field to CareerRung"
```

---

