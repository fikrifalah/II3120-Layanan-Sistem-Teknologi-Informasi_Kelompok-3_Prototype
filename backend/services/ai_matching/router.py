from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from database import get_db
from models import User
from services.auth.router import current_user

from .embeddings import EmbeddingError
from .llm import LLMError
from .schemas import (
    CandidateOut,
    CreateJobRequest,
    CreateJobResponse,
    EvidenceOut,
    ProfileOut,
    ProfilePatch,
    RecommendRequest,
    RecommendResponse,
)
from .service import (
    ClientNotFound,
    JobNotFound,
    ProfileNotFound,
    create_job,
    get_profile,
    recommend,
    update_profile,
)

router = APIRouter(prefix="/api/v1/matching", tags=["AI Matching"])


@router.post("/jobs", response_model=CreateJobResponse, status_code=201)
def create_matching_job(req: CreateJobRequest, session: Session = Depends(get_db)) -> CreateJobResponse:
    try:
        job = create_job(session, **req.model_dump())
    except ClientNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return CreateJobResponse(job_id=job.id)


@router.post("/recommend", response_model=RecommendResponse)
def recommend_freelancers(req: RecommendRequest, session: Session = Depends(get_db)) -> RecommendResponse:
    try:
        result = recommend(session, req.job_id, req.top_k)
    except JobNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (LLMError, EmbeddingError) as e:  # mis. API key belum diisi di .env
        raise HTTPException(status_code=503, detail=f"Layanan AI belum siap: {e}") from e

    return RecommendResponse(
        job_id=result.job_id,
        candidates=[
            CandidateOut(
                alias=c.alias,
                rank=c.rank,
                score=c.score,
                breakdown=c.breakdown,
                matched_skills=c.matched_skills,
                missing_skills=c.missing_skills,
                estimate_idr=c.rate,
                active_projects=c.active_projects,
                about=c.about,
                evidence=[EvidenceOut(type=t, text=text) for t, text in c.evidence],
                reason=c.reason,
            )
            for c in result.candidates
        ],
    )


# ------------------------------------------------------------------ profil freelancer (tahap 2)

profile_router = APIRouter(prefix="/api/v1/freelancer", tags=["Freelancer Profile"])


def _freelancer(user: User = Depends(current_user)) -> User:
    if user.role != "freelancer":
        raise HTTPException(status_code=403, detail="Hanya akun freelancer yang punya profil.")
    return user


@profile_router.get("/profile")
def read_profile(user: User = Depends(_freelancer), session: Session = Depends(get_db)) -> dict:
    try:
        return {"data": ProfileOut(**asdict(get_profile(session, user.id)))}
    except ProfileNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@profile_router.patch("/profile")
def edit_profile(patch: ProfilePatch, user: User = Depends(_freelancer), session: Session = Depends(get_db)) -> dict:
    try:
        view = update_profile(session, user.id, **patch.model_dump(exclude_none=True))
    except ProfileNotFound as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except EmbeddingError as e:
        raise HTTPException(status_code=503, detail=f"Layanan AI belum siap: {e}") from e
    return {"data": ProfileOut(**asdict(view))}
