import sqlalchemy as sa
from sqlmodel import Session, SQLModel, select

from models import Job, User
from services.ai_matching.script.evaluate import snapshot_database, temporary_snapshot_engine


def test_snapshot_database_copies_rows_without_modifying_source(postgres_engine_factory):
    source = postgres_engine_factory()
    destination = postgres_engine_factory()
    SQLModel.metadata.create_all(source)

    with Session(source) as session:
        session.add(User(id=7, name="Client", role="client"))
        session.flush()
        session.add(Job(id=11, client_id=7, title="Existing", description="-", budget=100, status="open"))
        session.commit()

    snapshot_database(source, destination)

    with Session(source) as session:
        assert len(session.exec(select(User)).all()) == 1
        assert len(session.exec(select(Job)).all()) == 1
    with Session(destination) as session:
        assert [user.name for user in session.exec(select(User)).all()] == ["Client"]
        assert [job.id for job in session.exec(select(Job)).all()] == [11]
        job = Job(client_id=7, title="Evaluation", description="-", budget=100, status="open")
        session.add(job)
        session.commit()
        assert job.id == 12


def test_temporary_snapshot_schema_is_removed_after_evaluation(postgres_engine):
    SQLModel.metadata.create_all(postgres_engine)
    with Session(postgres_engine) as session:
        session.add(User(name="Client", role="client"))
        session.commit()

    with temporary_snapshot_engine(postgres_engine) as snapshot:
        with snapshot.connect() as connection:
            schema = connection.execute(sa.text("SELECT current_schema()")).scalar_one()
        with Session(snapshot) as session:
            assert [user.name for user in session.exec(select(User)).all()] == ["Client"]

    with postgres_engine.connect() as connection:
        exists = connection.execute(
            sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema)"),
            {"schema": schema},
        ).scalar_one()
    assert not exists
