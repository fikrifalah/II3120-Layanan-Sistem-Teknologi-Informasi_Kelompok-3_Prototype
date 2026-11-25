"""Undangan proyek: client mengundang kandidat (alias) -> freelancer menerima/menolak -> identitas dibuka.

Anonimisasi: client hanya mengenal alias; nama freelancer baru dikirim ke client SETELAH undangan diterima.
"""
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from pydantic import Field as PField
from sqlmodel import Field, Session, SQLModel, func, select

from database import get_db
from models import Job, User
from services.ai_matching.anonymizer import resolve_alias
from services.ai_matching.db_models import ClientProfile, JobRequirement
from services.auth.router import current_user


class Invitation(SQLModel, table=True):
    __tablename__ = "invitation"

    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="job.id", index=True)
    client_id: int = Field(foreign_key="user.id")
    freelancer_id: int = Field(foreign_key="user.id", index=True)
    alias: str  # alias yang dilihat client saat mengundang
    message: str = ""
    match_score: Optional[float] = None
    match_explanation: Optional[str] = None
    status: str = "pending"  # pending | accepted | declined | cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    responded_at: Optional[datetime] = None


class SendInvitationRequest(BaseModel):
    job_id: int
    alias: str
    message: str = PField(default="", max_length=2000)
    match_score: Optional[float] = PField(default=None, ge=0, le=100)
    match_explanation: Optional[str] = PField(default=None, max_length=2000)


class RespondRequest(BaseModel):
    decision: Literal["accepted", "declined"]


router = APIRouter(prefix="/api/v1/invitations", tags=["Invitations"])


def _require_role(user: User, role: str) -> None:
    if user.role != role:
        raise HTTPException(status_code=403, detail=f"Hanya akun {role} yang boleh melakukan ini.")


def _iso(dt: Optional[datetime]) -> Optional[str]:
    """SQLite mengembalikan datetime tanpa zona waktu; semua disimpan sebagai UTC."""
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


def _own_job(session: Session, job_id: int, client: User) -> Job:
    job = session.get(Job, job_id)
    if job is None or job.client_id != client.id:
        raise HTTPException(status_code=404, detail=f"job {job_id} tidak ditemukan")
    return job


# ------------------------------------------------------------------ sisi client

def _sent_view(session: Session, inv: Invitation) -> dict:
    view = {"id": inv.id, "job_id": inv.job_id, "alias": inv.alias, "status": inv.status,
            "created_at": _iso(inv.created_at), "responded_at": _iso(inv.responded_at), "identity": None}
    if inv.status == "accepted":  # identitas dibuka HANYA setelah freelancer menerima
        freelancer = session.get(User, inv.freelancer_id)
        view["identity"] = {"name": freelancer.name, "email": freelancer.email}
    return view


@router.post("", status_code=201)
def send_invitation(req: SendInvitationRequest, user: User = Depends(current_user),
                    session: Session = Depends(get_db)) -> dict:
    _require_role(user, "client")
    _own_job(session, req.job_id, user)
    freelancer_id = resolve_alias(session, req.job_id, req.alias)
    if freelancer_id is None:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan untuk job ini.")
    pending = session.exec(select(Invitation).where(
        Invitation.job_id == req.job_id, Invitation.freelancer_id == freelancer_id, Invitation.status == "pending"
    )).first()
    if pending:
        raise HTTPException(status_code=409, detail="Invitation already pending.")
    inv = Invitation(job_id=req.job_id, client_id=user.id, freelancer_id=freelancer_id, alias=req.alias,
                     message=req.message, match_score=req.match_score, match_explanation=req.match_explanation)
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return {"data": _sent_view(session, inv)}


@router.get("/sent")
def sent_invitations(job_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    _require_role(user, "client")
    _own_job(session, job_id, user)
    rows = session.exec(select(Invitation).where(Invitation.job_id == job_id).order_by(Invitation.created_at.desc()))
    return {"data": [_sent_view(session, inv) for inv in rows]}


@router.post("/{invitation_id}/cancel")
def cancel_invitation(invitation_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    _require_role(user, "client")
    inv = session.get(Invitation, invitation_id)
    if inv is None or inv.client_id != user.id:
        raise HTTPException(status_code=404, detail="This invitation is unavailable.")
    if inv.status != "pending":
        raise HTTPException(status_code=409, detail=f"This invitation is already {inv.status}.")
    inv.status = "cancelled"
    session.add(inv)
    session.commit()
    return {"data": _sent_view(session, inv)}


# ------------------------------------------------------------------ sisi freelancer
# Bentuk data mengikuti frontend/src/services/receivedInvitations.ts (ReceivedInvitation).

def _skills(raw: Optional[str]) -> list[str]:
    return [s for s in (raw or "").split(",") if s]


def _received_view(session: Session, inv: Invitation) -> dict:
    job = session.get(Job, inv.job_id)
    req = session.get(JobRequirement, inv.job_id)
    client = session.get(User, inv.client_id)
    company = session.get(ClientProfile, inv.client_id)
    return {
        "id": inv.id,
        "status": inv.status,
        "created_at": _iso(inv.created_at),
        "client": {"name": company.company if company else client.name},
        "project": {
            "title": job.title,
            "category": req.category if req else "",
            "description": job.description,
            "required_skills": _skills(req.required_skills if req else None),
            "preferred_skills": _skills(req.preferred_skills if req else None),
            "budget_idr": job.budget,
            "expected_start_at": None,
            "expected_end_at": None,
        },
        "match_score": inv.match_score,
        "match_explanation": inv.match_explanation,
        "message": inv.message,
        "allowed_actions": ["accept", "decline"] if inv.status == "pending" else [],
    }


def _own_invitation(session: Session, invitation_id: int, freelancer: User) -> Invitation:
    inv = session.get(Invitation, invitation_id)
    if inv is None or inv.freelancer_id != freelancer.id:
        raise HTTPException(status_code=404, detail="This invitation is unavailable.")
    return inv


@router.get("")
def inbox(page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=50),
          user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    _require_role(user, "freelancer")
    mine = Invitation.freelancer_id == user.id
    total = session.exec(select(func.count()).select_from(Invitation).where(mine)).one()
    rows = session.exec(select(Invitation).where(mine).order_by(Invitation.created_at.desc())
                        .offset((page - 1) * page_size).limit(page_size))
    return {"data": [_received_view(session, inv) for inv in rows],
            "meta": {"total": total, "page": page, "page_size": page_size}}


@router.get("/{invitation_id}")
def invitation_detail(invitation_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    _require_role(user, "freelancer")
    return {"data": _received_view(session, _own_invitation(session, invitation_id, user))}


@router.post("/{invitation_id}/respond")
def respond(invitation_id: int, req: RespondRequest, user: User = Depends(current_user),
            session: Session = Depends(get_db)) -> dict:
    _require_role(user, "freelancer")
    inv = _own_invitation(session, invitation_id, user)
    if inv.status != "pending":
        raise HTTPException(status_code=409, detail=f"This invitation is already {inv.status}.")
    inv.status = req.decision
    inv.responded_at = datetime.now(timezone.utc)
    session.add(inv)
    session.commit()
    return {"data": _received_view(session, inv)}
