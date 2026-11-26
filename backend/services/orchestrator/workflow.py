"""Aturan alur kontrak yang dipakai bersama oleh orchestrator, auto-release, dan dispute handler."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select
from web3 import Web3
from web3.exceptions import ContractLogicError

from models import Contract, Milestone
from services.orchestrator.db_models import ActivityLog

SETTLED = {"released", "refunded", "split"}
ACTIVE = {"in_progress", "under_review", "disputed"}  # milestone yang sedang berjalan
REVIEW_TIMEOUT_DAYS = 5
TOKEN_SYMBOL = "SIM-IDR"


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    """Serialisasi datetime sebagai ISO dan anggap nilai naif sebagai UTC."""
    if dt is None:
        return None
    return utc(dt).isoformat()


def utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def to_wei(amount: float) -> int:
    return Web3.to_wei(Decimal(str(amount)), "ether")


def from_wei(amount_wei: int) -> float:
    return float(Web3.from_wei(amount_wei, "ether"))


def amount_str(amount: Optional[float]) -> Optional[str]:
    """Jumlah SIM-IDR sebagai string bilangan bulat, sesuai format frontend."""
    return None if amount is None else str(int(amount))


def onchain_index(milestone: Milestone) -> int:
    """Escrow dikunci dengan milestone urut `sequence`, jadi index on-chain = sequence - 1."""
    return milestone.sequence - 1


def chain_call(fn, *args, **kwargs):
    """Panggil blockchain; terjemahkan kegagalan menjadi error HTTP yang jelas."""
    try:
        return fn(*args, **kwargs)
    except ContractLogicError as e:
        raise HTTPException(status_code=409, detail=f"Ditolak smart contract: {e.message or e}")
    except (ConnectionError, FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=503, detail=f"Blockchain tidak tersedia: {e}")


def milestones_of(session: Session, contract_id: int) -> list[Milestone]:
    return list(session.exec(
        select(Milestone).where(Milestone.contract_id == contract_id).order_by(Milestone.sequence)))


def log_activity(session: Session, contract_id: int, summary: str) -> None:
    session.add(ActivityLog(contract_id=contract_id, summary=summary))


def start_next_milestone(session: Session, contract: Contract) -> Optional[Milestone]:
    """Milestone dikerjakan berurutan: bila tidak ada yang sedang berjalan, mulai milestone pending berikutnya."""
    rows = milestones_of(session, contract.id)
    if contract.status != "active" or any(m.status in ACTIVE for m in rows):
        return None
    nxt = next((m for m in rows if m.status == "pending"), None)
    if nxt:
        nxt.status = "in_progress"
        session.add(nxt)
        log_activity(session, contract.id, f"Milestone {nxt.sequence} started")
    elif all(m.status in SETTLED for m in rows):
        log_activity(session, contract.id, "All milestones settled; contract ready to close")
    return nxt


def settle_milestone(session: Session, contract: Contract, milestone: Milestone, status: str, summary: str) -> None:
    """Tandai milestone selesai (released/refunded/split), catat aktivitas, lalu mulai milestone berikutnya."""
    milestone.status = status
    milestone.settled_at = now()
    session.add(milestone)
    log_activity(session, contract.id, summary)
    session.flush()
    start_next_milestone(session, contract)
