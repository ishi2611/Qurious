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
    # Optional IBM Cloud instance CRN; if empty, IBM picks an instance for the token.
    ibm_quantum_instance: str = ""
    supabase_url: str = ""
    supabase_anon_key: str = ""  # used by the browser; listed here only for completeness
    # The backend's key: a new-style secret key (sb_secret_…) or a legacy service_role JWT.
    supabase_service_role_key: str = ""

    # Browser origins allowed to call the API (the Next.js dev server by default).
    cors_origins: list[str] = ["http://localhost:3000"]

    # v2: free-text questions routed onto concepts (brief §3, behind a feature flag).
    feature_free_text: bool = False

    # Load the tutor's embedding model at startup instead of on the first question.
    warm_up_tutor: bool = True

    # Study enrolment is off until the consent form and instruments are approved.
    study_enabled: bool = False

    # Researchers send this as "Authorization: Bearer <token>" to download study CSVs.
    # Export is disabled while it's empty.
    study_admin_token: str = ""


settings = Settings()
