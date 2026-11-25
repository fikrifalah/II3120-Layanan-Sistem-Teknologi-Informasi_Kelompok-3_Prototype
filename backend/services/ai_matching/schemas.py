from typing import Optional

from pydantic import BaseModel, Field


class CreateJobRequest(BaseModel):
    """Proyek dari form "Create Project" client."""

    client_id: int
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
    budget: float = Field(gt=0)  # Rp
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    category: str = ""
    industry: str = ""


class CreateJobResponse(BaseModel):
    job_id: int


class RecommendRequest(BaseModel):
    job_id: int
    top_k: int = Field(default=5, ge=1, le=20)


class EvidenceOut(BaseModel):
    type: str  # "experience" | "portfolio"
    text: str


class CandidateOut(BaseModel):
    """Hanya data anonim: TANPA freelancer_id, nama, email, atau kontak."""

    alias: str
    rank: int
    score: float
    breakdown: dict[str, Optional[float]]  # skill, experience, portfolio, profile, budget, availability
    matched_skills: list[str]
    missing_skills: list[str]
    estimate_idr: Optional[float]
    active_projects: int
    about: str
    evidence: list[EvidenceOut]
    reason: str


class RecommendResponse(BaseModel):
    job_id: int
    candidates: list[CandidateOut]


class ProfileOut(BaseModel):
    id: int
    name: str
    portfolio: str
    experience: str
    skills: list[str]
    estimated_project_rate: int


class ProfilePatch(BaseModel):
    """Semua field opsional: hanya yang dikirim yang diubah."""

    portfolio: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    experience: Optional[str] = Field(default=None, min_length=1, max_length=5000)
    skills: Optional[list[str]] = Field(default=None, min_length=1)
    estimated_project_rate: Optional[int] = Field(default=None, gt=0)
