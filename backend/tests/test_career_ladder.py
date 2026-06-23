import json
import pytest
from unittest.mock import MagicMock, patch
from models.schemas import ProgressRequest, ProgressResponse
from services.career_ladder import build_career_ladder

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

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_build_career_ladder_returns_progress_response():
    req = ProgressRequest(session_id="test-session", current_role="Data Analyst", user_skill_names=["Python", "SQL"])
    with patch("services.career_ladder.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_LADDER_JSON)):
        with patch("services.career_ladder.log_interaction"):
            with patch("services.career_ladder.skillsfuture.get_skills_for_role", return_value=[]):
                result = build_career_ladder(req, "test-session")
    assert isinstance(result, ProgressResponse)
    assert result.current_role == "Data Analyst"
    assert result.immediate_next.role == "Senior Data Analyst"
    assert result.long_term_destination == "Principal Data Scientist"

def test_build_career_ladder_milestone_count():
    req = ProgressRequest(session_id="test-session", current_role="Data Analyst", user_skill_names=["Python"])
    with patch("services.career_ladder.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_LADDER_JSON)):
        with patch("services.career_ladder.log_interaction"):
            with patch("services.career_ladder.skillsfuture.get_skills_for_role", return_value=[]):
                result = build_career_ladder(req, "test-session")
    assert len(result.immediate_next.milestones) == 2

def test_build_career_ladder_empty_ladder_raises():
    empty_ladder_json = json.dumps({
        "long_term_destination": "Principal Data Scientist",
        "ladder": []
    })
    req = ProgressRequest(session_id="test-session", current_role="Data Analyst", user_skill_names=["Python"])
    with patch("services.career_ladder.openai_client.chat.completions.create",
               return_value=make_mock_completion(empty_ladder_json)):
        with patch("services.career_ladder.log_interaction"):
            with patch("services.career_ladder.skillsfuture.get_skills_for_role", return_value=[]):
                with pytest.raises(ValueError, match="Career ladder inference returned no results"):
                    build_career_ladder(req, "test-session")

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
