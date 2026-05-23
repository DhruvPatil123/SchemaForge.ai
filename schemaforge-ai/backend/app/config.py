from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Prefer OPENROUTER_API_KEY to avoid empty system OPENAI_API_KEY overriding .env
    openrouter_api_key: str = ""
    openai_api_key: str = ""  # fallback alias
    openai_base_url: str = "https://openrouter.ai/api/v1"
    openai_model: str = "anthropic/claude-opus-4"
    database_url: str = "sqlite:///./data/schemaforge.db"
    rate_limit_per_hour: int = 100
    free_schemas_per_month: int = 20
    enable_openai: bool = True
    support_email: str = "sujalpatil8657231278@gmail.com"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    @property
    def llm_api_key(self) -> str:
        return self.openrouter_api_key or self.openai_api_key

    @property
    def supabase_public_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def supabase_admin_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001"
    )


settings = Settings()
