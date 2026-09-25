from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.storage.base import (
    Participant,
    QuestionLogEntry,
    Store,
    StudyEvent,
    TestResponse,
)
from app.storage.sqlite import SQLiteStore
from app.storage.supabase import SupabaseStore

__all__ = [
    "Participant",
    "QuestionLogEntry",
    "Store",
    "StudyEvent",
    "TestResponse",
    "get_store",
]

DEFAULT_DB = Path(__file__).resolve().parents[2] / ".data" / "qurious.db"


@lru_cache
def get_store() -> Store:
    """Supabase when it's configured (production), otherwise a local SQLite file."""
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseStore(settings.supabase_url, settings.supabase_service_role_key)
    return SQLiteStore(DEFAULT_DB)
