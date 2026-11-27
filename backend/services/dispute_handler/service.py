"""Dispute Resolution Service (SoaML: DisputeResolutionContract).

Alur:
1. Client/freelancer mengajukan sengketa atas satu milestone (`POST /disputes`) beserta bukti.
   Tanpa unggahan berkas, backend melampirkan bukti standar `ringkasan-sengketa.txt` (ringkasan kasus).
   Sengketa baru boleh setelah perbaikan tidak disepakati: client atas hasil revisi yang tetap ditolak,
   freelancer atas permintaan perbaikan yang tidak ia setujui (workflow.dispute_block_reason).
   Bukti disimpan off-chain di `uploads/disputes/` dan di-hash SHA-256; milestone dibekukan
   on-chain lewat `Escrow.raiseDispute` sehingga dana tidak bisa dicairkan (termasuk auto-release).
2. Kedua pihak boleh menambah bukti selama sengketa masih terbuka (`POST /disputes/{id}/evidence`).
3. Arbiter yang ditunjuk memberi putusan (`POST /disputes/{id}/verdict`): RELEASE, REFUND, atau
   SPLIT; putusan dieksekusi on-chain lewat `Escrow.executeArbiterVerdict`.
   REFUND mengakhiri proyek: semua milestone yang belum selesai hangus, seluruh dana yang masih terkunci
   kembali ke client, lalu kontrak ditutup (milestone yang sudah dibayar tidak berubah).

Syarat: kontrak sudah punya escrow on-chain (`Contract.onchain_contract_id`).
"""
import hashlib
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from pydantic import Field as PField
from sqlmodel import Session, or_, select

from database import get_db
from models import Contract, Dispute, DisputeEvidence, Job, Milestone, User
from services.auth.router import current_user
from services.orchestrator import workflow as wf
from services.orchestrator.db_models import MilestoneCriterion
from services.smart_contract import service as chain

UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
EVIDENCE_SUBDIR = "disputes"
MAX_EVIDENCE_FILES = 5
MAX_EVIDENCE_BYTES = 10 * 1024 * 1024
DISPUTABLE_ONCHAIN = {"LOCKED", "SUBMITTED"}
MILESTONE_STATUS_AFTER_VERDICT = {"RELEASE": "released", "REFUND": "refunded", "SPLIT": "split"}


class VerdictRequest(BaseModel):
    verdict_action: Literal["RELEASE", "REFUND", "SPLIT"]
    freelancer_share_percentage: Optional[int] = PField(default=None, ge=1, le=99)
    verdict_reasoning: str = PField(min_length=1, max_length=4000)


router = APIRouter(prefix="/api/v1/disputes", tags=["Disputes"])


# ------------------------------------------------------------------ helper

def _person(user: Optional[User]) -> Optional[dict]:
    return {"id": user.id, "name": user.name, "role": user.role} if user else None


def _is_participant(user: User, contract: Contract) -> bool:
    return user.id in (contract.client_id, contract.freelancer_id)


def _onchain_milestone(contract: Contract, index: int) -> tuple[dict, dict]:
    if contract.onchain_contract_id is None:
        raise HTTPException(status_code=409, detail="Escrow kontrak ini belum dikunci di blockchain.")
    onchain = wf.chain_call(chain.get_contract, contract.onchain_contract_id)
    if index >= len(onchain["milestones"]):
        raise HTTPException(status_code=409, detail="Milestone ini tidak ada di escrow on-chain.")
    return onchain, onchain["milestones"][index]


async def _read_evidence(files: list[UploadFile]) -> list[tuple[str, bytes, str]]:
    """Validasi dan hash bukti SEBELUM ada transaksi on-chain; kembalikan (nama, isi, sha256)."""
    files = [f for f in files if f.filename]
    if len(files) > MAX_EVIDENCE_FILES:
        raise HTTPException(status_code=422, detail=f"Maksimal {MAX_EVIDENCE_FILES} berkas bukti per unggahan.")
    result = []
    for f in files:
        data = await f.read(MAX_EVIDENCE_BYTES + 1)
        if len(data) > MAX_EVIDENCE_BYTES:
            raise HTTPException(status_code=413, detail=f"Berkas {f.filename} melebihi 10 MB.")
        if not data:
            raise HTTPException(status_code=422, detail=f"Berkas {f.filename} kosong.")
        result.append((Path(f.filename).name, data, hashlib.sha256(data).hexdigest()))
    return result


