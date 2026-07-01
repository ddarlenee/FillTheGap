import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_get_roles_returns_list():
    with patch("data.skillsfuture_loader.skillsfuture.get_roles", return_value=["Data Analyst", "Software Engineer"]):
        response = client.get("/api/roles")
    assert response.status_code == 200
    data = response.json()
    assert "roles" in data
    assert isinstance(data["roles"], list)

def test_get_roles_filter():
    with patch("data.skillsfuture_loader.skillsfuture.get_roles", return_value=["Data Analyst"]):
        response = client.get("/api/roles?q=data")
    assert response.status_code == 200
    assert len(response.json()["roles"]) == 1

AUTH_HEADERS = {"Authorization": "Bearer fake-token"}
FAKE_EMAIL = "test@example.com"
FAKE_TOKEN_PAYLOAD = {"sub": FAKE_EMAIL, "name": "Test User", "id": "abc-123"}

def test_analyse_with_target_role():
    """Test /analyse in target-role mode with all services mocked."""
    from unittest.mock import patch, MagicMock
    from models.schemas import (
        ExtractedSkill, TieredSkill, GapItem, CoverageScore, AnalyseResponse
    )
    mock_user_skills = [ExtractedSkill(name="Python", evidence="Built pipelines", confidence="High")]
    mock_tiered = [TieredSkill(name="Python", tier="Essential", reasoning="Core")]
    mock_gaps = []
    mock_coverage = CoverageScore(essential="1/1", important="0/0", nice_to_have="0/0")
    mock_next_steps = [{"text": "Build a portfolio project", "skill": "Python", "tier": "Essential"}]

    with patch("routers.analyse.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.analyse.extract_skills", return_value=mock_user_skills), \
         patch("routers.analyse.rank_skills", return_value=mock_tiered), \
         patch("routers.analyse.analyse_gaps", return_value=(mock_gaps, mock_coverage, {})), \
         patch("routers.analyse.generate_next_steps", return_value=mock_next_steps), \
         patch("routers.analyse.save_session"), \
         patch("routers.analyse.load_session", return_value=None), \
         patch("data.skillsfuture_loader.skillsfuture.get_skills_for_role", return_value=["Python"]):
        response = client.post("/api/analyse", json={
            "resume_text": "Python developer",
            "target_role": "Data Analyst",
        }, headers=AUTH_HEADERS)

    assert response.status_code == 200
    data = response.json()
    assert data["target_roles"] == ["Data Analyst"]
    assert len(data["user_skills"]) == 1

def test_analyse_saves_session():
    """Test that /analyse saves result to session store."""
    from unittest.mock import patch, MagicMock, call
    from models.schemas import ExtractedSkill, TieredSkill, CoverageScore

    mock_user_skills = [ExtractedSkill(name="SQL", evidence="Queried data", confidence="High")]
    mock_tiered = [TieredSkill(name="SQL", tier="Essential", reasoning="Core")]
    mock_coverage = CoverageScore(essential="1/1", important="0/0", nice_to_have="0/0")

    with patch("routers.analyse.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.analyse.extract_skills", return_value=mock_user_skills), \
         patch("routers.analyse.rank_skills", return_value=mock_tiered), \
         patch("routers.analyse.analyse_gaps", return_value=([], mock_coverage, {})), \
         patch("routers.analyse.generate_next_steps", return_value=[]), \
         patch("routers.analyse.save_session") as mock_save, \
         patch("routers.analyse.load_session", return_value=None), \
         patch("data.skillsfuture_loader.skillsfuture.get_skills_for_role", return_value=["SQL"]):
        client.post("/api/analyse", json={
            "resume_text": "SQL developer",
            "target_role": "Data Analyst",
        }, headers=AUTH_HEADERS)

    assert mock_save.called
    call_args = mock_save.call_args
    assert call_args[0][0] == FAKE_EMAIL
    assert "analyse" in call_args[0][1]

def test_infer_top_roles_sends_full_role_list_not_truncated():
    """Regression test: all_roles is alphabetically sorted, so truncating it
    (e.g. all_roles[:80]) before prompting the LLM silently drops most roles
    from consideration and biases matches toward early-alphabet titles."""
    from unittest.mock import patch, MagicMock
    from routers.analyse import _infer_top_roles

    many_roles = [f"Role {i:04d}" for i in range(200)]
    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"roles": ["Role 0150", "Role 0042", "Role 0007"]}'

    with patch("data.skillsfuture_loader.skillsfuture.get_roles", return_value=many_roles), \
         patch("routers.analyse.openai_client.chat.completions.create", return_value=mock_response) as mock_create, \
         patch("routers.analyse.log_interaction"):
        result = _infer_top_roles("some resume text", "user@example.com")

    assert result == ["Role 0150", "Role 0042", "Role 0007"]
    prompt_sent = mock_create.call_args.kwargs["messages"][1]["content"]
    for role in many_roles:
        assert role in prompt_sent

def test_infer_top_roles_raises_instead_of_alphabetical_fallback():
    """A missing 'roles' key must not silently return all_roles[:3] — that
    produced nonsense output unrelated to the resume's actual skills."""
    from unittest.mock import patch, MagicMock
    from routers.analyse import _infer_top_roles

    mock_response = MagicMock()
    mock_response.choices[0].message.content = '{"unexpected_key": []}'

    with patch("data.skillsfuture_loader.skillsfuture.get_roles", return_value=["Zebra Keeper", "Aardvark Handler"]), \
         patch("routers.analyse.openai_client.chat.completions.create", return_value=mock_response), \
         patch("routers.analyse.log_interaction"):
        with pytest.raises(ValueError):
            _infer_top_roles("some resume text", "user@example.com")


