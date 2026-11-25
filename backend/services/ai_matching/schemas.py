from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    job_id: int
    top_k: int = Field(default=5, ge=1, le=20)


class CandidateOut(BaseModel):
    """Hanya data anonim: tanpa freelancer_id, nama, atau rincian skor."""

    alias: str
    score: float
    matched_skills: list[str]
    reason: str


class RecommendResponse(BaseModel):
    job_id: int
    candidates: list[CandidateOut]