def _save_evidence(session: Session, dispute_id: int, uploader: User, files: list[tuple[str, bytes, str]]) -> None:
    folder = UPLOADS_DIR / EVIDENCE_SUBDIR
    folder.mkdir(parents=True, exist_ok=True)
    for name, data, digest in files:
        stored = secrets.token_hex(16) + Path(name).suffix.lower()[:16]
        (folder / stored).write_bytes(data)
        session.add(DisputeEvidence(dispute_id=dispute_id, uploaded_by_id=uploader.id, filename=name,
                                    stored_name=stored, size_bytes=len(data), sha256=digest))


TEMPLATE_EVIDENCE_NAME = "ringkasan-sengketa.txt"


def _template_evidence(session: Session, milestone: Milestone, contract: Contract, user: User,
                       reason: str) -> list[tuple[str, bytes, str]]:
    """Bukti standar (demo, tanpa unggah berkas): ringkasan kasus dari data kontrak yang sudah tercatat."""
    job = session.get(Job, contract.job_id)
    client = session.get(User, contract.client_id)
    freelancer = session.get(User, contract.freelancer_id)
    criteria = session.exec(select(MilestoneCriterion).where(MilestoneCriterion.milestone_id == milestone.id)
                            .order_by(MilestoneCriterion.id)).all()
    role = "Client" if user.id == contract.client_id else "Freelancer"
    lines = [
        "RINGKASAN SENGKETA (bukti standar platform Gigly)",
        "=" * 48,
        f"Proyek           : {job.title if job else '-'} (job #{contract.job_id})",
        f"Kontrak          : #{contract.id} - escrow on-chain #{contract.onchain_contract_id}",
        f"Client           : {client.name if client else '-'}",
        f"Freelancer       : {freelancer.name if freelancer else '-'}",
        f"Milestone        : {milestone.sequence} - {milestone.title}",
        f"Nilai milestone  : {wf.amount_str(milestone.amount)} SIM-IDR",
        f"Diajukan oleh    : {user.name} ({role})",
        f"Waktu pengajuan  : {wf.iso(wf.now())}",
        "",
        "Alasan sengketa:",
        f"  {reason.strip()}",
        "",
        f"Riwayat perbaikan: {milestone.revision_count} kali diminta",
        f"Catatan perbaikan terakhir: {milestone.revision_note or '-'}",
        "",
        "Hasil kerja terakhir:",
        f"  URL   : {milestone.deliverable_url or '-'}",
        f"  SHA-256: {milestone.deliverable_hash or '-'}",
        "",
        "Kriteria penerimaan yang disepakati:",
        *[f"  {i}. {c.description}{' (wajib)' if c.is_mandatory else ''}" for i, c in enumerate(criteria, 1)],
        *([] if criteria else ["  -"]),
        "",
        "Dokumen ini dibuat otomatis dari data kontrak dan milestone saat sengketa diajukan.",
    ]
    data = ("\n".join(lines) + "\n").encode("utf-8")
    return [(TEMPLATE_EVIDENCE_NAME, data, hashlib.sha256(data).hexdigest())]


def _pick_arbiter(session: Session, onchain_arbiter: str) -> User:
    """Arbiter yang wallet-nya sama dengan arbiter on-chain; jika tidak ada, akun arbiter pertama."""
    arbiters = session.exec(select(User).where(User.role == "arbiter").order_by(User.id)).all()
    if not arbiters:
        raise HTTPException(status_code=503, detail="Belum ada akun arbiter. Jalankan seed_arbiter terlebih dahulu.")
    for a in arbiters:
        if (a.wallet_address or "").lower() == onchain_arbiter.lower():
            return a
    return arbiters[0]


