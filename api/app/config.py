"""Settings loaded from the repo-root .env file (see .env.example).

Every key is optional in M0 so the API starts with an empty .env. Later milestones
validate the keys they actually need when those features are used.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    groq_api_key: str = ""
    gemini_api_key: str = ""
    llm_primary_model: str = ""
    llm_fallback_model: str = ""
    ibm_quantum_token: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Browser origins allowed to call the API (the Next.js dev server by default).
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
