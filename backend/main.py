from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
import models  # noqa: F401
from services.ai_matching.router import profile_router as freelancer_profile_router
from services.ai_matching.router import router as ai_matching_router
from services.auth.router import router as auth_router
from services.dispute_handler.service import router as disputes_router
from services.invitations.router import router as invitations_router


UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Gigly — Freelancer Matching & Smart Contract Escrow Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(ai_matching_router)
app.include_router(freelancer_profile_router)
app.include_router(invitations_router)
app.include_router(disputes_router)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
def health_check():
    return {"status": "ok"}
