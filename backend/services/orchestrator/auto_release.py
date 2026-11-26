"""Auto-release: cairkan milestone yang tidak direview client dalam 5 hari (BPMN To-Be aktivitas 6-8).

Batas waktu dicek terhadap waktu blok di smart contract (bukan jam server), jadi demo bisa memajukan
waktu dengan `evm_increaseTime` di Hardhat. Dijalankan berkala oleh `run_forever` saat backend hidup.
"""
import asyncio
import logging
import os

from sqlmodel import Session, select

from database import engine
from models import Contract, Milestone
from services.orchestrator import workflow as wf
from services.smart_contract import service as chain

log = logging.getLogger(__name__)


def release_overdue(session: Session) -> list[int]:
    """Cairkan semua milestone under_review yang timeout review-nya sudah lewat; kembalikan id-nya."""
    rows = session.exec(select(Milestone, Contract).join(Contract, Milestone.contract_id == Contract.id)
                        .where(Milestone.status == "under_review", Contract.status == "active")).all()
    released = []
    for milestone, contract in rows:
        index = wf.onchain_index(milestone)
        if not chain.review_timeout_reached(contract.onchain_contract_id, index):
            continue
        chain.release_milestone_onchain(contract.onchain_contract_id, index)
        wf.settle_milestone(session, contract, milestone, "released",
                            f"Milestone {milestone.sequence} auto-released after {wf.REVIEW_TIMEOUT_DAYS}-day "
                            f"review timeout; {wf.amount_str(milestone.amount)} {wf.TOKEN_SYMBOL} released")
        session.commit()
        released.append(milestone.id)
    return released


def _run_once() -> list[int]:
    with Session(engine) as session:
        return release_overdue(session)


async def run_forever() -> None:
    """Loop latar belakang; interval dari AUTO_RELEASE_INTERVAL_SECONDS (default 60, 0 = mati)."""
    interval = int(os.getenv("AUTO_RELEASE_INTERVAL_SECONDS", "60"))
    if interval <= 0:
        return
    while True:
        try:
            released = await asyncio.to_thread(_run_once)
            if released:
                log.info("auto-released milestones %s", released)
        except Exception as e:  # blockchain mati atau error sementara: coba lagi di putaran berikut
            log.warning("auto-release skipped: %s", e)
        await asyncio.sleep(interval)
