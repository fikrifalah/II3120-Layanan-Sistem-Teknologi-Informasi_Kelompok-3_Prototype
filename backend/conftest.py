import os
import uuid

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url


@pytest.fixture
def postgres_engine_factory():
    database_url = os.getenv("TEST_DATABASE_URL")
    if not database_url:
        pytest.fail("Set TEST_DATABASE_URL to a PostgreSQL test database before running backend tests")
    if make_url(database_url).get_backend_name() != "postgresql":
        pytest.fail("TEST_DATABASE_URL must point to PostgreSQL")

    admin_engine = sa.create_engine(database_url, pool_pre_ping=True)
    engines = []
    schemas = []

    def create_engine():
        schema = f"test_{uuid.uuid4().hex}"
        with admin_engine.begin() as connection:
            connection.execute(sa.text(f'CREATE SCHEMA "{schema}"'))
        schemas.append(schema)
        engine = sa.create_engine(
            database_url,
            connect_args={"options": f"-csearch_path={schema}"},
            pool_pre_ping=True,
        )
        engines.append(engine)
        return engine

    try:
        yield create_engine
    finally:
        for engine in engines:
            engine.dispose()
        try:
            with admin_engine.begin() as connection:
                for schema in reversed(schemas):
                    connection.execute(sa.text(f'DROP SCHEMA "{schema}" CASCADE'))
        finally:
            admin_engine.dispose()


@pytest.fixture
def postgres_engine(postgres_engine_factory):
    return postgres_engine_factory()
