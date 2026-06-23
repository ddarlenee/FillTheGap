### Task 2: Backend LLM — update prompt and parsing

**Files:**
- Modify: `backend/services/career_ladder.py`
- Modify: `backend/tests/test_career_ladder.py`

**Interfaces:**
- Consumes: `CareerNextStep` from `backend/models/schemas.py` (Task 1)
- Produces: `CareerRung.next_steps` populated from LLM JSON for the first rung; empty list for subsequent rungs

- [ ] **Step 1: Update the import in `career_ladder.py`**

In `backend/services/career_ladder.py`, change line 4:

```python
from models.schemas import ProgressRequest, ProgressResponse, CareerRung, Milestone
```

to:

```python
from models.schemas import ProgressRequest, ProgressResponse, CareerRung, CareerNextStep, Milestone
```

- [ ] **Step 2: Replace `SYSTEM_PROMPT` in `career_ladder.py`**

Replace the entire `SYSTEM_PROMPT` string (lines 10–29) with:

```python
SYSTEM_PROMPT = """You are a career progression specialist with deep knowledge of Singapore's job market and SkillsFuture frameworks.
Given a current role and the user's skills, infer a realistic vertical career progression ladder (2–4 future roles above the current one).

For each future role provide:
- role: exact role title
- transferability_score: 0–100 (how much of user's current skills transfer)
- skill_delta: list of new skills needed that the user doesn't currently have
- why_good_fit: one sentence explaining transferability from user's background
- milestones: 2–4 concrete, specific steps to reach THIS role from the previous rung (empty list for distant future roles)
- next_steps: for the FIRST (closest) rung ONLY, provide 1–2 actionable learning steps per skill_delta item. Each step must reference a specific platform, course, project, or tool. Leave next_steps as [] for all other rungs.

Each next_step object:
- skill: the skill_delta item this step addresses (must match the skill_delta entry exactly)
- action: one sentence describing the specific learning action (e.g. "Complete the MLOps Fundamentals course on Coursera")
- summary: a version of action in 8 words or fewer (e.g. "MLOps Fundamentals — Coursera")

Also identify the long_term_destination: the most senior role this path leads toward.

Return ONLY valid JSON:
{
  "long_term_destination": "...",
  "ladder": [
    {
      "role": "...",
      "transferability_score": 0,
      "skill_delta": ["Skill A", "Skill B"],
      "why_good_fit": "...",
      "milestones": [{"description": "...", "skill_focus": "..."}],
      "next_steps": [
        {"skill": "Skill A", "action": "Complete the Skill A Fundamentals course on Coursera", "summary": "Skill A Fundamentals — Coursera"},
        {"skill": "Skill A", "action": "Build a project applying Skill A end-to-end", "summary": "Build Skill A project"},
        {"skill": "Skill B", "action": "Follow the official Skill B tutorial and implement the sample project", "summary": "Skill B official tutorial"}
      ]
    },
    {
      "role": "...",
      "transferability_score": 0,
      "skill_delta": ["Skill C"],
      "why_good_fit": "...",
      "milestones": [],
      "next_steps": []
    }
  ]
}
Order ladder from closest to most distant future role."""
```

- [ ] **Step 3: Update the parsing loop in `build_career_ladder`**

In `backend/services/career_ladder.py`, replace the `ladder = [...]` list comprehension (lines 54–63) with:

```python
ladder = [
    CareerRung(
        role=r["role"],
        transferability_score=r["transferability_score"],
        skill_delta=r["skill_delta"],
        why_good_fit=r["why_good_fit"],
        milestones=[Milestone(**m) for m in r.get("milestones", [])],
        next_steps=[CareerNextStep(**s) for s in r.get("next_steps", [])],
    )
    for r in data["ladder"]
]
```

- [ ] **Step 4: Update `MOCK_LADDER_JSON` in the test file**

In `backend/tests/test_career_ladder.py`, replace `MOCK_LADDER_JSON` (lines 7–28) with:

```python
MOCK_LADDER_JSON = json.dumps({
    "long_term_destination": "Principal Data Scientist",
    "ladder": [
        {
            "role": "Senior Data Analyst",
            "transferability_score": 72,
            "skill_delta": ["Machine Learning", "Stakeholder Management"],
            "why_good_fit": "High transferability from your analytics background",
            "milestones": [
                {"description": "Lead one end-to-end analytics project", "skill_focus": "Leadership"},
                {"description": "Complete Andrew Ng ML course", "skill_focus": "Machine Learning"},
            ],
            "next_steps": [
                {"skill": "Machine Learning", "action": "Complete Andrew Ng's Machine Learning Specialization on Coursera", "summary": "Andrew Ng ML — Coursera"},
                {"skill": "Machine Learning", "action": "Implement a classification model on a Kaggle dataset and publish results", "summary": "Kaggle classification project"},
                {"skill": "Stakeholder Management", "action": "Complete the Stakeholder Management course on LinkedIn Learning", "summary": "Stakeholder Management — LinkedIn Learning"}
            ]
        },
        {
            "role": "Data Science Manager",
            "transferability_score": 45,
            "skill_delta": ["Team Leadership", "Budget Management"],
            "why_good_fit": "Natural progression from senior analytics roles",
            "milestones": [],
            "next_steps": []
        }
    ]
})
```

- [ ] **Step 5: Add tests for `next_steps` parsing**

In `backend/tests/test_career_ladder.py`, add after the existing tests:

```python
def test_build_career_ladder_next_steps_on_immediate_next():
    req = ProgressRequest(session_id="test-session", current_role="Data Analyst", user_skill_names=["Python", "SQL"])
    with patch("services.career_ladder.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_LADDER_JSON)):
        with patch("services.career_ladder.log_interaction"):
            with patch("services.career_ladder.skillsfuture.get_skills_for_role", return_value=[]):
                result = build_career_ladder(req, "test-session")
    assert len(result.immediate_next.next_steps) == 3
    assert result.immediate_next.next_steps[0].skill == "Machine Learning"
    assert result.immediate_next.next_steps[0].action == "Complete Andrew Ng's Machine Learning Specialization on Coursera"
    assert result.immediate_next.next_steps[0].summary == "Andrew Ng ML — Coursera"

def test_build_career_ladder_full_ladder_next_steps_empty():
    req = ProgressRequest(session_id="test-session", current_role="Data Analyst", user_skill_names=["Python"])
    with patch("services.career_ladder.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_LADDER_JSON)):
        with patch("services.career_ladder.log_interaction"):
            with patch("services.career_ladder.skillsfuture.get_skills_for_role", return_value=[]):
                result = build_career_ladder(req, "test-session")
    assert result.full_ladder[0].next_steps == []
```

- [ ] **Step 6: Run the full test suite**

```bash
pytest tests/test_career_ladder.py -v
```

Expected: **all tests PASS**, including the two new ones.

- [ ] **Step 7: Commit**

```bash
git add backend/services/career_ladder.py backend/tests/test_career_ladder.py
git commit -m "feat: update career ladder LLM prompt to generate per-skill next steps"
```

---

