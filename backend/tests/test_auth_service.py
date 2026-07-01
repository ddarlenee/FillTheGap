import pytest
from unittest.mock import patch, MagicMock


def _make_sb(user_id="uuid-123", name="Alice"):
    """Supabase mock where all table ops chain to the same `t` mock."""
    sb = MagicMock()
    mock_user = MagicMock()
    mock_user.id = user_id
    sb.auth.admin.create_user.return_value = MagicMock(user=mock_user)
    sb.auth.sign_in_with_password.return_value = MagicMock(user=mock_user)
    t = MagicMock()
    sb.table.return_value = t
    for m in ["select", "insert", "update", "upsert", "eq", "order"]:
        getattr(t, m).return_value = t
    t.execute.return_value = MagicMock(data=[{"id": user_id, "name": name}])
    return sb, t


def test_register_user_creates_auth_and_profile():
    from services.auth_service import register_user
    sb, t = _make_sb("uuid-abc", "Bob")
    with patch("services.auth_service.get_supabase", return_value=sb):
        result = register_user("bob@example.com", "password123", "Bob")
    sb.auth.admin.create_user.assert_called_once()
    t.insert.assert_called_once()
    assert result == {"id": "uuid-abc", "email": "bob@example.com", "name": "Bob"}


def test_register_user_raises_on_duplicate():
    from services.auth_service import register_user
    sb, t = _make_sb()
    sb.auth.admin.create_user.side_effect = Exception("User already registered")
    with patch("services.auth_service.get_supabase", return_value=sb):
        with pytest.raises(ValueError, match="Email already registered"):
            register_user("dup@example.com", "password123", "Dup")


def test_login_user_returns_user_dict():
    from services.auth_service import login_user
    sb, t = _make_sb("uuid-xyz", "Carol")
    t.execute.return_value = MagicMock(data=[{"name": "Carol"}])
    # sign_in_with_password runs on an isolated client (new_supabase_client) so it
    # can't mutate the shared service-role client's session; profile lookup still
    # goes through get_supabase(). Both are mocked to the same double here.
    with patch("services.auth_service.get_supabase", return_value=sb), \
         patch("services.auth_service.new_supabase_client", return_value=sb):
        result = login_user("carol@example.com", "pass")
    assert result == {"id": "uuid-xyz", "email": "carol@example.com", "name": "Carol"}


def test_login_user_raises_on_bad_credentials():
    from services.auth_service import login_user
    sb, t = _make_sb()
    sb.auth.sign_in_with_password.side_effect = Exception("Invalid credentials")
    with patch("services.auth_service.get_supabase", return_value=sb), \
         patch("services.auth_service.new_supabase_client", return_value=sb):
        with pytest.raises(ValueError, match="Invalid email or password"):
            login_user("bad@example.com", "wrong")


def test_save_analysis_inserts_row():
    from services.auth_service import save_analysis
    sb, t = _make_sb("uuid-456")
    t.execute.side_effect = [
        MagicMock(data=[{"id": "uuid-456"}]),  # _get_user_id
        MagicMock(data=None),                   # insert
    ]
    with patch("services.auth_service.get_supabase", return_value=sb):
        save_analysis("user@example.com", "Data Analyst", {"essential": "1/1"}, [], [], [])
    inserted = t.insert.call_args[0][0]
    assert inserted["role"] == "Data Analyst"
    assert inserted["user_id"] == "uuid-456"


def test_get_history_returns_rows():
    from services.auth_service import get_history
    sb, t = _make_sb("uuid-789")
    history_rows = [{"id": "entry-1", "role": "Data Analyst", "user_id": "uuid-789"}]
    t.execute.side_effect = [
        MagicMock(data=[{"id": "uuid-789"}]),  # _get_user_id
        MagicMock(data=history_rows),           # select history
    ]
    with patch("services.auth_service.get_supabase", return_value=sb):
        result = get_history("user@example.com")
    assert result == history_rows


def test_complete_step_toggles_completion():
    from services.auth_service import complete_step
    sb, t = _make_sb("uuid-001")
    entry = {
        "id": "entry-1", "user_id": "uuid-001", "role": "Software Engineer",
        "coverage": {"essential": "0/1"},
        "gaps": [{"skill": "Python", "tier": "Essential"}],
        "next_steps": [{"summary": "Learn Python", "text": "Take a course",
                        "skill": "Python", "tier": "Essential", "completed": False}],
        "user_skills": [],
    }
    t.execute.side_effect = [
        MagicMock(data=[{"id": "uuid-001"}]),  # _get_user_id
        MagicMock(data=[entry]),                # select entry
        MagicMock(data=None),                   # update
    ]
    with patch("services.auth_service.get_supabase", return_value=sb):
        result = complete_step("user@example.com", "entry-1", 0)
    assert result is not None
    assert result["next_steps"][0]["completed"] is True
    assert result["coverage"]["essential"] == "1/1"
