from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from database import get_db

from .embeddings import EmbeddingError
from .llm import LLMError
from .schemas import CandidateOut, RecommendRequest, RecommendResponse
from .service import JobNotFound, recommend

router = APIRouter(prefix="/api/v1/matching", tags=["AI Matching"])


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
            CandidateOut(alias=c.alias, score=c.score, matched_skills=c.matched_skills, reason=c.reason)
            for c in result.candidates
        ],
    )