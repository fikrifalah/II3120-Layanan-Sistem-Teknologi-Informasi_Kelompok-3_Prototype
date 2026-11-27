"""PlatformOrchestrator: kontrak off-chain + hash, escrow, milestone, berkas, dan wallet.

Endpoint dokumen (Tabel 3.1.1):
  POST /contracts                 createContractDraft        (hash SHA-256 dokumen kesepakatan)
  POST /contracts/{id}/accept     freelancer menyetujui kontrak (BPMN To-Be no. 3)
  POST /escrow/lock               createAndLockEscrow        (kunci seluruh dana milestone)
  POST /milestones/{id}/submit    submitMilestoneDeliverable (hash hasil kerja on-chain)
  POST /milestones/{id}/approve   releaseMilestonePayment    (cairkan ke freelancer)
  POST /milestones/{id}/request-revision  client meminta perbaikan sebelum sengketa
  POST /escrow/{id}/reassign      reassignRemainingMilestones (handover freelancer pengganti)
  POST /escrow/{id}/close         closeContract
Auto-release setelah 5 hari review: services/orchestrator/auto_release.py.

Endpoint baca + berkas + wallet mengikuti bentuk data frontend/src/services/projectWork.ts.
"""
import hashlib
import json
import mimetypes
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, model_validator
from pydantic import Field as PField
from sqlmodel import Session, func, or_, select

from database import get_db
from models import Contract, Dispute, Escrow, Job, Milestone, User
from services.ai_matching.db_models import JobRequirement
from services.auth.router import current_user
from services.invitations.router import Invitation
from services.orchestrator import workflow as wf
from services.orchestrator.db_models import ActivityLog, MilestoneCriterion, StoredFile, Submission
from services.smart_contract import service as chain

UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
DELIVERABLE_SUBDIR = "deliverables"
ALLOWED_EXTENSIONS = {".zip", ".pdf", ".png", ".jpg", ".jpeg", ".txt"}  # sama dengan frontend delivery.ts
MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_SUBMISSION_FILES = 5
FAUCET_DEFAULT = 20_000
TOKEN_SYMBOL = wf.TOKEN_SYMBOL
PROJECT_STATUS = {"draft": "awaiting_acceptance", "agreed": "awaiting_funding", "active": "in_progress",
                  "completed": "completed"}

router = APIRouter(prefix="/api/v1", tags=["Orchestrator"])


# ------------------------------------------------------------------ skema request

class CriterionIn(BaseModel):
    description: str = PField(min_length=1, max_length=1000)
    is_mandatory: bool = True


class MilestoneIn(BaseModel):
    title: str = PField(min_length=1, max_length=200)
    description: str = PField(default="", max_length=4000)
    amount: int = PField(gt=0, le=10**12, description="SIM-IDR")
    due_at: Optional[datetime] = None
    criteria: list[CriterionIn] = PField(default_factory=list, max_length=20)


class CreateContractRequest(BaseModel):
    invitation_id: int = PField(description="Undangan yang sudah diterima freelancer")
    scope: str = PField(min_length=1, max_length=10000)
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    milestones: list[MilestoneIn] = PField(min_length=1, max_length=20)

    @model_validator(mode="after")
    def _dates(self):
        if self.start_at and self.end_at and self.end_at < self.start_at:
            raise ValueError("end_at tidak boleh sebelum start_at")
        return self


class LockEscrowRequest(BaseModel):
    contract_id: int


class DeclaredCriterion(BaseModel):
    criterion_id: int
    declared: bool


class SubmitRequest(BaseModel):
    title: str = PField(min_length=1, max_length=200)
    notes: Optional[str] = PField(default=None, max_length=4000)
    file_ids: list[int] = PField(default_factory=list, max_length=MAX_SUBMISSION_FILES)
    repository_url: Optional[str] = PField(default=None, max_length=2000)
    repository_revision: Optional[str] = PField(default=None, max_length=200)
    demo_url: Optional[str] = PField(default=None, max_length=2000)
    declared_criteria: list[DeclaredCriterion] = PField(default_factory=list)


class RevisionRequest(BaseModel):
    notes: str = PField(min_length=10, max_length=4000, description="Kriteria yang belum terpenuhi")


class ApproveRequest(BaseModel):
    approval_notes: Optional[str] = PField(default=None, max_length=4000)


class ReassignRequest(BaseModel):
    invitation_id: int = PField(description="Undangan yang diterima freelancer pengganti untuk job yang sama")


class FaucetRequest(BaseModel):
    amount: int = PField(default=FAUCET_DEFAULT, gt=0, le=1_000_000)


# ------------------------------------------------------------------ helper akses

def _require_role(user: User, role: str) -> None:
    if user.role != role:
        raise HTTPException(status_code=403, detail=f"Hanya akun {role} yang boleh melakukan ini.")


def _is_participant(user: User, contract: Contract) -> bool:
    return user.id in (contract.client_id, contract.freelancer_id)