def _load(session: Session, dispute_id: int, user: User) -> tuple[Dispute, Milestone, Contract]:
    """Sengketa + milestone + kontraknya; 404 bila tidak ada atau user tidak berhak melihat."""
    dispute = session.get(Dispute, dispute_id)
    milestone = session.get(Milestone, dispute.milestone_id) if dispute else None
    contract = session.get(Contract, milestone.contract_id) if milestone else None
    if contract is None or not (_is_participant(user, contract) or user.id == dispute.arbiter_id):
        raise HTTPException(status_code=404, detail=f"sengketa {dispute_id} tidak ditemukan")
    return dispute, milestone, contract


def _view(session: Session, dispute: Dispute, milestone: Milestone, contract: Contract) -> dict:
    job = session.get(Job, contract.job_id)
    evidence = session.exec(
        select(DisputeEvidence).where(DisputeEvidence.dispute_id == dispute.id).order_by(DisputeEvidence.id)
    ).all()
    verdict = None
    if dispute.verdict:
        # REFUND mengakhiri proyek: milestone lain yang ikut di-refund (hangus) pada putusan ini.
        voided = [m for m in wf.milestones_of(session, contract.id)
                  if dispute.verdict == "REFUND" and m.id != milestone.id and m.status == "refunded"]
        verdict = {
            "action": dispute.verdict,
            "freelancer_share_percentage": dispute.freelancer_share_pct,
            "client_refund_percentage": 100 - dispute.freelancer_share_pct,
            "reasoning": dispute.verdict_reasoning,
            "freelancer_payout": dispute.freelancer_payout,
            "client_refund": dispute.client_refund,
            "voided_milestones": [{"sequence": m.sequence, "title": m.title, "amount": m.amount} for m in voided],
            "voided_refund": sum(m.amount for m in voided),
            "transaction_hash": dispute.verdict_tx_hash,
            "resolved_at": wf.iso(dispute.resolved_at),
        }
    return {
        "id": dispute.id,
        "status": dispute.status,
        "reason": dispute.reason,
        "created_at": wf.iso(dispute.created_at),
        "raise_transaction_hash": dispute.raise_tx_hash,
        "raised_by": _person(session.get(User, dispute.raised_by_id)),
        "assigned_arbiter": _person(session.get(User, dispute.arbiter_id)),
        "client": _person(session.get(User, contract.client_id)),
        "freelancer": _person(session.get(User, contract.freelancer_id)),
        "contract": {"id": contract.id, "onchain_contract_id": contract.onchain_contract_id,
                     "job_id": contract.job_id, "job_title": job.title if job else None},
        "milestone": {"id": milestone.id, "index": wf.onchain_index(milestone),
                      "title": milestone.title, "amount": milestone.amount, "status": milestone.status,
                      "deliverable_url": milestone.deliverable_url, "deliverable_hash": milestone.deliverable_hash},
        "evidence": [
            {"id": e.id, "filename": e.filename, "url": f"/uploads/{EVIDENCE_SUBDIR}/{e.stored_name}",
             "sha256": e.sha256, "size_bytes": e.size_bytes,
             "uploaded_by": _person(session.get(User, e.uploaded_by_id)), "uploaded_at": wf.iso(e.uploaded_at)}
            for e in evidence
        ],
        "verdict": verdict,
    }


# ------------------------------------------------------------------ endpoint

