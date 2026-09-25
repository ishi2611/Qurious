# The Qurious API (FastAPI) as a container, for Hugging Face Spaces (Docker SDK), Render, or any
# container host. Build from the repo root, since the API needs ../content:
#   docker build -t qurious-api . && docker run -p 7860:7860 --env-file .env qurious-api
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface PORT=7860 QURIOUS_CONTENT_DIR=/app/content

WORKDIR /app

# CPU-only torch keeps the image far smaller than the default CUDA build.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch

COPY api/pyproject.toml api/pyproject.toml
COPY api/app api/app
# Editable, so the code runs from /app/api and finds /app/content next to it.
RUN pip install -e ./api

# Bake the embedding model into the image so the tutor doesn't download it at startup.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY content content

# Hugging Face Spaces runs containers as a non-root user with uid 1000.
RUN useradd -m -u 1000 qurious && mkdir -p /app/api/.data && chown -R qurious /app
USER qurious

WORKDIR /app/api
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
