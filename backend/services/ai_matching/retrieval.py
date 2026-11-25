import math
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence

Vector = Sequence[float]

SCORED_TYPES = ("experience", "portfolio", "other")


def cosine(a: Vector, b: Vector) -> float:
    """Kemiripan arah dua vektor: a.b / (|a| |b|)."""
    if len(a) != len(b):
        raise ValueError(f"Dimensi berbeda: {len(a)} vs {len(b)}")
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


@dataclass(frozen=True)
class StoredChunk:
    freelancer_id: int
    type: str  # "experience" | "portfolio" | "other"
    text: str
    embedding: list[float]


@dataclass(frozen=True)
class Evidence:
    text: str
    similarity: float


def best_evidence(
    query_vec: Vector,
    chunks: Iterable[StoredChunk],
    allowed_ids: Optional[set[int]] = None,
) -> dict[int, dict[str, Evidence]]:
    """Untuk setiap freelancer, ambil potongan dengan cosine tertinggi per jenis.

    Hasil: {freelancer_id: {"experience": Evidence, "portfolio": Evidence}}
    Jenis yang tidak punya potongan sama sekali tidak muncul sebagai key.
    """
    best: dict[int, dict[str, Evidence]] = {}
    for chunk in chunks:
        if chunk.type not in SCORED_TYPES:
            continue
        if allowed_ids is not None and chunk.freelancer_id not in allowed_ids:
            continue
        sim = cosine(query_vec, chunk.embedding)
        per_type = best.setdefault(chunk.freelancer_id, {})
        current = per_type.get(chunk.type)
        if current is None or sim > current.similarity:
            per_type[chunk.type] = Evidence(text=chunk.text, similarity=sim)
    return best