@router.post("", status_code=201)
async def raise_dispute(
    milestone_id: int = Form(...),
    reason: str = Form(..., min_length=1, max_length=4000),
    evidence: list[UploadFile] = File(default=[]),
    user: User = Depends(current_user),
    session: Session = Depends(get_db),
) -> dict:
    """SoaML raiseDispute: bekukan dana milestone on-chain dan teruskan bukti ke arbiter."""
    milestone = session.get(Milestone, milestone_id)
    contract = session.get(Contract, milestone.contract_id) if milestone else None
    if contract is None or not _is_participant(user, contract):
        raise HTTPException(status_code=404, detail=f"milestone {milestone_id} tidak ditemukan")
    if milestone.status in wf.SETTLED:
        raise HTTPException(status_code=409, detail="Milestone ini sudah selesai dibayar atau dikembalikan.")
    if session.exec(select(Dispute).where(Dispute.milestone_id == milestone.id, Dispute.status == "open")).first():
        raise HTTPException(status_code=409, detail="Milestone ini sudah dalam sengketa.")
    blocked = wf.dispute_block_reason(milestone, contract, user.id)
    if blocked:
        raise HTTPException(status_code=409, detail=blocked)
    files = await _read_evidence(evidence)

    index = wf.onchain_index(milestone)
    onchain, onchain_ms = _onchain_milestone(contract, index)
    if onchain_ms["status"] not in DISPUTABLE_ONCHAIN:
        raise HTTPException(status_code=409, detail=f"Milestone on-chain berstatus {onchain_ms['status']}, tidak bisa disengketakan.")
    arbiter = _pick_arbiter(session, onchain["arbiter"])

    # Escrow.raiseDispute hanya menerima tanda tangan client atau freelancer milestone tsb.
    expected = onchain["client"] if user.id == contract.client_id else onchain_ms["freelancer"]
    if chain.user_address(user.id).lower() != expected.lower():
        raise HTTPException(status_code=409, detail="Wallet akun ini bukan pihak milestone tersebut di blockchain.")
    tx = wf.chain_call(chain.raise_dispute_onchain, user.id, contract.onchain_contract_id, index)

    dispute = Dispute(milestone_id=milestone.id, raised_by_id=user.id, arbiter_id=arbiter.id,
                      reason=reason.strip(), raise_tx_hash=tx["tx_hash"])
    session.add(dispute)
    milestone.status = "disputed"
    session.add(milestone)
    wf.log_activity(session, contract.id, f"Dispute raised on Milestone {milestone.sequence}; funds frozen")
    session.flush()
    # Tanpa unggahan berkas (alur demo): lampirkan ringkasan kasus standar sebagai bukti.
    _save_evidence(session, dispute.id, user, files or _template_evidence(session, milestone, contract, user, reason))
    session.commit()
    session.refresh(dispute)
    return {"data": _view(session, dispute, milestone, contract)}


@router.get("")
def list_disputes(
    status: Optional[Literal["open", "resolved"]] = Query(default=None),
    user: User = Depends(current_user),
    session: Session = Depends(get_db),
) -> dict:
    """Arbiter: sengketa yang ditugaskan kepadanya. Client/freelancer: sengketa pada kontraknya."""
    query = select(Dispute, Milestone, Contract).join(Milestone, Dispute.milestone_id == Milestone.id) \
        .join(Contract, Milestone.contract_id == Contract.id)
    if user.role == "arbiter":
        query = query.where(Dispute.arbiter_id == user.id)
    else:
        query = query.where(or_(Contract.client_id == user.id, Contract.freelancer_id == user.id))
    if status:
        query = query.where(Dispute.status == status)
    rows = session.exec(query.order_by(Dispute.id.desc())).all()
    return {"data": [_view(session, d, m, c) for d, m, c in rows]}


