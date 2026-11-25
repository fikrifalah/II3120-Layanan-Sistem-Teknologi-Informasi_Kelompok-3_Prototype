from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable, Iterable, Optional, TypeVar

from sqlmodel import Session, func, select

from models import Contract, Job, User

from .anonymizer import get_aliases
from .cv_parser import chunk_cv, clean_cv
from .db_models import CvChunk, FreelancerProfile, JobRequirement
from .embeddings import EmbeddingClient, EmbeddingError
from .filtering import hard_filter
from .llm import LLMClient, LLMError, explain, extract_skills, template_reason
from .retrieval import SCORED_TYPES, StoredChunk, best_evidence
from .scoring import CandidateFeatures, JobRequirements, normalize_skills, score_candidate

# Kontrak yang sudah disepakati selesai / dibatalkan tidak dihitung sebagai proyek aktif (keputusan #14).
FINISHED_CONTRACT_STATUSES = ("completed", "cancelled")
LLM_RETRIES = 2  # LLM kadang membalas kosong -> coba sekali lagi
REASON_WORKERS = 5

T = TypeVar("T")


class JobNotFound(LookupError):
    pass


class ClientNotFound(LookupError):
    pass


@dataclass
class Candidate:
    """Hasil internal. `freelancer_id` dan `reason_source` TIDAK boleh dikirim router (anonimisasi)."""

    freelancer_id: int
    alias: str
    rank: int
    score: float
    breakdown: dict[str, Optional[float]]
    matched_skills: list[str]
    missing_skills: list[str]  # skill wajib job yang tidak ada di profil
    rate: Optional[float]  # estimasi biaya per proyek (Rp)
    active_projects: int
    about: str  # Ringkasan CV (sudah bersih dari PII)
    evidence: list[tuple[str, str]]  # (jenis, teks) potongan CV paling mirip: experience/portfolio
    reason: str
    reason_source: str  # "llm" | "template"


@dataclass
class MatchResult:
    job_id: int
    candidates: list[Candidate]
    job_skills: list[str]
    skill_source: str  # "form" (dipilih client) | "llm" (diekstrak dari deskripsi)
    total_freelancers: int
    passed_filter: int
    rejection_counts: Counter = field(default_factory=Counter)
    fallbacks: list[str] = field(default_factory=list)  # titik AI yang memakai cadangan


def create_job(
    session: Session,
    client_id: int,
    title: str,
    description: str,
    budget: float,
    required_skills: Iterable[str] = (),
    preferred_skills: Iterable[str] = (),
    category: str = "",
    industry: str = "",
) -> Job:
    """Simpan proyek dari form client ke tabel `job` (tim) + `job_requirement` (modul ini)."""
    client = session.get(User, client_id)
    if client is None or client.role != "client":
        raise ClientNotFound(f"client {client_id} tidak ditemukan")
    job = Job(client_id=client_id, title=title, description=description, budget=budget)
    session.add(job)
    session.flush()  # mengisi job.id
    session.add(JobRequirement(
        job_id=job.id,
        required_skills=",".join(sorted(normalize_skills(required_skills))),
        preferred_skills=",".join(sorted(normalize_skills(preferred_skills))),
        category=category,
        industry=industry,
    ))
    session.commit()
    session.refresh(job)
    return job


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

    # 1. Skill job: pakai pilihan client di form; kalau kosong, ekstrak dari deskripsi (LLM).
    req = session.get(JobRequirement, job_id)
    required = sorted(normalize_skills(req.required_skills)) if req else []
    preferred = sorted(normalize_skills(req.preferred_skills)) if req else []
    skill_source = "form"
    if not required and not preferred:
        skill_source = "llm"
        required = _try(lambda: extract_skills(llm, job_text), LLMError, default=None)
        if required is None:
            required = []
            fallbacks.append("extract_skills")

    # 2. Vektor job (embedding). Gagal -> cadangan, API tetap jalan.
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
    requirements = JobRequirements(required_skills=required, preferred_skills=preferred, max_budget=job.budget)
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
    def evidence_for(fid: int) -> list[tuple[str, str]]:
        """Bukti experience/portfolio, terurut kemiripan. Ringkasan ("other") bukan kutipan alasan."""
        found = evidence.get(fid, {})
        return [(t, e.text) for t, e in sorted(found.items(), key=lambda kv: -kv[1].similarity) if t != "other"]

    def reason_for(fid: int, result) -> tuple[str, str]:
        texts = [text for _, text in evidence_for(fid)]
        if with_reasons:
            reason = _try(lambda: explain(llm, job_text, result.matched_skills, texts), LLMError, default=None)
            if reason:
                return reason, "llm"
        return template_reason(result.matched_skills, texts), "template"

    with ThreadPoolExecutor(max_workers=REASON_WORKERS) as pool:
        reasons = list(pool.map(lambda item: reason_for(*item), top))

    # 8. Alias (opsi B).
    aliases = get_aliases(session, job_id, [fid for fid, _ in top])

    candidates = []
    for rank, ((fid, res), (reason, source)) in enumerate(zip(top, reasons), start=1):
        profile = profiles[fid]
        candidates.append(Candidate(
            freelancer_id=fid,
            alias=aliases[fid],
            rank=rank,
            score=res.total,
            breakdown=res.breakdown,
            matched_skills=res.matched_skills,
            missing_skills=sorted(set(required) - normalize_skills(profile.skills)),
            rate=profile.rate,
            active_projects=features[fid].active_projects or 0,
            about=_summary(profile.cv_text),
            evidence=evidence_for(fid),
            reason=reason,
            reason_source=source,
        ))
    if with_reasons and any(c.reason_source == "template" for c in candidates):
        fallbacks.append("explain")
    return MatchResult(job_id, candidates, required + preferred, skill_source, len(profiles), len(report.passed_ids),
                       report.rejection_counts, fallbacks)


