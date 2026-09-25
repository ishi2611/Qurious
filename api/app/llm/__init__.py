"""LLM access. `get_llm()` builds the client from settings; with no keys it has no providers,
and every caller must work without it (the tutor falls back to retrieval-only answers)."""

from functools import lru_cache

from app.config import settings
from app.llm.client import Completion, LLMClient, LLMUnavailable
from app.llm.providers import GeminiProvider, GroqProvider, Request

__all__ = ["Completion", "LLMClient", "LLMUnavailable", "Request", "get_llm"]


@lru_cache
def get_llm() -> LLMClient:
    providers = []
    # Groq is primary and Gemini the fallback, as the project brief specifies.
    if settings.groq_api_key and settings.llm_primary_model:
        providers.append(GroqProvider(settings.groq_api_key, settings.llm_primary_model))
    if settings.gemini_api_key and settings.llm_fallback_model:
        providers.append(GeminiProvider(settings.gemini_api_key, settings.llm_fallback_model))
    return LLMClient(providers)
