import pytest
from data.skillsfuture_loader import SkillsFutureLoader

def test_demo_data_loads():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    roles = loader.get_roles()
    assert len(roles) > 0

def test_get_roles_filter():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    results = loader.get_roles("data")
    assert all("data" in r.lower() for r in results)

def test_get_skills_for_role():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    roles = loader.get_roles()
    skills = loader.get_skills_for_role(roles[0])
    assert isinstance(skills, list)
    assert len(skills) > 0

def test_unknown_role_returns_empty():
    loader = SkillsFutureLoader()
    loader.seed_demo_data()
    assert loader.get_skills_for_role("Nonexistent Role XYZ") == []
