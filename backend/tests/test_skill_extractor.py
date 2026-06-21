import json
import pytest
from unittest.mock import MagicMock, patch
from services.skill_extractor import extract_skills
from models.schemas import ExtractedSkill

MOCK_RESPONSE_JSON = json.dumps({
    "skills": [
        {"name": "Python", "evidence": "Built ETL pipelines in Python", "confidence": "High"},
        {"name": "SQL", "evidence": "Queried PostgreSQL databases daily", "confidence": "High"},
        {"name": "Tableau", "evidence": "Created dashboards in Tableau", "confidence": "Medium"},
    ]
})

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_extract_skills_returns_list():
    with patch("services.skill_extractor.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_extractor.log_interaction"):
            result = extract_skills("dummy resume text", "test-session")
    assert isinstance(result, list)
    assert len(result) == 3

def test_extract_skills_fields():
    with patch("services.skill_extractor.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_extractor.log_interaction"):
            result = extract_skills("dummy resume text", "test-session")
    assert result[0].name == "Python"
    assert result[0].confidence == "High"
    assert "ETL" in result[0].evidence
