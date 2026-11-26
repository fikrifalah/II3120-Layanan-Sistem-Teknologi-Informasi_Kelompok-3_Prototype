"""Kontrak, escrow, milestone, dan dispute baru (PR #6 dispute handler + PR #7 orchestrator).

Untuk setiap tabel yang berubah:
- belum ada                   -> dibuat;
- sudah berstruktur baru      -> dibiarkan (mis. database yang sudah menjalankan kode PR #7);
- struktur lama dan KOSONG    -> dibuat ulang (kasus normal: sebelum PR #6 belum ada kode yang mengisinya);
- struktur lama dan BERISI    -> berhenti dengan pesan jelas, tidak ada data yang dihapus diam-diam.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = '0002'
down_revision: Union[str, None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Kolom yang diharapkan per tabel, urut aman untuk foreign key (induk lebih dulu).
EXPECTED_COLUMNS = {
    'contract': ['client_id', 'contract_hash', 'created_at', 'end_at', 'freelancer_id', 'id', 'job_id', 'onchain_contract_address', 'onchain_contract_id', 'scope', 'start_at', 'status', 'terms_json', 'total_amount'],
    'activity_log': ['contract_id', 'created_at', 'id', 'summary'],
    'escrow': ['close_tx_hash', 'contract_id', 'funded_at', 'id', 'locked_amount', 'status', 'tx_hash'],
    'milestone': ['amount', 'contract_id', 'deliverable_hash', 'deliverable_url', 'description', 'due_at', 'id', 'sequence', 'settled_at', 'status', 'submitted_at', 'title'],
    'dispute': ['arbiter_id', 'client_refund', 'created_at', 'freelancer_payout', 'freelancer_share_pct', 'id', 'milestone_id', 'raise_tx_hash', 'raised_by_id', 'reason', 'resolved_at', 'status', 'verdict', 'verdict_reasoning', 'verdict_tx_hash'],
    'milestone_criterion': ['description', 'id', 'is_mandatory', 'milestone_id'],
    'submission': ['declared_criteria', 'deliverable_hash', 'demo_url', 'freelancer_id', 'id', 'idempotency_key', 'milestone_id', 'notes', 'repository_revision', 'repository_url', 'status', 'submitted_at', 'title', 'tx_hash'],
    'dispute_evidence': ['dispute_id', 'filename', 'id', 'sha256', 'size_bytes', 'stored_name', 'uploaded_at', 'uploaded_by_id'],
    'stored_file': ['created_at', 'id', 'mime_type', 'original_filename', 'owner_id', 'purpose', 'sha256', 'size_bytes', 'stored_name', 'submission_id'],
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    outdated = [t for t in EXPECTED_COLUMNS if t in existing
                and sorted(c["name"] for c in inspector.get_columns(t)) != EXPECTED_COLUMNS[t]]
    filled = [t for t in outdated if bind.execute(sa.text(f'SELECT COUNT(*) FROM "{t}"')).scalar()]
    if filled:
        raise RuntimeError(
            f"Tabel {filled} masih berstruktur lama tetapi berisi data. Migrasi dihentikan agar data tidak "
            "hilang; pindahkan/hapus datanya secara manual lalu jalankan backend lagi.")
    for t in reversed(list(EXPECTED_COLUMNS)):  # anak dulu, baru induk
        if t in outdated:
            op.drop_table(t)
    for t in EXPECTED_COLUMNS:
        if t not in existing or t in outdated:
            globals()[f"_create_{t}"]()


def downgrade() -> None:
    for t in reversed(list(EXPECTED_COLUMNS)):
        op.drop_table(t)
    for t in ("contract", "escrow", "milestone", "dispute"):
        globals()[f"_create_old_{t}"]()


def _create_contract() -> None:
    op.create_table('contract',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('job_id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.Integer(), nullable=False),
    sa.Column('freelancer_id', sa.Integer(), nullable=False),
    sa.Column('onchain_contract_address', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('onchain_contract_id', sa.Integer(), nullable=True),
    sa.Column('total_amount', sa.Float(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('scope', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('start_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.Column('end_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.Column('terms_json', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('contract_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['client_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['job_id'], ['job.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('contract', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_contract_freelancer_id'), ['freelancer_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contract_job_id'), ['job_id'], unique=False)


def _create_activity_log() -> None:
    op.create_table('activity_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('contract_id', sa.Integer(), nullable=False),
    sa.Column('summary', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['contract_id'], ['contract.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('activity_log', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_activity_log_contract_id'), ['contract_id'], unique=False)


def _create_escrow() -> None:
    op.create_table('escrow',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('contract_id', sa.Integer(), nullable=False),
    sa.Column('tx_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('locked_amount', sa.Float(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('funded_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.Column('close_tx_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.ForeignKeyConstraint(['contract_id'], ['contract.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('escrow', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_escrow_contract_id'), ['contract_id'], unique=False)


def _create_milestone() -> None:
    op.create_table('milestone',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('contract_id', sa.Integer(), nullable=False),
    sa.Column('sequence', sa.Integer(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('amount', sa.Float(), nullable=False),
    sa.Column('due_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.Column('deliverable_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('deliverable_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('submitted_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.Column('settled_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.ForeignKeyConstraint(['contract_id'], ['contract.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('milestone', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_milestone_contract_id'), ['contract_id'], unique=False)


def _create_dispute() -> None:
    op.create_table('dispute',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('milestone_id', sa.Integer(), nullable=False),
    sa.Column('raised_by_id', sa.Integer(), nullable=False),
    sa.Column('arbiter_id', sa.Integer(), nullable=False),
    sa.Column('reason', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('raise_tx_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.Column('verdict', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('freelancer_share_pct', sa.Integer(), nullable=True),
    sa.Column('verdict_reasoning', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('freelancer_payout', sa.Float(), nullable=True),
    sa.Column('client_refund', sa.Float(), nullable=True),
    sa.Column('verdict_tx_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('resolved_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
    sa.ForeignKeyConstraint(['arbiter_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['milestone_id'], ['milestone.id'], ),
    sa.ForeignKeyConstraint(['raised_by_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('dispute', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dispute_arbiter_id'), ['arbiter_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_dispute_milestone_id'), ['milestone_id'], unique=False)


def _create_milestone_criterion() -> None:
    op.create_table('milestone_criterion',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('milestone_id', sa.Integer(), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('is_mandatory', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['milestone_id'], ['milestone.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('milestone_criterion', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_milestone_criterion_milestone_id'), ['milestone_id'], unique=False)


def _create_submission() -> None:
    op.create_table('submission',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('milestone_id', sa.Integer(), nullable=False),
    sa.Column('freelancer_id', sa.Integer(), nullable=False),
    sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('repository_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('repository_revision', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('demo_url', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('declared_criteria', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('deliverable_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('tx_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('idempotency_key', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('submitted_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['freelancer_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['milestone_id'], ['milestone.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('submission', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_submission_idempotency_key'), ['idempotency_key'], unique=False)
        batch_op.create_index(batch_op.f('ix_submission_milestone_id'), ['milestone_id'], unique=False)


def _create_dispute_evidence() -> None:
    op.create_table('dispute_evidence',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('dispute_id', sa.Integer(), nullable=False),
    sa.Column('uploaded_by_id', sa.Integer(), nullable=False),
    sa.Column('filename', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('stored_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('sha256', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('uploaded_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['dispute_id'], ['dispute.id'], ),
    sa.ForeignKeyConstraint(['uploaded_by_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('dispute_evidence', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dispute_evidence_dispute_id'), ['dispute_id'], unique=False)


def _create_stored_file() -> None:
    op.create_table('stored_file',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('purpose', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('original_filename', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('stored_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('mime_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('sha256', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('submission_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ),
    sa.ForeignKeyConstraint(['submission_id'], ['submission.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('stored_file', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_stored_file_owner_id'), ['owner_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_stored_file_submission_id'), ['submission_id'], unique=False)


def _create_old_contract() -> None:
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


def _create_old_escrow() -> None:
    op.create_table('escrow',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('contract_id', sa.Integer(), nullable=False),
    sa.Column('tx_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('locked_amount', sa.Float(), nullable=False),
    sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.ForeignKeyConstraint(['contract_id'], ['contract.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def _create_old_milestone() -> None:
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


def _create_old_dispute() -> None:
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
