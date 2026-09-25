"""Optional "run on real IBM hardware" endpoints, with queue status for the browser to poll."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.hardware import SHOTS, CircuitError, IBMRunner, Runner, build_circuit
from app.ratelimit import RateLimiter, client_key

router = APIRouter(prefix="/hardware")
# Hardware time is scarce on the free plan: a few submissions per visitor per hour.
submit_limiter = RateLimiter(limit=3, window_seconds=3600)


@lru_cache
def get_runner() -> Runner | None:
    if not settings.ibm_quantum_token:
        return None
    return IBMRunner(settings.ibm_quantum_token, settings.ibm_quantum_instance)


def require_runner() -> Runner:
    runner = get_runner()
    if runner is None:
        raise HTTPException(404, "Real-hardware runs aren't enabled on this server")
    return runner


@router.get("/status")
def status() -> dict:
    enabled = get_runner() is not None
    return {
        "available": enabled,
        "shots": SHOTS,
        "reason": None if enabled else "This server has no IBM Quantum token configured.",
    }


class JobRequest(BaseModel):
    num_qubits: Annotated[int, Field(ge=1, le=5)]
    ops: Annotated[list[dict], Field(min_length=1, max_length=30)]


RunnerDep = Annotated[Runner, Depends(require_runner)]


@router.post("/jobs")
def submit(req: JobRequest, request: Request, runner: RunnerDep) -> dict:
    try:
        circuit = build_circuit(req.num_qubits, req.ops)
    except CircuitError as e:
        raise HTTPException(422, str(e)) from e
    submit_limiter.check(client_key(request))
    try:
        job = runner.submit(circuit)
    except Exception as e:  # noqa: BLE001 - IBM errors vary; the learner gets a clear message
        raise HTTPException(
            502, "IBM Quantum couldn't accept the job right now. Try again later."
        ) from e
    return {"job_id": job.job_id, "backend": job.backend, "pending_jobs": job.pending_jobs}


@router.get("/jobs/{job_id}")
def job_state(job_id: str, runner: RunnerDep) -> dict:
    try:
        state = runner.state(job_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, "Couldn't reach IBM Quantum to check the job.") from e
    return {
        "status": state.status,
        "backend": state.backend,
        "counts": state.counts,
        "error": state.error,
    }
