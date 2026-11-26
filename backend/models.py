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
    job_id: int = Field(foreign_key="job.id")
    client_id: int = Field(foreign_key="user.id")
    freelancer_id: int = Field(foreign_key="user.id")
    onchain_contract_address: Optional[str] = None
    # contractId di Escrow.sol (hasil createAndLockEscrow); None = escrow belum dikunci.
    # Milestone ke-i on-chain = milestone kontrak ini urutan ke-i menurut id.
    onchain_contract_id: Optional[int] = None
    total_amount: float
    status: str = "draft"


class Milestone(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="contract.id")
    title: str
    amount: float
    deliverable_url: Optional[str] = None
    deliverable_hash: Optional[str] = None
    status: str = "pending"


class Escrow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="contract.id")
    tx_hash: Optional[str] = None
    locked_amount: float = 0.0
    status: str = "locked"


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
