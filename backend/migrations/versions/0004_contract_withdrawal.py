"""Freelancer menyerah dari kontrak (khusus demo): client baru boleh reassign setelah ini.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contract', sa.Column('withdrawn_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('contract', 'withdrawn_at')
