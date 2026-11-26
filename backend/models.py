from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: Optional[str] = Field(default=None, unique=True, index=True)
    password: Optional[str] = None  # prototype: teks biasa (belum di-hash)
    role: str  # "client" | "freelancer" | "arbiter"
    wallet_address: Optional[str] = None
    skills: Optional[str] = None


class Job(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="user.id")
    title: str
    description: str
    budget: float
    status: str = "open"


class Contract(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="job.id", index=True)
    client_id: int = Field(foreign_key="user.id")
    freelancer_id: int = Field(foreign_key="user.id", index=True)
    onchain_contract_address: Optional[str] = None  # alamat Escrow.sol
    # contractId di Escrow.sol (hasil createAndLockEscrow); None = escrow belum dikunci.
    onchain_contract_id: Optional[int] = None
    total_amount: float  # SIM-IDR
    status: str = "draft"  # draft | active | completed | cancelled
    scope: str = ""
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    # Dokumen kesepakatan off-chain (JSON kanonik) dan SHA-256-nya; hanya hash yang disimpan on-chain.
    terms_json: str = ""
    contract_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Milestone(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="contract.id", index=True)
    sequence: int = 1  # 1, 2, 3, ...; milestone on-chain index = sequence - 1
    title: str
    description: str = ""
    amount: float  # SIM-IDR
    due_at: Optional[datetime] = None
    deliverable_url: Optional[str] = None
    deliverable_hash: Optional[str] = None
    # pending | in_progress | under_review | disputed | released | refunded | split
    status: str = "pending"
    submitted_at: Optional[datetime] = None
    settled_at: Optional[datetime] = None


class Escrow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="contract.id", index=True)
    tx_hash: Optional[str] = None
    locked_amount: float = 0.0
    status: str = "active"  # active | closed
    funded_at: Optional[datetime] = None
    close_tx_hash: Optional[str] = None


class Dispute(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    milestone_id: int = Field(foreign_key="milestone.id", index=True)
    raised_by_id: int = Field(foreign_key="user.id")
    arbiter_id: int = Field(foreign_key="user.id", index=True)
    reason: str
    status: str = "open"  # open | resolved
    raise_tx_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Diisi saat putusan arbiter dieksekusi on-chain.
    verdict: Optional[str] = None  # RELEASE | REFUND | SPLIT
    freelancer_share_pct: Optional[int] = None
    verdict_reasoning: Optional[str] = None
    freelancer_payout: Optional[float] = None  # SIM-IDR
    client_refund: Optional[float] = None  # SIM-IDR
    verdict_tx_hash: Optional[str] = None
    resolved_at: Optional[datetime] = None


class DisputeEvidence(SQLModel, table=True):
    __tablename__ = "dispute_evidence"

    id: Optional[int] = Field(default=None, primary_key=True)
    dispute_id: int = Field(foreign_key="dispute.id", index=True)
    uploaded_by_id: int = Field(foreign_key="user.id")
    filename: str
    stored_name: str
    size_bytes: int
    sha256: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
