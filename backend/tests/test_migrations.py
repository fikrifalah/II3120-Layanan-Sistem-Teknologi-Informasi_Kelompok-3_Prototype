"""Migrasi Alembic pada PostgreSQL: database baru, schema lama, dan sinkron dengan model."""
import pytest
import sqlalchemy as sa
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlmodel import SQLModel

import main  # noqa: F401  (mendaftarkan semua tabel aplikasi)
from database import ALEMBIC_INI


@pytest.fixture
def engine(postgres_engine):
    return postgres_engine


def migrate(engine, revision="head", down=False):
    config = Config(str(ALEMBIC_INI))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        (command.downgrade if down else command.upgrade)(config, revision)


def schema_diff(engine):
    with engine.connect() as connection:
        return compare_metadata(MigrationContext.configure(connection), SQLModel.metadata)


def columns(engine, table):
    return {c["name"] for c in sa.inspect(engine).get_columns(table)}


def as_legacy_create_all(engine):
    """Schema yang dibuat create_all sebelum Alembic dipasang tidak punya tabel alembic_version."""
    with engine.begin() as c:
        c.execute(sa.text("DROP TABLE alembic_version"))


def test_new_database_matches_models(engine):
    """Gagal bila model diubah tanpa membuat migrasi baru."""
    migrate(engine)
    assert {"contract", "dispute", "dispute_evidence"} <= set(sa.inspect(engine).get_table_names())
    assert {"dispute_id", "uploaded_by_id", "filename", "stored_name", "size_bytes", "sha256", "uploaded_at"} <= columns(engine, "dispute_evidence")
    assert schema_diff(engine) == [], "Buat migrasi: cd backend && alembic revision --autogenerate -m '...'"
    migrate(engine)  # dijalankan lagi saat backend restart: tidak berubah
    assert schema_diff(engine) == []


def test_legacy_schema_keeps_seed_data_and_upgrades_changed_tables(engine):
    migrate(engine, "0001")  # = skema create_all sebelum PR #6
    as_legacy_create_all(engine)
    with engine.begin() as c:
        c.execute(sa.text('INSERT INTO "user" (id, name, email, role) VALUES (1, \'Rina\', \'rina@x.id\', \'client\')'))
        c.execute(sa.text("INSERT INTO job (id, client_id, title, description, budget, status) "
                          "VALUES (1, 1, 'Logo', 'Desain logo', 1000000, 'open')"))
    migrate(engine)
    with engine.connect() as c:
        assert c.execute(sa.text('SELECT name FROM "user"')).scalars().all() == ["Rina"]
        assert c.execute(sa.text("SELECT title FROM job")).scalars().all() == ["Logo"]
    assert {"terms_json", "onchain_contract_id"} <= columns(engine, "contract")
    assert "arbiter_id" in columns(engine, "dispute")
    assert schema_diff(engine) == []


def test_existing_current_dispute_is_preserved_when_missing_tables_are_recreated(engine):
    migrate(engine, "0002")  # skema PR #6/#7 yang dibuat create_all sebelum Alembic dipasang
    with engine.begin() as c:
        c.execute(sa.text('INSERT INTO "user" (id, name, email, role) VALUES '
                          "(1, 'Rina', 'rina@x.id', 'client'), "
                          "(2, 'Freelancer', 'freelancer@x.id', 'freelancer'), "
                          "(3, 'Arbiter', 'arbiter@x.id', 'arbiter')"))
        c.execute(sa.text("INSERT INTO job (id, client_id, title, description, budget, status) "
                          "VALUES (1, 1, 'Logo', 'Desain logo', 1000000, 'open')"))
        c.execute(sa.text("INSERT INTO contract (id, job_id, client_id, freelancer_id, total_amount, status, "
                          "scope, terms_json, created_at) VALUES (1, 1, 1, 2, 100, 'active', 'scope', '{}', "
                          "'2026-11-26')"))
        c.execute(sa.text("INSERT INTO milestone (id, contract_id, sequence, title, description, amount, status) "
                          "VALUES (1, 1, 1, 'Desain', '-', 100, 'disputed')"))
        c.execute(sa.text("INSERT INTO dispute (milestone_id, raised_by_id, arbiter_id, reason, status, created_at) "
                          "VALUES (1, 1, 3, 'x', 'open', '2026-11-26')"))
        for t in ("stored_file", "dispute_evidence", "submission", "milestone_criterion", "activity_log", "escrow"):
            c.execute(sa.text(f'DROP TABLE "{t}"'))
    as_legacy_create_all(engine)
    migrate(engine, "0001")  # stamp otomatis lewat jalur normal: 0001 hanya membuat tabel yang belum ada
    migrate(engine)
    assert schema_diff(engine) == []
    with engine.connect() as c:  # dispute sudah berstruktur baru: dibiarkan beserta datanya
        assert c.execute(sa.text("SELECT reason FROM dispute")).scalars().all() == ["x"]


def test_outdated_table_with_data_stops_without_deleting(engine):
    migrate(engine, "0001")
    as_legacy_create_all(engine)
    with engine.begin() as c:
        c.execute(sa.text('INSERT INTO "user" (id, name, email, role) VALUES '
                          "(1, 'Rina', 'rina@x.id', 'client'), "
                          "(2, 'Freelancer', 'freelancer@x.id', 'freelancer')"))
        c.execute(sa.text("INSERT INTO job (id, client_id, title, description, budget, status) "
                          "VALUES (1, 1, 'Logo', 'Desain logo', 1000000, 'open')"))
        c.execute(sa.text("INSERT INTO contract (job_id, client_id, freelancer_id, total_amount, status) "
                          "VALUES (1, 1, 2, 100, 'draft')"))
    with pytest.raises(RuntimeError, match="berisi data"):
        migrate(engine)
    with engine.connect() as c:
        assert c.execute(sa.text("SELECT COUNT(*) FROM contract")).scalar() == 1


def test_downgrade_and_upgrade_again(engine):
    migrate(engine)
    migrate(engine, "0001", down=True)
    assert "terms_json" not in columns(engine, "contract")
    migrate(engine)
    assert schema_diff(engine) == []
