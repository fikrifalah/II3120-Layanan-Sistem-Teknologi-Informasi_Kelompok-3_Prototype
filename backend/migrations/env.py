"""Lingkungan Alembic: memakai engine dan metadata yang sama dengan aplikasi."""
from alembic import context
from sqlmodel import SQLModel

import main  # noqa: F401  (mengimpor semua modul sehingga setiap tabel aplikasi terdaftar di metadata)
from database import engine


def run(connection) -> None:
    # render_as_batch: SQLite tidak mendukung sebagian besar ALTER TABLE, jadi Alembic menyalin tabel.
    context.configure(connection=connection, target_metadata=SQLModel.metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is None:
    with engine.connect() as connection:
        run(connection)
else:
    run(connection)
