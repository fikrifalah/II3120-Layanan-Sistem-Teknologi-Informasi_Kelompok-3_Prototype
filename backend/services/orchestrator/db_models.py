"""Tabel milik PlatformOrchestrator, pelengkap Contract/Milestone/Escrow di models.py."""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel

import models  # noqa: F401  (mendaftarkan tabel tim untuk foreign key)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MilestoneCriterion(SQLModel, table=True):
    """Kriteria penerimaan (KPI) per milestone; ikut di-hash dalam dokumen kontrak."""
    __tablename__ = "milestone_criterion"

    id: Optional[int] = Field(default=None, primary_key=True)
    milestone_id: int = Field(foreign_key="milestone.id", index=True)
    description: str
    is_mandatory: bool = True


class StoredFile(SQLModel, table=True):
    """Berkas off-chain (hasil kerja) di uploads/deliverables/; dirujuk submission lewat submission_id."""
    __tablename__ = "stored_file"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    purpose: str = "deliverable"
    original_filename: str
    stored_name: str
    mime_type: str
    size_bytes: int
    sha256: str
    submission_id: Optional[int] = Field(default=None, foreign_key="submission.id", index=True)
    created_at: datetime = Field(default_factory=_now)


class Submission(SQLModel, table=True):
    """Satu penyerahan hasil kerja milestone; hash manifest-nya dicatat on-chain."""
    __tablename__ = "submission"

    id: Optional[int] = Field(default=None, primary_key=True)
    milestone_id: int = Field(foreign_key="milestone.id", index=True)
    freelancer_id: int = Field(foreign_key="user.id")
    title: str
    notes: Optional[str] = None
    repository_url: Optional[str] = None
    repository_revision: Optional[str] = None
    demo_url: Optional[str] = None
    declared_criteria: str = "[]"  # JSON: [{"criterion_id": 1, "declared": true}, ...]
    deliverable_hash: str  # SHA-256 manifest (hex)
    tx_hash: Optional[str] = None
    idempotency_key: Optional[str] = Field(default=None, index=True)
    status: str = "submitted"  # submitted | superseded (dibatalkan karena handover freelancer)
    submitted_at: datetime = Field(default_factory=_now)


class ActivityLog(SQLModel, table=True):
    """Riwayat kejadian kontrak untuk ditampilkan ke client dan freelancer."""
    __tablename__ = "activity_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="contract.id", index=True)
    summary: str
    created_at: datetime = Field(default_factory=_now)
