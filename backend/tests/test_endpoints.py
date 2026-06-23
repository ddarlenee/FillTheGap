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
    mock_next_steps = ["Build a portfolio project"]

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
