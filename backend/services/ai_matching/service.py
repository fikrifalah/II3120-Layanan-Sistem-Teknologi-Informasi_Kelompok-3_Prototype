from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable, Optional, TypeVar

from sqlmodel import Session, func, select

from models import Contract, Job

from .anonymizer import get_aliases
from .db_models import CvChunk, FreelancerProfile
from .embeddings import EmbeddingClient, EmbeddingError
from .filtering import hard_filter
from .llm import LLMClient, LLMError, explain, extract_skills, template_reason
from .retrieval import SCORED_TYPES, StoredChunk, best_evidence
from .scoring import CandidateFeatures, JobRequirements, score_candidate

# Kontrak yang sudah disepakati selesai / dibatalkan tidak dihitung sebagai proyek aktif (keputusan #14).
FINISHED_CONTRACT_STATUSES = ("completed", "cancelled")
LLM_RETRIES = 2  # LLM kadang membalas kosong -> coba sekali lagi
REASON_WORKERS = 5

T = TypeVar("T")


class JobNotFound(LookupError):
    pass


@dataclass
class Candidate:
    """Hasil internal. Router HANYA boleh mengirim alias, score, matched_skills, reason."""

    freelancer_id: int
    alias: str
    score: float
    breakdown: dict[str, Optional[float]]
    matched_skills: list[str]
    reason: str
    reason_source: str  # "llm" | "template"


@dataclass
class MatchResult:
    job_id: int
    candidates: list[Candidate]
    job_skills: list[str]
    total_freelancers: int
    passed_filter: int
    rejection_counts: Counter = field(default_factory=Counter)
    fallbacks: list[str] = field(default_factory=list)  # titik AI yang memakai cadangan


def recommend(
    session: Session,
    job_id: int,
    top_k: int = 5,
    with_reasons: bool = True,
    llm: Optional[LLMClient] = None,
    emb: Optional[EmbeddingClient] = None,
) -> MatchResult:
    job = session.get(Job, job_id)
    if job is None:
        raise JobNotFound(f"job {job_id} tidak ditemukan")
    job_text = f"{job.title}\n{job.description}"
    llm = llm or LLMClient()
    emb = emb or EmbeddingClient()
    fallbacks: list[str] = []

    # 1-2. Pahami job: skill (LLM) + vektor (embedding). Gagal -> cadangan, API tetap jalan.
    job_skills = _try(lambda: extract_skills(llm, job_text), LLMError, default=None)
    if job_skills is None:
        job_skills = []
        fallbacks.append("extract_skills")
    query_vec = _try(lambda: emb.embed([job_text])[0], EmbeddingError, default=None)
    if query_vec is None:
        fallbacks.append("embedding")

    # 3. Data freelancer + beban kerja.
    profiles = {p.freelancer_id: p for p in session.exec(select(FreelancerProfile))}
    active = _active_projects(session)
    features = {
        fid: CandidateFeatures(skills=p.skills, rate=p.rate, active_projects=active.get(fid, 0))
        for fid, p in profiles.items()
    }

    # 4. Gerbang: budget + kapasitas (keputusan #15).
    requirements = JobRequirements(required_skills=job_skills, max_budget=job.budget)
    report = hard_filter(requirements, features)

    # 5. Retrieval: bukti CV paling mirip per freelancer yang lolos.
    evidence = {}
    if query_vec is not None and report.passed_ids:
        rows = session.exec(
            select(CvChunk).where(CvChunk.type.in_(SCORED_TYPES), CvChunk.freelancer_id.in_(report.passed_ids))
        )
        chunks = [StoredChunk(c.freelancer_id, c.type, c.text, c.embedding) for c in rows]
        evidence = best_evidence(query_vec, chunks)

    # 6. Skor + ranking (seri -> id terkecil, agar urutan selalu sama).
    scored = []
    for fid in report.passed_ids:
        ev = evidence.get(fid, {})
        cand = features[fid]
        cand.experience_sim = ev["experience"].similarity if "experience" in ev else None
        cand.portfolio_sim = ev["portfolio"].similarity if "portfolio" in ev else None
        cand.profile_sim = ev["other"].similarity if "other" in ev else None
        scored.append((fid, score_candidate(requirements, cand)))
    scored.sort(key=lambda item: (-item[1].total, item[0]))
    top = scored[:top_k]

    # 7. Alasan (paralel) dari bukti; gagal -> template.
    def reason_for(fid: int, result) -> tuple[str, str]:
        found = evidence.get(fid, {})
        texts = [e.text for t, e in sorted(found.items(), key=lambda kv: -kv[1].similarity) if t != "other"]
        if with_reasons:
            reason = _try(lambda: explain(llm, job_text, result.matched_skills, texts), LLMError, default=None)
            if reason:
                return reason, "llm"
        return template_reason(result.matched_skills, texts), "template"

    with ThreadPoolExecutor(max_workers=REASON_WORKERS) as pool:
        reasons = list(pool.map(lambda item: reason_for(*item), top))

    # 8. Alias (opsi B).
    aliases = get_aliases(session, job_id, [fid for fid, _ in top])

    candidates = [
        Candidate(fid, aliases[fid], res.total, res.breakdown, res.matched_skills, reason, source)
        for (fid, res), (reason, source) in zip(top, reasons)
    ]
    if with_reasons and any(c.reason_source == "template" for c in candidates):
        fallbacks.append("explain")
    return MatchResult(job_id, candidates, job_skills, len(profiles), len(report.passed_ids),
                       report.rejection_counts, fallbacks)


def _active_projects(session: Session) -> dict[int, int]:
    rows = session.exec(
        select(Contract.freelancer_id, func.count())
        .where(Contract.status.not_in(FINISHED_CONTRACT_STATUSES))
        .group_by(Contract.freelancer_id)
    )
    return dict(rows.all())


def _try(fn: Callable[[], T], error: type[Exception], default: Optional[T]) -> Optional[T]:
    for _ in range(LLM_RETRIES):
        try:
            return fn()
        except error:
            continue
    return default