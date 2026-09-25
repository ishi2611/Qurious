from functools import lru_cache
from pathlib import Path

from app.storage.base import QuestionLogEntry, Store
from app.storage.sqlite import SQLiteStore

__all__ = ["QuestionLogEntry", "Store", "get_store"]

DEFAULT_DB = Path(__file__).resolve().parents[2] / ".data" / "qurious.db"


@lru_cache
def get_store() -> Store:
    return SQLiteStore(DEFAULT_DB)
