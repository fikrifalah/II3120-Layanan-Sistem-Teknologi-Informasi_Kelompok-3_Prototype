"""Skema awal: semua tabel sebelum PR #6 (sama dengan schema create_all sebelumnya).

Hanya membuat tabel yang BELUM ada, sehingga:
- database baru dibuat lengkap;
- schema lama (dibuat create_all sebelum Alembic dipasang) tidak diubah dan datanya aman.

Revision ID: 0001
Revises:
Create Date: 2026-11-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if 'user' not in existing:
        op.create_table('user',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('password', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('role', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('wallet_address', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('skills', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)

    if 'auth_token' not in existing:
        op.create_table('auth_token',
        sa.Column('token', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('token')
        )
        op.create_index(op.f('ix_auth_token_user_id'), 'auth_token', ['user_id'], unique=False)

    if 'client_profile' not in existing:
        op.create_table('client_profile',
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('company', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('industry', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('aboutme', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('client_id')
        )

    if 'cv_chunk' not in existing:
        op.create_table('cv_chunk',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('freelancer_id', sa.Integer(), nullable=False),
        sa.Column('type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('text', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('embedding', sa.JSON(), nullable=False),
        sa.Column('model', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_cv_chunk_freelancer_id'), 'cv_chunk', ['freelancer_id'], unique=False)

    if 'freelancer_profile' not in existing:
        op.create_table('freelancer_profile',
        sa.Column('freelancer_id', sa.Integer(), nullable=False),
        sa.Column('cv_text', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('skills', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('rate', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('freelancer_id')
        )

    if 'job' not in existing:
        op.create_table('job',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('budget', sa.Float(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    if 'seed_truth' not in existing:
        op.create_table('seed_truth',
        sa.Column('freelancer_id', sa.Integer(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('domain', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('skills', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('freelancer_id')
        )

    if 'contract' not in existing:
        op.create_table('contract',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('freelancer_id', sa.Integer(), nullable=False),
        sa.Column('onchain_contract_address', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['job.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    if 'invitation' not in existing:
        op.create_table('invitation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('freelancer_id', sa.Integer(), nullable=False),
        sa.Column('alias', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('message', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('match_score', sa.Float(), nullable=True),
        sa.Column('match_explanation', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column('responded_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['job.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_invitation_freelancer_id'), 'invitation', ['freelancer_id'], unique=False)
        op.create_index(op.f('ix_invitation_job_id'), 'invitation', ['job_id'], unique=False)

    if 'job_requirement' not in existing:
        op.create_table('job_requirement',
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('required_skills', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('preferred_skills', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('industry', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['job.id'], ),
        sa.PrimaryKeyConstraint('job_id')
        )

    if 'match_alias' not in existing:
        op.create_table('match_alias',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('freelancer_id', sa.Integer(), nullable=False),
        sa.Column('alias', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['job.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'alias'),
        sa.UniqueConstraint('job_id', 'freelancer_id')
        )
        op.create_index(op.f('ix_match_alias_job_id'), 'match_alias', ['job_id'], unique=False)

    if 'escrow' not in existing:
        op.create_table('escrow',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('tx_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('locked_amount', sa.Float(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['contract_id'], ['contract.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    if 'milestone' not in existing:
        op.create_table('milestone',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('deliverable_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('deliverable_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['contract_id'], ['contract.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    if 'dispute' not in existing:
        op.create_table('dispute',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('milestone_id', sa.Integer(), nullable=False),
        sa.Column('raised_by_id', sa.Integer(), nullable=False),
        sa.Column('reason', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('evidence_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('evidence_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('verdict', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(['milestone_id'], ['milestone.id'], ),
        sa.ForeignKeyConstraint(['raised_by_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    op.drop_table('dispute')
    op.drop_table('milestone')
    op.drop_table('escrow')
    op.drop_index(op.f('ix_match_alias_job_id'), table_name='match_alias')

    op.drop_table('match_alias')
    op.drop_table('job_requirement')
    op.drop_index(op.f('ix_invitation_job_id'), table_name='invitation')
    op.drop_index(op.f('ix_invitation_freelancer_id'), table_name='invitation')

    op.drop_table('invitation')
    op.drop_table('contract')
    op.drop_table('seed_truth')
    op.drop_table('job')
    op.drop_table('freelancer_profile')
    op.drop_index(op.f('ix_cv_chunk_freelancer_id'), table_name='cv_chunk')

    op.drop_table('cv_chunk')
    op.drop_table('client_profile')
    op.drop_index(op.f('ix_auth_token_user_id'), table_name='auth_token')

    op.drop_table('auth_token')
    op.drop_index(op.f('ix_user_email'), table_name='user')

    op.drop_table('user')
