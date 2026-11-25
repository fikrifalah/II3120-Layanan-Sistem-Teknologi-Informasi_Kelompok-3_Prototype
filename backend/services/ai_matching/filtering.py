from collections import Counter
from dataclasses import dataclass, field

from .scoring import MAX_ACTIVE_PROJECTS, CandidateFeatures, JobRequirements

# Kandidat boleh sedikit di atas budget (masih bisa nego); di atas ini gugur.
BUDGET_TOLERANCE = 0.20


@dataclass
class FilterDecision:
    passed: bool
    rejected_because: list[str] = field(default_factory=list)  # "budget" | "availability"
    needs_confirmation: list[str] = field(default_factory=list)  # "rate" | "availability"

@dataclass
class FilterReport:
    passed_ids: set[int]
    decisions: dict[int, FilterDecision]
    rejection_counts: Counter


def check_candidate(job: JobRequirements, cand: CandidateFeatures) -> FilterDecision:
    rejected: list[str] = []
    unknown: list[str] = []


    if job.max_budget:
        if cand.rate is None:
            unknown.append("rate")
        elif cand.rate > job.max_budget * (1 + BUDGET_TOLERANCE):
            rejected.append("budget")

    if cand.active_projects is None:
        unknown.append("availability")
    elif cand.active_projects >= MAX_ACTIVE_PROJECTS:
        rejected.append("availability")
    return FilterDecision(passed=not rejected, rejected_because=rejected, needs_confirmation=unknown)


def hard_filter(job: JobRequirements, candidates: dict[int, CandidateFeatures]) -> FilterReport:
    decisions = {fid: check_candidate(job, cand) for fid, cand in candidates.items()}
    passed_ids = {fid for fid, d in decisions.items() if d.passed}
    counts = Counter(reason for d in decisions.values() for reason in d.rejected_because)
    return FilterReport(passed_ids=passed_ids, decisions=decisions, rejection_counts=counts)