def _summary(cv_text: str) -> str:
    """Potongan "other" pertama CV = bagian Ringkasan (format CV: Ringkasan selalu di awal)."""
    return next((c.text for c in chunk_cv(cv_text) if c.type == "other"), "")


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

# ------------------------------------------------------------------ profil freelancer (tahap 2)

# Harus sama dengan `skillGroups` di frontend/src/services/freelancerProfile.ts (UI hanya bisa memilih ini).
UI_SKILL_CATALOG = (
    "Python", "JavaScript", "TypeScript", "Java", "PHP", "HTML", "CSS", "React", "Next.js", "Node.js",
    "FastAPI", "Django", "Laravel", "SQL", "PostgreSQL", "MySQL", "Docker", "Git", "Pandas", "Scikit-learn",
)
_UI_BY_KEY = {s.lower(): s for s in UI_SKILL_CATALOG}


class ProfileNotFound(LookupError):
    pass


@dataclass
class ProfileView:
    id: int
    name: str
    portfolio: str
    experience: str
    skills: list[str]  # ejaan katalog UI
    estimated_project_rate: int


def get_profile(session: Session, freelancer_id: int) -> ProfileView:
    user = session.get(User, freelancer_id)
    profile = session.get(FreelancerProfile, freelancer_id)
    if user is None or profile is None:
        raise ProfileNotFound(f"profil freelancer {freelancer_id} tidak ditemukan")
    chunks = chunk_cv(profile.cv_text)

    def section(kind: str) -> str:
        return "\n".join("- " + c.text for c in chunks if c.type == kind)

    return ProfileView(
        id=user.id,
        name=user.name,
        portfolio=section("portfolio"),
        experience=section("experience"),
        skills=[_UI_BY_KEY[s] for s in sorted(normalize_skills(profile.skills)) if s in _UI_BY_KEY],
        estimated_project_rate=int(profile.rate or 0),
    )


def update_profile(
    session: Session,
    freelancer_id: int,
    portfolio: Optional[str] = None,
    experience: Optional[str] = None,
    skills: Optional[list[str]] = None,
    estimated_project_rate: Optional[int] = None,
    emb: Optional[EmbeddingClient] = None,
) -> ProfileView:
    """Ubah profil. Bila teks/skill berubah, CV disusun ulang lalu DIINDEKS ULANG (bersihkan, potong, embed)."""
    current = get_profile(session, freelancer_id)
    profile = session.get(FreelancerProfile, freelancer_id)
    if estimated_project_rate is not None:
        profile.rate = estimated_project_rate
    if portfolio is not None or experience is not None or skills is not None:
        # Skill di luar katalog UI tidak tampil di layar -> dipertahankan, bukan ikut terhapus.
        hidden = {s for s in normalize_skills(profile.skills) if s not in _UI_BY_KEY}
        new_skills = sorted(hidden | normalize_skills(skills if skills is not None else current.skills))
        cv_text = _compose_cv(
            _summary(profile.cv_text),
            new_skills,
            experience if experience is not None else current.experience,
            portfolio if portfolio is not None else current.portfolio,
        )
        cv_text = clean_cv(cv_text, known_names=[current.name]).text
        _reindex(session, freelancer_id, cv_text, emb or EmbeddingClient())
        profile.cv_text = cv_text
        profile.skills = ",".join(new_skills)
    session.add(profile)
    session.commit()
    return get_profile(session, freelancer_id)


def _compose_cv(summary: str, skills: list[str], experience: str, portfolio: str) -> str:
    """Format CV yang sama dengan seed, supaya chunk_cv memotongnya dengan cara yang sama."""
    return (
        f"Ringkasan:\n{summary}\n\nKeahlian:\n{', '.join(skills)}\n\n"
        f"Pengalaman:\n{experience}\n\nPortofolio:\n{portfolio}\n"
    )


def _reindex(session: Session, freelancer_id: int, cv_text: str, emb: EmbeddingClient) -> None:
    chunks = chunk_cv(cv_text)
    vectors = emb.embed([c.text for c in chunks])  # gagal -> EmbeddingError, potongan lama belum disentuh
    for old in session.exec(select(CvChunk).where(CvChunk.freelancer_id == freelancer_id)):
        session.delete(old)
    for chunk, vec in zip(chunks, vectors):
        session.add(CvChunk(freelancer_id=freelancer_id, type=chunk.type, text=chunk.text, embedding=vec, model=emb.model))
