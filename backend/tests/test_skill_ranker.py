import json
import pytest
from unittest.mock import MagicMock, patch
from services.skill_ranker import rank_skills

MOCK_RESPONSE_JSON = json.dumps({
    "tiered_skills": [
        {"name": "Python", "tier": "Essential", "reasoning": "Core language for data work"},
        {"name": "SQL", "tier": "Essential", "reasoning": "Required for data querying"},
        {"name": "Tableau", "tier": "Nice-to-have", "reasoning": "Useful but not required"},
    ]
})

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_rank_skills_returns_tiered_list():
    with patch("services.skill_ranker.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_ranker.log_interaction"):
            result = rank_skills("Data Analyst", [("Python", None), ("SQL", None), ("Tableau", None)], "test-session")
    assert len(result) == 3
    tiers = {s.tier for s in result}
    assert tiers <= {"Essential", "Important", "Nice-to-have"}

def test_rank_skills_fields():
    with patch("services.skill_ranker.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_RESPONSE_JSON)):
        with patch("services.skill_ranker.log_interaction"):
            result = rank_skills("Data Analyst", [("Python", None), ("SQL", None), ("Tableau", None)], "test-session")
    assert result[0].name == "Python"
    assert result[0].tier == "Essential"
    assert result[0].reasoning != ""
