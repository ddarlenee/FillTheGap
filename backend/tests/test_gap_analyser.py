import json
import pytest
from unittest.mock import MagicMock, patch
from models.schemas import ExtractedSkill, TieredSkill, GapItem
from services.gap_analyser import analyse_gaps
from services.next_steps import generate_next_steps

USER_SKILLS = [
    ExtractedSkill(name="Python", evidence="Used Python daily", confidence="High"),
    ExtractedSkill(name="SQL", evidence="Queried databases", confidence="High"),
]
TIERED_SKILLS = [
    TieredSkill(name="Python", tier="Essential", reasoning="Core language"),
    TieredSkill(name="SQL", tier="Essential", reasoning="Data querying"),
    TieredSkill(name="Machine Learning", tier="Important", reasoning="Models"),
    TieredSkill(name="Tableau", tier="Nice-to-have", reasoning="Visualisation"),
]

def test_analyse_gaps_identifies_missing():
    gaps, score = analyse_gaps(USER_SKILLS, TIERED_SKILLS)
    gap_names = [g.skill for g in gaps]
    assert "Machine Learning" in gap_names
    assert "Python" not in gap_names
    assert "SQL" not in gap_names

def test_coverage_score_format():
    _, score = analyse_gaps(USER_SKILLS, TIERED_SKILLS)
    assert "/" in score.essential
    assert "/" in score.important
    assert "/" in score.nice_to_have

MOCK_STEPS_JSON = json.dumps({
    "next_steps": [
        "Complete a Machine Learning course on Coursera",
        "Build a personal project applying ML to a real dataset",
    ]
})

def make_mock_completion(content: str):
    mock = MagicMock()
    mock.choices[0].message.content = content
    return mock

def test_generate_next_steps_returns_list():
    gaps = [GapItem(skill="Machine Learning", tier="Important", action="")]
    with patch("services.next_steps.openai_client.chat.completions.create",
               return_value=make_mock_completion(MOCK_STEPS_JSON)):
        with patch("services.next_steps.log_interaction"):
            result = generate_next_steps("Data Analyst", gaps, "test-session")
    assert isinstance(result, list)
    assert len(result) == 2