def _contract(session: Session, contract_id: int, user: User) -> Contract:
    contract = session.get(Contract, contract_id)
    if contract is None or not _is_participant(user, contract):
        raise HTTPException(status_code=404, detail=f"kontrak {contract_id} tidak ditemukan")
    return contract


def _own_contract(session: Session, contract_id: int, client: User) -> Contract:
    _require_role(client, "client")
    contract = _contract(session, contract_id, client)
    if contract.client_id != client.id:
        raise HTTPException(status_code=403, detail="Hanya client kontrak ini yang boleh melakukan ini.")
    return contract


def _milestone(session: Session, milestone_id: int, user: User) -> tuple[Milestone, Contract]:
    milestone = session.get(Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=404, detail=f"milestone {milestone_id} tidak ditemukan")
    return milestone, _contract(session, milestone.contract_id, user)


def _project_contract(session: Session, job_id: int, user: User) -> Contract:
    contract = session.exec(select(Contract).where(Contract.job_id == job_id)).first()
    if contract is None or not _is_participant(user, contract):
        raise HTTPException(status_code=404, detail=f"proyek {job_id} tidak ditemukan")
    return contract


def _require_active(contract: Contract) -> None:
    if contract.status != "active":
        raise HTTPException(status_code=409, detail=f"Kontrak berstatus {contract.status}, bukan active.")


def _accepted_invitation(session: Session, invitation_id: int, client: User) -> Invitation:
    inv = session.get(Invitation, invitation_id)
    if inv is None or inv.client_id != client.id:
        raise HTTPException(status_code=404, detail=f"undangan {invitation_id} tidak ditemukan")
    if inv.status != "accepted":
        raise HTTPException(status_code=409, detail="Undangan belum diterima freelancer.")
    return inv


