from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel

import models  # noqa: F401  -> memastikan tabel tim (user, job) terdaftar untuk foreign key


class FreelancerProfile(SQLModel, table=True):
    __tablename__ = "freelancer_profile"

    freelancer_id: int = Field(foreign_key="user.id", primary_key=True)
    cv_text: str  # sudah dibersihkan dari PII
    skills: str = ""  # hasil ekstraksi LLM (huruf kecil), dipisah koma
    rate: Optional[float] = None  # estimasi biaya yang diminta per proyek (Rp)


class ClientProfile(SQLModel, table=True):
    """Pasangan FreelancerProfile untuk client: siapa dia dan kebutuhan umumnya.
    Proyek (lowongan) yang dibuat client disimpan di tabel `job` milik tim."""

    __tablename__ = "client_profile"

    client_id: int = Field(foreign_key="user.id", primary_key=True)
    company: str  # nama usaha/organisasi
    industry: str  # mis. "e-commerce fashion"
    aboutme: str  # profil usaha + jenis bantuan yang biasa dicari


class JobRequirement(SQLModel, table=True):
    """Kebutuhan proyek dari form client, pelengkap tabel `job` milik tim (opsi A: tabel tim tidak diubah)."""

    __tablename__ = "job_requirement"

    job_id: int = Field(foreign_key="job.id", primary_key=True)
    required_skills: str = ""  # huruf kecil, dipisah koma
    preferred_skills: str = ""
    category: str = ""
    industry: str = ""


class CvChunk(SQLModel, table=True):
    __tablename__ = "cv_chunk"

    id: Optional[int] = Field(default=None, primary_key=True)
    freelancer_id: int = Field(foreign_key="user.id", index=True)
    type: str  # "experience" | "portfolio" | "other"
    text: str
    embedding: list[float] = Field(sa_column=Column(JSON, nullable=False))
    model: str  # model embedding yang membuat vektor ini


class SeedTruth(SQLModel, table=True):
    """Benih data sintetis = kunci jawaban untuk evaluasi. Hanya diisi oleh seed."""

    __tablename__ = "seed_truth"

    freelancer_id: int = Field(foreign_key="user.id", primary_key=True)
    category: str  # kategori benih di script/seed_generate.py, mis. "frontend"
    domain: str  # mis. "e-commerce fashion"
    skills: str


class MatchAlias(SQLModel, table=True):
    __tablename__ = "match_alias"
    __table_args__ = (
        UniqueConstraint("job_id", "freelancer_id"),
        UniqueConstraint("job_id", "alias"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: int = Field(foreign_key="job.id", index=True)
    freelancer_id: int = Field(foreign_key="user.id")
    alias: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))