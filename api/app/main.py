"""FastAPI entry point. Run with: uvicorn app.main:app --reload --port 8000"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.routes import content

app = FastAPI(title="Qurious API", version=__version__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


app.include_router(content.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness check used by the web app and, later, the deployment platform."""
    return {"status": "ok", "version": __version__}
