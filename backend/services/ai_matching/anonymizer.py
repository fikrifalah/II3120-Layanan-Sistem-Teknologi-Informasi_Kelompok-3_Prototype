import secrets
from typing import Iterable, Optional

from sqlmodel import Session, select

from .db_models import MatchAlias

ALIAS_PREFIX = "Candidate-"
ALIAS_BYTES = 2  # 2 byte = 4 karakter hex -> 65.536 kemungkinan per job


def _new_alias(taken: set[str]) -> str:
    while True:
        alias = ALIAS_PREFIX + secrets.token_hex(ALIAS_BYTES).upper()
        if alias not in taken:
            return alias


def get_aliases(session: Session, job_id: int, freelancer_ids: Iterable[int]) -> dict[int, str]:
    """Alias per freelancer untuk satu job. Alias lama dipakai ulang, yang belum ada dibuat baru."""
    rows = session.exec(select(MatchAlias).where(MatchAlias.job_id == job_id)).all()
    by_freelancer = {r.freelancer_id: r.alias for r in rows}
    taken = set(by_freelancer.values())
    result: dict[int, str] = {}
    for fid in freelancer_ids:
        if fid not in by_freelancer:
            alias = _new_alias(taken)
            taken.add(alias)
            by_freelancer[fid] = alias
            session.add(MatchAlias(job_id=job_id, freelancer_id=fid, alias=alias))
        result[fid] = by_freelancer[fid]
    session.commit()
    return result


def resolve_alias(session: Session, job_id: int, alias: str) -> Optional[int]:
    """Dipakai orchestrator saat client memilih kandidat: alias -> freelancer_id (None bila tidak ada)."""
    row = session.exec(
        select(MatchAlias).where(MatchAlias.job_id == job_id, MatchAlias.alias == alias)
    ).first()
    return row.freelancer_id if row else None