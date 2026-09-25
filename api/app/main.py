"""FastAPI entry point. Run with: uvicorn app.main:app --reload --port 8000"""

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.routes import content, study, tutor

log = logging.getLogger("qurious")


def _warm_up() -> None:
    """Load content and the embedding model in the background, so the first learner who asks
    the tutor something doesn't wait for a model download."""
    try:
        tutor.get_tutor()
    except Exception:  # noqa: BLE001 - warm-up is best effort; requests will retry and report
        log.exception("Tutor warm-up failed")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.warm_up_tutor:
        threading.Thread(target=_warm_up, daemon=True).start()
    yield


app = FastAPI(title="Qurious API", version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


app.include_router(content.router)
app.include_router(tutor.router)
app.include_router(study.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check used by the web app and, later, the deployment platform."""
    return {"status": "ok", "version": __version__}
