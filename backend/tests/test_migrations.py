"""Migrasi Alembic: database baru, app.db lama dari create_all, dan sinkron dengan model."""
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
def engine(tmp_path):
    return sa.create_engine(f"sqlite:///{tmp_path / 'app.db'}")


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
    """app.db yang dibuat create_all sebelum Alembic dipasang tidak punya tabel alembic_version."""
    with engine.begin() as c:
        c.execute(sa.text("DROP TABLE alembic_version"))


def test_new_database_matches_models(engine):
    """Gagal bila model diubah tanpa membuat migrasi baru."""
    migrate(engine)
    assert schema_diff(engine) == [], "Buat migrasi: cd backend && alembic revision --autogenerate -m '...'"
    migrate(engine)  # dijalankan lagi saat backend restart: tidak berubah
    assert schema_diff(engine) == []


def test_legacy_app_db_keeps_seed_data_and_upgrades_changed_tables(engine):
    migrate(engine, "0001")  # = skema app.db sebelum PR #6
    as_legacy_create_all(engine)
    with engine.begin() as c:
        c.execute(sa.text("INSERT INTO user (id, name, email, role) VALUES (1, 'Rina', 'rina@x.id', 'client')"))
        c.execute(sa.text("INSERT INTO job (id, client_id, title, description, budget, status) "
                          "VALUES (1, 1, 'Logo', 'Desain logo', 1000000, 'open')"))
    migrate(engine)
    with engine.connect() as c:
        assert c.execute(sa.text("SELECT name FROM user")).scalars().all() == ["Rina"]
        assert c.execute(sa.text("SELECT title FROM job")).scalars().all() == ["Logo"]
    assert {"terms_json", "onchain_contract_id"} <= columns(engine, "contract")
    assert "arbiter_id" in columns(engine, "dispute")
    assert schema_diff(engine) == []


def test_legacy_app_db_after_manual_pr6_migration(engine):
    """Database yang sudah menjalankan instruksi migrasi manual PR #6 (DROP dispute + ALTER contract)."""
    migrate(engine)
    as_legacy_create_all(engine)
    with engine.begin() as c:
        for t in ("stored_file", "dispute_evidence", "submission", "milestone_criterion", "activity_log",
                  "escrow", "milestone", "contract"):
            c.execute(sa.text(f'DROP TABLE "{t}"'))
        c.execute(sa.text("CREATE TABLE contract (id INTEGER PRIMARY KEY, job_id INTEGER, client_id INTEGER, "
                          "freelancer_id INTEGER, onchain_contract_address VARCHAR, total_amount FLOAT, "
                          "status VARCHAR, onchain_contract_id INTEGER)"))
        c.execute(sa.text("INSERT INTO dispute (milestone_id, raised_by_id, arbiter_id, reason, status, created_at) "
                          "VALUES (1, 1, 1, 'x', 'open', '2026-11-26')"))
    migrate(engine, "0001")  # stamp otomatis lewat jalur normal: 0001 hanya membuat tabel yang belum ada
    migrate(engine)
    assert schema_diff(engine) == []
    with engine.connect() as c:  # dispute sudah berstruktur baru: dibiarkan beserta datanya
        assert c.execute(sa.text("SELECT reason FROM dispute")).scalars().all() == ["x"]


def test_outdated_table_with_data_stops_without_deleting(engine):
    migrate(engine, "0001")
    as_legacy_create_all(engine)
    with engine.begin() as c:
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