@router.get("/{dispute_id}")
def get_dispute(dispute_id: int, user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    return {"data": _view(session, *_load(session, dispute_id, user))}


@router.post("/{dispute_id}/evidence", status_code=201)
async def add_evidence(
    dispute_id: int,
    evidence: list[UploadFile] = File(...),
    user: User = Depends(current_user),
    session: Session = Depends(get_db),
) -> dict:
    """Client atau freelancer menambah bukti selama sengketa belum diputus."""
    dispute, milestone, contract = _load(session, dispute_id, user)
    if not _is_participant(user, contract):
        raise HTTPException(status_code=403, detail="Hanya client atau freelancer yang boleh menambah bukti.")
    if dispute.status != "open":
        raise HTTPException(status_code=409, detail="Sengketa sudah diputus; bukti tidak bisa ditambah.")
    files = await _read_evidence(evidence)
    if not files:
        raise HTTPException(status_code=422, detail="Lampirkan minimal satu berkas bukti.")
    _save_evidence(session, dispute.id, user, files)
    session.commit()
    return {"data": _view(session, dispute, milestone, contract)}


@router.post("/{dispute_id}/verdict")
def execute_verdict(
    dispute_id: int,
    req: VerdictRequest,
    user: User = Depends(current_user),
    session: Session = Depends(get_db),
) -> dict:
    """SoaML executeArbiterVerdict: eksekusi putusan arbiter pada smart contract."""
    dispute, milestone, contract = _load(session, dispute_id, user)
    if user.id != dispute.arbiter_id:
        raise HTTPException(status_code=403, detail="Hanya arbiter yang ditunjuk yang boleh memutus sengketa ini.")
    if dispute.status != "open":
        raise HTTPException(status_code=409, detail="Sengketa ini sudah diputus.")
    if req.verdict_action == "SPLIT" and req.freelancer_share_percentage is None:
        raise HTTPException(status_code=422, detail="SPLIT wajib menyertakan freelancer_share_percentage (1-99).")

    index = wf.onchain_index(milestone)
    onchain, onchain_ms = _onchain_milestone(contract, index)
    if onchain_ms["status"] != "DISPUTED":
        raise HTTPException(status_code=409, detail=f"Milestone on-chain berstatus {onchain_ms['status']}, bukan DISPUTED.")
    if wf.chain_call(chain.arbiter_address).lower() != onchain["arbiter"].lower():
        raise HTTPException(status_code=503, detail="ARBITER_PRIVATE_KEY bukan arbiter kontrak ini di blockchain.")

    share = {"RELEASE": 100, "REFUND": 0}.get(req.verdict_action, req.freelancer_share_percentage)
    amount = onchain_ms["amount"]
    freelancer_wei = amount * share // 100  # pembulatan sama dengan Escrow.sol
    tx = wf.chain_call(chain.execute_arbiter_verdict_onchain, contract.onchain_contract_id, index,
                     req.verdict_action, share if req.verdict_action == "SPLIT" else 0)
    if tx["status"] != 1:
        raise HTTPException(status_code=502, detail=f"Transaksi putusan gagal di blockchain ({tx['tx_hash']}).")

    dispute.status = "resolved"
    dispute.verdict = req.verdict_action
    dispute.freelancer_share_pct = share
    dispute.verdict_reasoning = req.verdict_reasoning.strip()
    dispute.freelancer_payout = wf.from_wei(freelancer_wei)
    dispute.client_refund = wf.from_wei(amount - freelancer_wei)
    dispute.verdict_tx_hash = tx["tx_hash"]
    dispute.resolved_at = wf.now()
    session.add(dispute)
    if req.verdict_action == "REFUND":  # proyek berakhir: milestone tersisa hangus (Escrow.sol sudah me-refund)
        wf.void_remaining_milestones(session, contract, milestone)
    wf.settle_milestone(session, contract, milestone, MILESTONE_STATUS_AFTER_VERDICT[req.verdict_action],
                        f"Arbiter verdict on Milestone {milestone.sequence}: {req.verdict_action} "
                        f"({share}% to freelancer)")
    if req.verdict_action == "REFUND" and all(m.status in wf.SETTLED for m in wf.milestones_of(session, contract.id)):
        try:
            close = wf.chain_call(chain.close_contract_onchain, contract.onchain_contract_id)
            wf.mark_contract_closed(session, contract, close["tx_hash"])
        except HTTPException:  # putusan tetap berlaku; kontrak bisa ditutup lagi lewat /escrow/{id}/close
            wf.log_activity(session, contract.id, "Contract could not be closed on-chain yet; retry closing later")
    session.commit()
    # Ringkasan putusan di level atas mengikuti contoh respons dokumen (Bab 3.2 no. 4).
    return {"data": {**_view(session, dispute, milestone, contract), "onchain_status": "resolved_onchain",
                     "dispute_id": dispute.id, "verdict_action": dispute.verdict,
                     "freelancer_payout": dispute.freelancer_payout, "client_refund": dispute.client_refund,
                     "transaction_hash": dispute.verdict_tx_hash, "resolved_at": wf.iso(dispute.resolved_at)}}
