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
    milestone_id: int = Field(foreign_key="milestone.id")
    raised_by_id: int = Field(foreign_key="user.id")
    reason: str
    evidence_url: Optional[str] = None
    evidence_hash: Optional[str] = None
    verdict: Optional[str] = None
    status: str = "open"
