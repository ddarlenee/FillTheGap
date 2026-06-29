import sys
from unittest.mock import patch, MagicMock


def test_get_supabase_returns_client():
    # Remove cached module so singleton resets
    sys.modules.pop("services.supabase_client", None)

    mock_client = MagicMock()
    with patch("supabase.create_client", return_value=mock_client) as mock_create:
        from services.supabase_client import get_supabase
        client = get_supabase()

    mock_create.assert_called_once()
    assert client is mock_client


def test_get_supabase_is_singleton():
    sys.modules.pop("services.supabase_client", None)

    mock_client = MagicMock()
    with patch("supabase.create_client", return_value=mock_client):
        from services.supabase_client import get_supabase
        c1 = get_supabase()
        c2 = get_supabase()

    assert c1 is c2
