from dataclasses import dataclass, field
from typing import Iterable, Optional, Union

WEIGHTS = {
    "skill": 0.26,
    "experience": 0.18,
    "portfolio": 0.18,
    "profile": 0.18, 
    "budget": 0.10,
    "availability": 0.10,
}

# Pemetaan cosine -> 0..100, dikalibrasi dengan script/calibrate.py (20 job x 300 freelancer seed):
# FLOOR = median cosine CV tak relevan, CEIL = persentil 90 CV yang cocok.
SIM_FLOOR = 0.50
SIM_CEIL = 0.72

PREFERRED_SHARE = 0.20  # porsi skill preferred di dalam skor skill
MAX_ACTIVE_PROJECTS = 3  # proyek aktif >= ini -> kapasitas penuh (availability 0, gugur di filter)

Skills = Union[str, Iterable[str], None]


@dataclass
class JobRequirements:
    required_skills: list[str] = field(default_factory=list)
    preferred_skills: list[str] = field(default_factory=list)
    max_budget: Optional[float] = None


@dataclass
class CandidateFeatures:
    skills: Skills = None
    experience_sim: Optional[float] = None  # dari retrieval.best_evidence
    portfolio_sim: Optional[float] = None
    profile_sim: Optional[float] = None  # Ringkasan/Keahlian (chunk "other")
    rate: Optional[float] = None  # estimasi biaya yang diminta freelancer per proyek (Rp)
    active_projects: Optional[int] = None  # dihitung dari tabel contract


@dataclass
class ScoreResult:
    total: float
    breakdown: dict[str, Optional[float]]
    matched_skills: list[str]


def normalize_skills(raw: Skills) -> set[str]:
    if raw is None:
        return set()
    parts = raw.split(",") if isinstance(raw, str) else raw
    return {p.strip().lower() for p in parts if p and p.strip()}


def similarity_score(sim: Optional[float]) -> Optional[float]:
    if sim is None:
        return None
    x = (sim - SIM_FLOOR) / (SIM_CEIL - SIM_FLOOR)
    return round(100 * min(max(x, 0.0), 1.0), 1)


def skill_score(required: Skills, preferred: Skills, candidate: Skills) -> tuple[Optional[float], list[str]]:
    req, pref, cand = normalize_skills(required), normalize_skills(preferred), normalize_skills(candidate)
    matched = sorted((req | pref) & cand)
    if not req and not pref:
        return None, matched
    if not req:
        return round(100 * len(pref & cand) / len(pref), 1), matched
    recall = len(req & cand) / len(req)
    if not pref:
        return round(100 * recall, 1), matched
    bonus = len(pref & cand) / len(pref)
    return round(100 * ((1 - PREFERRED_SHARE) * recall + PREFERRED_SHARE * bonus), 1), matched


def budget_score(rate: Optional[float], max_budget: Optional[float]) -> Optional[float]:
    if rate is None or not max_budget:
        return None
    if rate <= max_budget:
        return 100.0
    over = (rate - max_budget) / max_budget  # 0.5 = 50% di atas budget
    return round(100 * max(0.0, 1 - over), 1)


def availability_score(active_projects: Optional[int]) -> Optional[float]:
    if active_projects is None:
        return None
    load = min(max(active_projects, 0), MAX_ACTIVE_PROJECTS) / MAX_ACTIVE_PROJECTS
    return round(100 * (1 - load), 1)



def final_score(breakdown: dict[str, Optional[float]]) -> float:
    available = {k: v for k, v in breakdown.items() if v is not None}
    total_weight = sum(WEIGHTS[k] for k in available)
    if total_weight == 0:
        return 0.0
    return round(sum(WEIGHTS[k] * v for k, v in available.items()) / total_weight, 1)


def score_candidate(job: JobRequirements, cand: CandidateFeatures) -> ScoreResult:
    skill, matched = skill_score(job.required_skills, job.preferred_skills, cand.skills)
    breakdown = {
        "skill": skill,
        "experience": similarity_score(cand.experience_sim),
        "portfolio": similarity_score(cand.portfolio_sim),
        "profile": similarity_score(cand.profile_sim),
        "budget": budget_score(cand.rate, job.max_budget),
        "availability": availability_score(cand.active_projects),
    
    }
    return ScoreResult(total=final_score(breakdown), breakdown=breakdown, matched_skills=matched)