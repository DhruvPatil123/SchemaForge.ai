from app.config import settings


def _missing_public_env() -> list[str]:
    missing = []
    if not settings.supabase_url:
        missing.append("SUPABASE_URL")
    if not settings.supabase_anon_key:
        missing.append("SUPABASE_ANON_KEY")
    return missing


def _missing_admin_env() -> list[str]:
    missing = _missing_public_env()
    if not settings.supabase_service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    return missing


def status() -> dict:
    return {
        "public_configured": settings.supabase_public_configured,
        "admin_configured": settings.supabase_admin_configured,
        "url": settings.supabase_url,
        "missing_public_env": _missing_public_env(),
        "missing_admin_env": _missing_admin_env(),
        "intended_use": [
            "Supabase Auth for signup, login, email verification, password reset, and OAuth",
            "Supabase Postgres for profiles, schemas, feedback, billing customers, and subscriptions",
            "Stripe for hosted checkout and billing portal sessions",
        ],
    }
