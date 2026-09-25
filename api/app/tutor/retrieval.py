"""Retrieval over lesson content: the only knowledge the tutor may use.

Every authored lesson is split into small, labelled chunks (hook, analogy, "where it breaks",
each math line's plain-English reading, check explanations, …). Chunks are embedded locally
with the sentence-transformers/all-MiniLM-L6-v2 model, run through ONNX by fastembed (the same
embeddings as PyTorch, in a fraction of the memory), and searched with ChromaDB. No paid
embedding API is used.

Chunk embeddings are cached on disk, keyed by a hash of the model and the chunk texts, so a
server starts (and wakes from sleep) without re-embedding every lesson.
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import chromadb

from app.content.loader import Content
from app.content.schema import Concept

log = logging.getLogger("qurious.retrieval")

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_CACHE = Path(__file__).resolve().parents[2] / ".cache" / "lesson-embeddings.json"

Embedder = Callable[[Sequence[str]], list[list[float]]]


@dataclass(frozen=True)
class Chunk:
    id: str
    concept_id: str
    title: str
    section: str
    text: str
    # False for concepts in the map that have no lesson yet (stubs). They're indexed only so the
    # tutor can recognise "that's about Grover's search, which isn't written yet" instead of
    # answering from some loosely related lesson.
    authored: bool = True


@dataclass(frozen=True)
class Hit:
    chunk: Chunk
    similarity: float  # cosine similarity, 1 = identical meaning


def chunks_for(concept: Concept) -> list[Chunk]:
    """The labelled pieces of one authored lesson."""
    pieces: list[tuple[str, str]] = [("summary", concept.summary), ("hook", concept.hook)]
    if concept.intuition:
        pieces += [
            ("analogy", concept.intuition.analogy),
            ("where the analogy breaks", concept.intuition.where_it_breaks),
        ]
    pieces += [(f"math level {m.level}", m.plain_english) for m in concept.math]
    pieces += [
        ("check", f"{c.question} Answer: {c.options[c.answer]}. {c.explanation}")
        for c in concept.checks
    ]
    if concept.alt_explanation:
        pieces.append(("another explanation", concept.alt_explanation))
    pieces += [
        ("common misconception", f"A common mistake: {m}") for m in concept.common_misconceptions
    ]
    return [
        Chunk(f"{concept.id}#{i}", concept.id, concept.title, section, " ".join(text.split()))
        for i, (section, text) in enumerate(pieces)
        if text.strip()
    ]


def stub_chunk(concept: Concept) -> Chunk:
    return Chunk(
        f"{concept.id}#stub",
        concept.id,
        concept.title,
        "not written yet",
        concept.summary,
        authored=False,
    )


def build_chunks(content: Content) -> list[Chunk]:
    chunks: list[Chunk] = []
    for concept in content.concepts.values():
        chunks.extend(chunks_for(concept) if concept.is_authored else [stub_chunk(concept)])
    return chunks


def _cache_key(chunks: Sequence[Chunk]) -> str:
    payload = json.dumps([EMBEDDING_MODEL, [[c.id, c.title, c.text] for c in chunks]])
    return hashlib.sha256(payload.encode()).hexdigest()


def cached_embeddings(
    chunks: Sequence[Chunk], embed: Embedder, cache: Path | None
) -> list[list[float]]:
    """Embeddings for the chunks, from the cache file when it matches the current content."""
    texts = [f"{c.title}. {c.text}" for c in chunks]
    if cache is None:
        return embed(texts)
    key = _cache_key(chunks)
    try:
        data = json.loads(cache.read_text())
        if data.get("key") == key:
            return data["vectors"]
    except (OSError, ValueError):
        pass
    vectors = embed(texts)
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps({"key": key, "vectors": vectors}))
    except OSError:
        log.warning("Couldn't write the embedding cache at %s", cache)
    return vectors


class Retriever:
    def __init__(self, chunks: Sequence[Chunk], embed: Embedder, cache: Path | None = None):
        self.embed = embed
        self.chunks = {c.id: c for c in chunks}
        client = chromadb.EphemeralClient()
        # Cosine distance, and we supply the embeddings ourselves (no Chroma default model).
        # In-memory clients share state within a process, so each retriever gets its own name.
        self.collection = client.create_collection(
            f"lessons-{uuid.uuid4().hex[:12]}",
            configuration={"hnsw": {"space": "cosine"}},
            embedding_function=None,
        )
        if chunks:
            self.collection.add(
                ids=[c.id for c in chunks],
                embeddings=cached_embeddings(chunks, embed, cache),
                metadatas=[{"concept_id": c.concept_id, "authored": c.authored} for c in chunks],
            )

    def search(
        self,
        query: str,
        k: int = 5,
        concept_ids: Sequence[str] | None = None,
        authored_only: bool = True,
    ) -> list[Hit]:
        """Top-k chunks for the query, optionally only from the given concepts.

        Stub (unwritten) concepts are excluded unless `authored_only=False`.
        """
        if not self.chunks:
            return []
        filters: list[dict] = []
        if concept_ids:
            filters.append({"concept_id": {"$in": list(concept_ids)}})
        if authored_only:
            filters.append({"authored": True})
        where = None if not filters else filters[0] if len(filters) == 1 else {"$and": filters}
        result = self.collection.query(
            query_embeddings=self.embed([query]),
            n_results=min(k, len(self.chunks)),
            where=where,
            include=["distances"],
        )
        return [
            Hit(self.chunks[cid], 1 - dist)
            for cid, dist in zip(result["ids"][0], result["distances"][0], strict=True)
        ]


@lru_cache
def default_embedder() -> Embedder:
    """The real embedder, loaded lazily: the ONNX model (~90 MB) downloads on first use unless
    it was baked into the image (see the Dockerfile)."""
    from fastembed import TextEmbedding

    log.info("Loading embedding model %s", EMBEDDING_MODEL)
    # One thread keeps memory low on small (512 MB) servers; queries are short anyway.
    model = TextEmbedding(EMBEDDING_MODEL, threads=1)

    def embed(texts: Sequence[str]) -> list[list[float]]:
        vectors = []
        for v in model.embed(list(texts), batch_size=8):
            norm = float((v * v).sum()) ** 0.5 or 1.0
            vectors.append((v / norm).tolist())
        return vectors

    return embed


def build_index() -> None:
    """Pre-compute the lesson embedding cache. Run at image build time:
    python -c "from app.tutor.retrieval import build_index; build_index()"
    """
    from app.content.loader import load_content

    chunks = build_chunks(load_content())
    cached_embeddings(chunks, default_embedder(), DEFAULT_CACHE)
    print(f"Cached embeddings for {len(chunks)} lesson chunks at {DEFAULT_CACHE}")
