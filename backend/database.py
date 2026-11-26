import os
from pathlib import Path

from dotenv import load_dotenv
from sqlmodel import Session, create_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
ALEMBIC_INI = Path(__file__).resolve().parent / "alembic.ini"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def init_db() -> None:
    """Bawa skema database ke versi terbaru dengan menjalankan migrasi Alembic yang belum dijalankan.

    Aman dijalankan berulang: Alembic mencatat versi terakhir di tabel `alembic_version`.
    """
    from alembic import command
    from alembic.config import Config

    config = Config(str(ALEMBIC_INI))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def get_db():
    with Session(engine) as session:
        yield session
