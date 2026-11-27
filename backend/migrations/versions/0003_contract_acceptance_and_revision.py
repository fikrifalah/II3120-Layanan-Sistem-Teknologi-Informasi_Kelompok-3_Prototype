"""Persetujuan kontrak oleh freelancer, permintaan perbaikan milestone, dan waktu penutupan escrow.

- contract.accepted_at: kapan freelancer menyetujui kontrak (BPMN To-Be no. 3).
- milestone.revision_count / revision_note: client meminta perbaikan sebelum sengketa.
- escrow.closed_at: waktu closeContract on-chain.
Kontrak yang sudah didanai sebelum migrasi ini dianggap sudah disetujui.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contract', sa.Column('accepted_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.add_column('escrow', sa.Column('closed_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True))
    op.add_column('milestone', sa.Column('revision_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('milestone', sa.Column('revision_note', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.execute("UPDATE contract SET accepted_at = created_at WHERE status <> 'draft'")


def downgrade() -> None:
    op.drop_column('milestone', 'revision_note')
    op.drop_column('milestone', 'revision_count')
    op.drop_column('escrow', 'closed_at')
    op.drop_column('contract', 'accepted_at')