def _canonical(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _http_url(value: str) -> bool:
    return value.startswith(("http://", "https://")) and len(value) > len("https://")


def _person(user: Optional[User]) -> Optional[dict]:
    return {"id": user.id, "name": user.name, "role": user.role} if user else None


# ------------------------------------------------------------------ tampilan (bentuk data frontend)

def _file_view(f: StoredFile) -> dict:
    return {"id": f.id, "original_filename": f.original_filename, "size_bytes": f.size_bytes,
            "mime_type": f.mime_type, "sha256": f.sha256}


def _current_submission(session: Session, milestone: Milestone) -> Optional[Submission]:
    return session.exec(select(Submission).where(
        Submission.milestone_id == milestone.id, Submission.status == "submitted"
    ).order_by(Submission.id.desc())).first()


def _submission_view(session: Session, sub: Submission) -> dict:
    files = session.exec(select(StoredFile).where(StoredFile.submission_id == sub.id).order_by(StoredFile.id))
    return {"id": sub.id, "title": sub.title, "notes": sub.notes or "", "files": [_file_view(f) for f in files],
            "submitted_at": wf.iso(sub.submitted_at), "status": sub.status,
            "repository_url": sub.repository_url, "repository_revision": sub.repository_revision,
            "demo_url": sub.demo_url, "declared_criteria": json.loads(sub.declared_criteria),
            "deliverable_hash": sub.deliverable_hash, "transaction_hash": sub.tx_hash}


def _allowed_actions(m: Milestone, contract: Contract, user: User) -> list[str]:
    if contract.status != "active" or (contract.withdrawn_at and user.id == contract.freelancer_id):
        return []
    actions = []
    if user.id == contract.freelancer_id and m.status in ("in_progress", "revision_required"):
        actions.append("submit")
    if user.id == contract.client_id and m.status == "under_review":
        actions += ["approve", "request_revision"]
    if wf.dispute_block_reason(m, contract, user.id) is None:
        actions.append("dispute")
    return actions


def _milestone_view(session: Session, m: Milestone, contract: Contract, user: User) -> dict:
    sub = _current_submission(session, m)
    criteria = session.exec(select(MilestoneCriterion).where(MilestoneCriterion.milestone_id == m.id)
                            .order_by(MilestoneCriterion.id))
    dispute = session.exec(select(Dispute).where(Dispute.milestone_id == m.id).order_by(Dispute.id.desc())).first()
    review_deadline = (wf.utc(m.submitted_at) + timedelta(days=wf.REVIEW_TIMEOUT_DAYS)
                       if m.status == "under_review" and m.submitted_at else None)
    return {
        "id": m.id, "contract_id": m.contract_id, "sequence": m.sequence, "title": m.title,
        "description": m.description, "due_at": wf.iso(m.due_at), "amount": wf.amount_str(m.amount),
        "status": m.status, "allowed_actions": _allowed_actions(m, contract, user),
        "active_transaction_id": None, "review_deadline": wf.iso(review_deadline),
        "submitted_at": wf.iso(m.submitted_at), "settled_at": wf.iso(m.settled_at),
        "deliverable_hash": m.deliverable_hash, "revision_count": m.revision_count, "revision_note": m.revision_note,
        "criteria": [{"id": c.id, "description": c.description, "is_mandatory": c.is_mandatory} for c in criteria],
        "current_submission": _submission_view(session, sub) if sub else None,
        "dispute_id": dispute.id if dispute else None,
    }


def _project_view(session: Session, contract: Contract) -> dict:
    job = session.get(Job, contract.job_id)
    req = session.get(JobRequirement, contract.job_id)
    return {"id": job.id, "contract_id": contract.id, "title": job.title, "category": req.category if req else "",
            "status": PROJECT_STATUS.get(contract.status, contract.status), "description": job.description,
            "expected_start_at": wf.iso(contract.start_at), "expected_end_at": wf.iso(contract.end_at)}


def _escrow_view(session: Session, contract: Contract) -> Optional[dict]:
    escrow = session.exec(select(Escrow).where(Escrow.contract_id == contract.id)).first()
    if escrow is None:
        return None
    remaining = sum(m.amount for m in wf.milestones_of(session, contract.id) if m.status not in wf.SETTLED)
    return {"status": escrow.status, "locked_amount": wf.amount_str(escrow.locked_amount),
            "remaining_locked_amount": wf.amount_str(remaining), "funded_at": wf.iso(escrow.funded_at),
            "transaction_hash": escrow.tx_hash, "close_transaction_hash": escrow.close_tx_hash,
            "closed_at": wf.iso(escrow.closed_at),
            "smart_contract_address": contract.onchain_contract_address,
            "onchain_contract_id": contract.onchain_contract_id}


def _contract_actions(contract: Contract, user: User) -> list[str]:
    if contract.status == "draft" and user.id == contract.freelancer_id:
        return ["accept"]
    if contract.status == "agreed" and user.id == contract.client_id:
        return ["fund"]
    if contract.status == "active" and user.id == contract.freelancer_id and not contract.withdrawn_at:
        return ["withdraw"]
    if contract.status == "active" and user.id == contract.client_id and contract.withdrawn_at:
        return ["reassign"]
    return []


def _contract_view(session: Session, contract: Contract, user: User) -> dict:
    return {
        "id": contract.id, "project_id": contract.job_id, "status": contract.status,
        "total_amount": wf.amount_str(contract.total_amount), "scope": contract.scope,
        "start_at": wf.iso(contract.start_at), "end_at": wf.iso(contract.end_at),
        "contract_hash": contract.contract_hash, "terms": json.loads(contract.terms_json or "{}"),
        "accepted_at": wf.iso(contract.accepted_at), "withdrawn_at": wf.iso(contract.withdrawn_at),
        "allowed_actions": _contract_actions(contract, user),
        "client": _person(session.get(User, contract.client_id)),
        "freelancer": _person(session.get(User, contract.freelancer_id)),
        "escrow": _escrow_view(session, contract),
        "milestones": [_milestone_view(session, m, contract, user) for m in wf.milestones_of(session, contract.id)],
        "created_at": wf.iso(contract.created_at),
    }


def _integrity(contract: Contract) -> Optional[dict]:
    """Bandingkan hash dokumen off-chain dengan hash yang terkunci di smart contract."""
    if contract.onchain_contract_id is None:
        return None
    try:
        onchain_hash = chain.get_contract(contract.onchain_contract_id)["offchain_contract_hash"]
    except Exception:  # blockchain mati: tampilkan kontrak tanpa pemeriksaan
        return {"onchain_hash": None, "matches": None}
    recomputed = hashlib.sha256(contract.terms_json.encode()).hexdigest()
    onchain_hash = onchain_hash.removeprefix("0x")
    return {"onchain_hash": onchain_hash, "recomputed_hash": recomputed,
            "matches": onchain_hash == recomputed == contract.contract_hash}


# ------------------------------------------------------------------ kontrak (IContractService)

@router.post("/contracts", status_code=201)
def create_contract_draft(req: CreateContractRequest, user: User = Depends(current_user),
                          session: Session = Depends(get_db)) -> dict:
    """createContractDraft: simpan kesepakatan off-chain dan hitung SHA-256 dokumennya."""
    _require_role(user, "client")
    inv = _accepted_invitation(session, req.invitation_id, user)
    if session.exec(select(Contract).where(Contract.job_id == inv.job_id)).first():
        raise HTTPException(status_code=409, detail="Job ini sudah punya kontrak.")

    terms = {
        "version": 1, "job_id": inv.job_id, "client_id": user.id, "freelancer_id": inv.freelancer_id,
        "scope": req.scope.strip(), "start_at": wf.iso(req.start_at), "end_at": wf.iso(req.end_at),
        "token": TOKEN_SYMBOL, "review_timeout_days": wf.REVIEW_TIMEOUT_DAYS,
        "milestones": [
            {"sequence": i, "title": m.title.strip(), "description": m.description.strip(), "amount": m.amount,
             "due_at": wf.iso(m.due_at),
             "criteria": [{"description": c.description.strip(), "is_mandatory": c.is_mandatory} for c in m.criteria]}
            for i, m in enumerate(req.milestones, start=1)
        ],
    }
    terms_json = _canonical(terms)
    contract = Contract(job_id=inv.job_id, client_id=user.id, freelancer_id=inv.freelancer_id,
                        total_amount=sum(m.amount for m in req.milestones), scope=terms["scope"],
                        start_at=req.start_at, end_at=req.end_at, terms_json=terms_json,
                        contract_hash=hashlib.sha256(terms_json.encode()).hexdigest())
    session.add(contract)
    session.flush()
    for spec, m in zip(terms["milestones"], req.milestones):
        row = Milestone(contract_id=contract.id, sequence=spec["sequence"], title=spec["title"],
                        description=spec["description"], amount=m.amount, due_at=m.due_at)
        session.add(row)
        session.flush()
        session.add_all(MilestoneCriterion(milestone_id=row.id, **c) for c in spec["criteria"])
    wf.log_activity(session, contract.id,
                    f"Contract drafted · SHA-256 {contract.contract_hash[:12]}… · waiting for freelancer approval")
    session.commit()
    session.refresh(contract)
    return {"data": {"contract_id": contract.id, "sha256_hash": contract.contract_hash, "status": contract.status,
                     "contract": _contract_view(session, contract, user)}}


@router.get("/contracts/{contract_id}")
def get_contract(contract_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    contract = _contract(session, contract_id, user)
    return {"data": {**_contract_view(session, contract, user), "integrity": _integrity(contract)}}


@router.post("/contracts/{contract_id}/accept")
def accept_contract(contract_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    """Freelancer menyetujui kontrak (ruang lingkup, milestone, kriteria penerimaan) sebelum dana dikunci."""
    contract = _contract(session, contract_id, user)
    if user.id != contract.freelancer_id:
        raise HTTPException(status_code=403, detail="Hanya freelancer kontrak ini yang boleh menyetujui.")
    if contract.status != "draft":
        raise HTTPException(status_code=409, detail=f"Kontrak berstatus {contract.status}, bukan draft.")
    contract.status = "agreed"
    contract.accepted_at = wf.now()
    session.add(contract)
    wf.log_activity(session, contract.id, f"Contract accepted by {user.name}; waiting for escrow funding")
    session.commit()
    session.refresh(contract)
    return {"data": {"contract_id": contract.id, "status": contract.status, "sha256_hash": contract.contract_hash,
                     "accepted_at": wf.iso(contract.accepted_at), "contract": _contract_view(session, contract, user)}}


@router.post("/contracts/{contract_id}/withdraw")
def withdraw_from_contract(contract_id: int, user: User = Depends(current_user),
                           session: Session = Depends(get_db)) -> dict:
    """Freelancer menyerah (khusus demo): milestone tersisa menunggu client mengalihkannya ke freelancer lain."""
    contract = _contract(session, contract_id, user)
    if user.id != contract.freelancer_id:
        raise HTTPException(status_code=403, detail="Hanya freelancer kontrak ini yang boleh menyerah.")
    _require_active(contract)
    if contract.withdrawn_at:
        raise HTTPException(status_code=409, detail="Freelancer sudah menyerah dari kontrak ini.")
    contract.withdrawn_at = wf.now()
    session.add(contract)
    wf.log_activity(session, contract.id,
                    f"{user.name} withdrew from the project; remaining milestones await reassignment")
    session.commit()
    session.refresh(contract)
    return {"data": {"contract_id": contract.id, "withdrawn_at": wf.iso(contract.withdrawn_at),
                     "contract": _contract_view(session, contract, user)}}


# ------------------------------------------------------------------ escrow (IEscrowService)

@router.post("/escrow/lock", status_code=201)
def create_and_lock_escrow(req: LockEscrowRequest, user: User = Depends(current_user),
                           session: Session = Depends(get_db)) -> dict:
    """createAndLockEscrow: catat hash kontrak on-chain dan kunci seluruh dana milestone sekaligus."""
    contract = _own_contract(session, req.contract_id, user)
    if contract.status == "draft":
        raise HTTPException(status_code=409, detail="Kontrak belum disetujui freelancer.")
    if contract.status != "agreed":
        raise HTTPException(status_code=409, detail="Escrow kontrak ini sudah dikunci.")
    rows = wf.milestones_of(session, contract.id)
    amounts = [wf.to_wei(m.amount) for m in rows]
    client_wallet = chain.user_address(contract.client_id)
    freelancer_wallet = chain.user_address(contract.freelancer_id)
    balance = wf.chain_call(chain.token_balance, client_wallet)
    if balance < sum(amounts):
        raise HTTPException(status_code=409, detail=(
            f"Saldo {TOKEN_SYMBOL} tidak cukup: punya {wf.amount_str(wf.from_wei(balance))}, "
            f"butuh {wf.amount_str(contract.total_amount)}. Isi dulu lewat POST /api/v1/wallet/faucet."))

    tx = wf.chain_call(chain.create_and_lock_escrow, contract.client_id, bytes.fromhex(contract.contract_hash),
                       freelancer_wallet, amounts)
    funded_at = wf.now()
    contract.onchain_contract_id = tx["contract_id"]
    contract.onchain_contract_address = tx["escrow_address"]
    contract.status = "active"
    session.add(contract)
    session.add(Escrow(contract_id=contract.id, tx_hash=tx["tx_hash"], locked_amount=contract.total_amount,
                       funded_at=funded_at))
    for uid, wallet in ((contract.client_id, client_wallet), (contract.freelancer_id, freelancer_wallet)):
        u = session.get(User, uid)
        u.wallet_address = wallet
        session.add(u)
    wf.log_activity(session, contract.id,
                    f"Escrow funded · {wf.amount_str(contract.total_amount)} {TOKEN_SYMBOL} locked")
    session.flush()
    wf.start_next_milestone(session, contract)
    session.commit()
    return {"data": {"status": "locked", "project_id": contract.job_id, "contract_id": contract.id,
                     "onchain_contract_id": contract.onchain_contract_id,
                     "smart_contract_address": contract.onchain_contract_address, "transaction_hash": tx["tx_hash"],
                     "locked_amount": wf.amount_str(contract.total_amount), "token_symbol": TOKEN_SYMBOL,
                     "timestamp": wf.iso(funded_at)}}


@router.post("/escrow/{contract_id}/reassign")
def reassign_remaining_milestones(contract_id: int, req: ReassignRequest, user: User = Depends(current_user),
                                  session: Session = Depends(get_db)) -> dict:
    """reassignRemainingMilestones: alihkan milestone tersisa ke freelancer pengganti tanpa membuka dana."""
    contract = _own_contract(session, contract_id, user)
    _require_active(contract)
    if not contract.withdrawn_at:
        raise HTTPException(status_code=409, detail="Reassign hanya bisa setelah freelancer menyerah dari proyek.")
    inv = _accepted_invitation(session, req.invitation_id, user)
    if inv.job_id != contract.job_id:
        raise HTTPException(status_code=422, detail="Undangan pengganti harus untuk job yang sama.")
    if inv.freelancer_id == contract.freelancer_id:
        raise HTTPException(status_code=422, detail="Freelancer pengganti harus berbeda dari freelancer sekarang.")
    new_wallet = chain.user_address(inv.freelancer_id)
    tx = wf.chain_call(chain.reassign_remaining_onchain, contract.client_id, contract.onchain_contract_id, new_wallet)

    # Sama dengan Escrow.sol: milestone LOCKED/SUBMITTED pindah ke freelancer baru dan kembali LOCKED.
    moved = 0
    for m in wf.milestones_of(session, contract.id):
        if m.status not in ("pending", "in_progress", "under_review", "revision_required"):
            continue
        moved += 1
        if m.status in ("under_review", "revision_required"):
            m.status = "in_progress"
        m.submitted_at = m.deliverable_hash = m.deliverable_url = m.revision_note = None
        m.revision_count = 0
        session.add(m)
        for sub in session.exec(select(Submission).where(Submission.milestone_id == m.id,
                                                         Submission.status == "submitted")):
            sub.status = "superseded"
            session.add(sub)
    previous = session.get(User, contract.freelancer_id)
    contract.freelancer_id = inv.freelancer_id
    contract.withdrawn_at = None
    session.add(contract)
    newcomer = session.get(User, inv.freelancer_id)
    newcomer.wallet_address = new_wallet
    session.add(newcomer)
    wf.log_activity(session, contract.id,
                    f"{moved} remaining milestone(s) reassigned from {previous.name} to {newcomer.name}")
    session.flush()
    wf.start_next_milestone(session, contract)
    session.commit()
    return {"data": {"status": "reassigned", "contract_id": contract.id, "new_freelancer": _person(newcomer),
                     "new_freelancer_wallet": new_wallet, "reassigned_milestones": moved,
                     "transaction_hash": tx["tx_hash"]}}


@router.post("/escrow/{contract_id}/close")
def close_contract(contract_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    """closeContract: catat penyelesaian akhir proyek secara imutabel setelah semua milestone selesai."""
    contract = _contract(session, contract_id, user)
    _require_active(contract)
    if any(m.status not in wf.SETTLED for m in wf.milestones_of(session, contract.id)):
        raise HTTPException(status_code=409, detail="Semua milestone harus selesai sebelum kontrak ditutup.")
    tx = wf.chain_call(chain.close_contract_onchain, contract.onchain_contract_id)
    contract.status = "completed"
    session.add(contract)
    escrow = session.exec(select(Escrow).where(Escrow.contract_id == contract.id)).one()
    escrow.status = "closed"
    escrow.close_tx_hash = tx["tx_hash"]
    escrow.closed_at = wf.now()
    session.add(escrow)
    wf.log_activity(session, contract.id, "Contract closed on-chain")
    session.commit()
    return {"data": {"status": "closed", "final_status": contract.status, "contract_id": contract.id,
                     "transaction_hash": tx["tx_hash"], "closed_at": wf.iso(escrow.closed_at)}}


# ------------------------------------------------------------------ milestone

@router.get("/milestones/{milestone_id}")
def get_milestone(milestone_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    milestone, contract = _milestone(session, milestone_id, user)
    return {"data": _milestone_view(session, milestone, contract, user)}


@router.post("/milestones/{milestone_id}/submit")
def submit_milestone_deliverable(
    milestone_id: int,
    req: SubmitRequest,
    idempotency_key: Optional[str] = Header(default=None, max_length=200),
    user: User = Depends(current_user),
    session: Session = Depends(get_db),
) -> dict:
    """submitMilestoneDeliverable: simpan hasil kerja off-chain, catat hash-nya on-chain, status menunggu review."""
    milestone, contract = _milestone(session, milestone_id, user)
    if user.id != contract.freelancer_id:
        raise HTTPException(status_code=403, detail="Hanya freelancer kontrak ini yang boleh menyerahkan hasil.")
    if idempotency_key:  # permintaan yang sama dikirim ulang (respons sebelumnya hilang)
        replay = session.exec(select(Submission).where(Submission.milestone_id == milestone.id,
                                                       Submission.idempotency_key == idempotency_key)).first()
        if replay:
            return {"data": _milestone_view(session, milestone, contract, user)}
    _require_active(contract)
    if contract.withdrawn_at:
        raise HTTPException(status_code=409, detail="Kamu sudah menyerah dari proyek ini.")
    if milestone.status not in ("in_progress", "revision_required"):
        raise HTTPException(status_code=409, detail=f"Milestone berstatus {milestone.status}, bukan in_progress.")
    resubmission = milestone.status == "revision_required"

    repo, demo = (req.repository_url or "").strip() or None, (req.demo_url or "").strip() or None
    revision = (req.repository_revision or "").strip() or None
    if not (req.file_ids or repo or demo):
        raise HTTPException(status_code=422, detail="Lampirkan berkas, atau isi repository URL / demo URL.")
    if any(u and not _http_url(u) for u in (repo, demo)):
        raise HTTPException(status_code=422, detail="URL harus diawali http:// atau https://.")
    if revision and not repo:
        raise HTTPException(status_code=422, detail="Isi repository URL untuk revision.")
    criteria = session.exec(select(MilestoneCriterion).where(MilestoneCriterion.milestone_id == milestone.id)).all()
    declared = {d.criterion_id for d in req.declared_criteria if d.declared}
    if any(c.is_mandatory and c.id not in declared for c in criteria):
        raise HTTPException(status_code=422, detail="Semua kriteria wajib harus dikonfirmasi.")
    if declared - {c.id for c in criteria}:
        raise HTTPException(status_code=422, detail="Ada kriteria yang bukan milik milestone ini.")
    files = [session.get(StoredFile, i) for i in dict.fromkeys(req.file_ids)]
    if any(f is None or f.owner_id != user.id or f.purpose != "deliverable" or f.submission_id for f in files):
        raise HTTPException(status_code=422, detail="Berkas tidak ditemukan atau sudah dipakai.")

    declared_json = json.dumps([{"criterion_id": c.id, "declared": c.id in declared} for c in criteria])
    manifest = _canonical({"milestone_id": milestone.id, "title": req.title.strip(), "notes": req.notes or "",
                           "files": [{"name": f.original_filename, "sha256": f.sha256} for f in files],
                           "repository_url": repo, "repository_revision": revision, "demo_url": demo,
                           "declared_criteria": json.loads(declared_json)})
    digest = hashlib.sha256(manifest.encode()).hexdigest()
    tx = wf.chain_call(chain.submit_milestone_onchain, user.id, contract.onchain_contract_id,
                       wf.onchain_index(milestone), bytes.fromhex(digest))

    sub = Submission(milestone_id=milestone.id, freelancer_id=user.id, title=req.title.strip(), notes=req.notes,
                     repository_url=repo, repository_revision=revision, demo_url=demo,
                     declared_criteria=declared_json, deliverable_hash=digest, tx_hash=tx["tx_hash"],
                     idempotency_key=idempotency_key)
    session.add(sub)
    session.flush()
    for f in files:
        f.submission_id = sub.id
        session.add(f)
    milestone.status = "under_review"
    milestone.submitted_at = sub.submitted_at
    milestone.deliverable_hash = digest
    milestone.deliverable_url = repo or demo or (f"/api/v1/files/{files[0].id}/content" if files else None)
    session.add(milestone)
    verb = f"resubmitted after revision #{milestone.revision_count}" if resubmission else "submitted for review"
    wf.log_activity(session, contract.id, f"Milestone {milestone.sequence} {verb} by {user.name}")
    session.commit()
    return {"data": _milestone_view(session, milestone, contract, user)}


@router.post("/milestones/{milestone_id}/approve")
def release_milestone_payment(milestone_id: int, req: ApproveRequest = Body(default_factory=ApproveRequest),
                              user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    """releaseMilestonePayment: client menyetujui hasil, smart contract mencairkan dana ke freelancer."""
    milestone, contract = _milestone(session, milestone_id, user)
    _require_role(user, "client")
    if user.id != contract.client_id:
        raise HTTPException(status_code=403, detail="Hanya client kontrak ini yang boleh menyetujui.")
    _require_active(contract)
    if milestone.status != "under_review":
        raise HTTPException(status_code=409, detail=f"Milestone berstatus {milestone.status}, bukan under_review.")
    tx = wf.chain_call(chain.release_milestone_onchain, contract.onchain_contract_id, wf.onchain_index(milestone),
                       client_user_id=user.id)
    note = f" · {req.approval_notes.strip()}" if req.approval_notes and req.approval_notes.strip() else ""
    wf.settle_milestone(session, contract, milestone, "released",
                        f"Milestone {milestone.sequence} approved; {wf.amount_str(milestone.amount)} "
                        f"{TOKEN_SYMBOL} released{note}")
    session.commit()
    remaining = sum(m.amount for m in wf.milestones_of(session, contract.id) if m.status not in wf.SETTLED)
    return {"data": {"status": "disbursed", "milestone_id": milestone.id,
                     "disbursed_amount": wf.amount_str(milestone.amount),
                     "recipient_wallet": chain.user_address(contract.freelancer_id), "transaction_hash": tx["tx_hash"],
                     "remaining_escrow_balance": wf.amount_str(remaining),
                     "milestone": _milestone_view(session, milestone, contract, user)}}


@router.post("/milestones/{milestone_id}/request-revision")
def request_revision(milestone_id: int, req: RevisionRequest, user: User = Depends(current_user),
                     session: Session = Depends(get_db)) -> dict:
    """Client menolak hasil dan meminta perbaikan: dana tetap terkunci, timer review berhenti sampai submit ulang."""
    milestone, contract = _milestone(session, milestone_id, user)
    _require_role(user, "client")
    if user.id != contract.client_id:
        raise HTTPException(status_code=403, detail="Hanya client kontrak ini yang boleh meminta perbaikan.")
    _require_active(contract)
    if milestone.status != "under_review":
        raise HTTPException(status_code=409, detail=f"Milestone berstatus {milestone.status}, bukan under_review.")
    tx = wf.chain_call(chain.request_revision_onchain, user.id, contract.onchain_contract_id,
                       wf.onchain_index(milestone))
    for old in session.exec(select(Submission).where(Submission.milestone_id == milestone.id,
                                                     Submission.status == "submitted")):
        old.status = "superseded"  # hasil yang ditolak tetap tersimpan sebagai riwayat
        session.add(old)
    milestone.status = "revision_required"
    milestone.revision_count += 1
    milestone.revision_note = req.notes.strip()
    milestone.submitted_at = None
    session.add(milestone)
    wf.log_activity(session, contract.id,
                    f"Revision #{milestone.revision_count} requested for Milestone {milestone.sequence}: "
                    f"{milestone.revision_note}")
    session.commit()
    return {"data": {"status": "revision_required", "milestone_id": milestone.id,
                     "revision_count": milestone.revision_count, "transaction_hash": tx["tx_hash"],
                     "milestone": _milestone_view(session, milestone, contract, user)}}


# ------------------------------------------------------------------ proyek (bentuk data projectWork.ts)

@router.get("/projects")
def list_projects(page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=50),
                  user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    """Proyek yang punya kontrak: milik client, atau yang dikerjakan freelancer."""
    mine = or_(Contract.client_id == user.id, Contract.freelancer_id == user.id)
    total = session.exec(select(func.count()).select_from(Contract).where(mine)).one()
    rows = session.exec(select(Contract).where(mine).order_by(Contract.id.desc())
                        .offset((page - 1) * page_size).limit(page_size))
    return {"data": [_project_view(session, c) for c in rows],
            "meta": {"total": total, "page": page, "page_size": page_size}}


@router.get("/projects/{project_id}/workspace")
def project_workspace(project_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    contract = _project_contract(session, project_id, user)
    milestones = wf.milestones_of(session, contract.id)
    activity = session.exec(select(ActivityLog).where(ActivityLog.contract_id == contract.id)
                            .order_by(ActivityLog.id.desc()).limit(20))
    files = session.exec(select(StoredFile).join(Submission, StoredFile.submission_id == Submission.id)
                         .where(Submission.milestone_id.in_([m.id for m in milestones]),
                                Submission.status == "submitted").order_by(StoredFile.id))
    return {"data": {
        "project": _project_view(session, contract),
        "milestones": [_milestone_view(session, m, contract, user) for m in milestones],
        "contract": {"id": contract.id, "status": contract.status,
                     "total_amount": wf.amount_str(contract.total_amount), "contract_hash": contract.contract_hash,
                     "onchain_contract_id": contract.onchain_contract_id,
                     "accepted_at": wf.iso(contract.accepted_at), "withdrawn_at": wf.iso(contract.withdrawn_at),
                     "allowed_actions": _contract_actions(contract, user)},
        "agreement": {"version": 1, "hash": contract.contract_hash, "terms": {"scope": contract.scope}},
        "escrow": _escrow_view(session, contract),
        "client": _person(session.get(User, contract.client_id)),
        "freelancer": _person(session.get(User, contract.freelancer_id)),
        "recent_activity": [{"summary": a.summary, "created_at": wf.iso(a.created_at)} for a in activity],
        "files": [_file_view(f) for f in files],
    }}


# ------------------------------------------------------------------ berkas off-chain

@router.post("/files", status_code=201)
async def upload_file(file: UploadFile = File(...), purpose: str = Form(default="deliverable"),
                      user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    if purpose != "deliverable":
        raise HTTPException(status_code=422, detail="purpose yang didukung: deliverable")
    name = Path(file.filename or "").name
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Format yang didukung: ZIP, PDF, PNG, JPEG, TXT.")
    data = await file.read(MAX_FILE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=422, detail="Berkas kosong.")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Berkas melebihi 20 MB.")
    folder = UPLOADS_DIR / DELIVERABLE_SUBDIR
    folder.mkdir(parents=True, exist_ok=True)
    stored = secrets.token_hex(16) + ext
    (folder / stored).write_bytes(data)
    row = StoredFile(owner_id=user.id, purpose=purpose, original_filename=name, stored_name=stored,
                     mime_type=mimetypes.guess_type(name)[0] or "application/octet-stream",
                     size_bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    session.add(row)
    session.commit()
    session.refresh(row)
    return {"data": _file_view(row)}


@router.get("/files/{file_id}/content")
def download_file(file_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)):
    """Pemilik, peserta kontrak, atau arbiter sengketa milestone tsb boleh mengunduh."""
    row = session.get(StoredFile, file_id)
    allowed = row is not None and row.owner_id == user.id
    if row is not None and not allowed and row.submission_id:
        milestone = session.get(Milestone, session.get(Submission, row.submission_id).milestone_id)
        contract = session.get(Contract, milestone.contract_id)
        arbiter = session.exec(select(Dispute).where(Dispute.milestone_id == milestone.id,
                                                     Dispute.arbiter_id == user.id)).first()
        allowed = _is_participant(user, contract) or arbiter is not None
    if not allowed:
        raise HTTPException(status_code=404, detail=f"berkas {file_id} tidak ditemukan")
    return FileResponse(UPLOADS_DIR / DELIVERABLE_SUBDIR / row.stored_name, media_type=row.mime_type,
                        filename=row.original_filename)


# ------------------------------------------------------------------ wallet

def _wallet_view(session: Session, user: User) -> dict:
    address = chain.user_address(user.id)
    try:
        balance = wf.amount_str(wf.from_wei(chain.token_balance(address)))
    except Exception:  # blockchain mati: saldo tidak diketahui
        balance = None
    rows = session.exec(select(Milestone, Contract).join(Contract, Milestone.contract_id == Contract.id)
                        .where(Contract.status.in_(("active", "completed")),
                               or_(Contract.client_id == user.id, Contract.freelancer_id == user.id))).all()
    as_freelancer = [m for m, c in rows if c.freelancer_id == user.id]
    as_client = [m for m, c in rows if c.client_id == user.id]
    split_payouts = {d.milestone_id: d.freelancer_payout or 0 for d in session.exec(
        select(Dispute).where(Dispute.milestone_id.in_([m.id for m in as_freelancer]), Dispute.status == "resolved"))}
    earnings = sum(m.amount for m in as_freelancer if m.status == "released" and m.id not in split_payouts)
    earnings += sum(split_payouts.values())
    return {
        "address": address, "token_symbol": TOKEN_SYMBOL, "available_balance": balance,
        "pending_payout": wf.amount_str(sum(m.amount for m in as_freelancer if m.status not in wf.SETTLED)),
        "total_earnings": wf.amount_str(earnings),
        "locked_in_escrow": wf.amount_str(sum(m.amount for m in as_client if m.status not in wf.SETTLED)),
    }


@router.get("/wallet")
def wallet(user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    return {"data": _wallet_view(session, user)}


@router.post("/wallet/faucet")
def wallet_faucet(req: FaucetRequest = Body(default_factory=FaucetRequest), user: User = Depends(current_user),
                  session: Session = Depends(get_db)) -> dict:
    """Isi wallet dengan token simulasi SIM-IDR (faucet jaringan lokal)."""
    address = chain.user_address(user.id)
    tx = wf.chain_call(chain.faucet, address, wf.to_wei(req.amount))
    user.wallet_address = address
    session.add(user)
    session.commit()
    return {"data": {**_wallet_view(session, user), "minted": wf.amount_str(req.amount), "transaction_hash": tx["tx_hash"]}}
