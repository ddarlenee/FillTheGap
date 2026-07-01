from supabase import create_client, Client
from config import settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _client


def new_supabase_client() -> Client:
    """
    A fresh, uncached client. Needed for auth flows like sign_in_with_password —
    calling that on the shared get_supabase() client swaps its session from the
    service role to that end user's session, silently downgrading every
    subsequent request (from any user) until the process restarts.
    """
    return create_client(settings.supabase_url, settings.supabase_service_key)