CAREER_STAGE_PAYLOAD = {
    "role": "Senior Data Analyst",
    "transferability_score": 80,
    "skill_delta": ["Leadership"],
    "next_steps": [{"skill": "Leadership", "action": "Lead a small project", "summary": "Lead a project"}],
    "user_skills": ["Python", "SQL"],
}


def _entry(role: str, essential="1/1", important="1/1"):
    return {
        "id": f"entry-{role}",
        "role": role,
        "coverage": {"essential": essential, "important": important},
    }


def test_save_career_stage_rejects_stale_cached_progress():
    """The cached ladder's current_role must match the ACTUAL latest history
    entry — otherwise a stale ladder (e.g. restored from before a later
    advance) could offer req.role as 'next' while readiness gets checked
    against the wrong, already-completed entry."""
    from unittest.mock import patch

    history = [_entry("Data Analyst"), _entry("Data Analyst II")]
    stale_progress = {
        "current_role": "Data Analyst",  # stale — true latest is "Data Analyst II"
        "immediate_next": {"role": "Senior Data Analyst"},
    }

    with patch("routers.auth.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.auth.get_history", return_value=history), \
         patch("routers.auth.load_session", return_value={"progress": stale_progress}):
        response = client.post(
            "/api/auth/history/career-stage", json=CAREER_STAGE_PAYLOAD, headers=AUTH_HEADERS
        )

    assert response.status_code == 403
    assert "out of date" in response.json()["detail"]


def test_save_career_stage_blocks_advance_when_current_stage_incomplete():
    """Advancing must be rejected while the true latest stage still has open
    essential/important gaps, even with a matching, non-stale cached ladder."""
    from unittest.mock import patch

    history = [_entry("Data Analyst II", essential="1/2", important="0/1")]
    progress = {
        "current_role": "Data Analyst II",
        "immediate_next": {"role": "Senior Data Analyst"},
    }

    with patch("routers.auth.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.auth.get_history", return_value=history), \
         patch("routers.auth.load_session", return_value={"progress": progress}):
        response = client.post(
            "/api/auth/history/career-stage", json=CAREER_STAGE_PAYLOAD, headers=AUTH_HEADERS
        )

    assert response.status_code == 403
    assert "essential and important" in response.json()["detail"]


def test_save_career_stage_succeeds_when_current_stage_complete():
    """A non-stale ladder plus a fully-complete latest entry should succeed."""
    from unittest.mock import patch

    history = [_entry("Data Analyst II", essential="2/2", important="1/1")]
    progress = {
        "current_role": "Data Analyst II",
        "immediate_next": {"role": "Senior Data Analyst"},
    }

    with patch("routers.auth.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.auth.get_history", return_value=history), \
         patch("routers.auth.load_session", return_value={"progress": progress}), \
         patch("routers.auth.save_analysis") as mock_save:
        response = client.post(
            "/api/auth/history/career-stage", json=CAREER_STAGE_PAYLOAD, headers=AUTH_HEADERS
        )

    assert response.status_code == 200
    assert mock_save.called


def _mock_progress_response():
    from unittest.mock import MagicMock
    from models.schemas import ProgressResponse, CareerRung
    mock = MagicMock()
    mock.model_dump.return_value = {}
    mock.model_copy.side_effect = lambda update: ProgressResponse(
        current_role="Data Analyst II",
        immediate_next=CareerRung(
            role="Senior Data Analyst", transferability_score=80,
            skill_delta=["Leadership"], why_good_fit="fit", milestones=[],
        ),
        full_ladder=[],
        long_term_destination="Director",
        **update,
    )
    return mock


def test_progress_marks_current_role_ready_when_latest_entry_complete():
    """The UI's 'Start now' button should only unlock once the TRUE latest
    history entry (not just whatever role the frontend claims) is fully
    covered on essential and important skills."""
    from unittest.mock import patch

    history = [_entry("Data Analyst II", essential="2/2", important="1/1")]

    with patch("routers.progress.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.progress.build_career_ladder", return_value=_mock_progress_response()), \
         patch("routers.progress.get_history", return_value=history), \
         patch("routers.progress.load_session", return_value={}), \
         patch("routers.progress.save_session"):
        response = client.post(
            "/api/progress",
            json={"current_role": "Data Analyst II", "user_skill_names": ["Python"]},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    assert response.json()["current_role_ready"] is True


def test_progress_marks_current_role_not_ready_when_latest_entry_incomplete():
    from unittest.mock import patch

    history = [_entry("Data Analyst II", essential="1/2", important="0/1")]

    with patch("routers.progress.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.progress.build_career_ladder", return_value=_mock_progress_response()), \
         patch("routers.progress.get_history", return_value=history), \
         patch("routers.progress.load_session", return_value={}), \
         patch("routers.progress.save_session"):
        response = client.post(
            "/api/progress",
            json={"current_role": "Data Analyst II", "user_skill_names": ["Python"]},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    assert response.json()["current_role_ready"] is False


def test_progress_marks_not_ready_when_requested_role_is_stale():
    """If the frontend's claimed current_role doesn't match the true latest
    history entry (a stale cache), never report ready — force a refresh."""
    from unittest.mock import patch

    history = [_entry("Data Analyst II", essential="2/2", important="1/1")]

    with patch("routers.progress.decode_token", return_value=FAKE_TOKEN_PAYLOAD), \
         patch("routers.progress.build_career_ladder", return_value=_mock_progress_response()), \
         patch("routers.progress.get_history", return_value=history), \
         patch("routers.progress.load_session", return_value={}), \
         patch("routers.progress.save_session"):
        response = client.post(
            "/api/progress",
            json={"current_role": "Data Analyst", "user_skill_names": ["Python"]},  # stale role
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 200
    assert response.json()["current_role_ready"] is False
