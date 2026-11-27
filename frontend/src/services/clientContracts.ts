import type { Contract, ContractStatus, Milestone, MilestoneStatus, Project, Submission, SubmissionFile, Wallet } from '../types/domain'
import { DAY_MS } from '../lib/format'
import { currentToken } from './auth'

/* ------------------------------------------------------------------
 * Kontrak, escrow, milestone, dispute, dan wallet client lewat backend orchestrator
 * (VITE_CONTRACTS_API=true). Butuh VITE_AUTH_API dan VITE_INVITATIONS_API: kontrak dibuat dari
 * undangan yang sudah diterima freelancer di backend.
 * Draf kontrak tetap disusun lokal di ContractBuilder; backend dipanggil saat kontrak dikirim.
 * ------------------------------------------------------------------ */
export const contractsApiEnabled = import.meta.env.VITE_CONTRACTS_API === 'true'
const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1'

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const form = body instanceof FormData
  const r = await fetch(apiBase + path, {
    method,
    headers: { Authorization: 'Bearer ' + currentToken(), ...(!form && body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  })
  if (!r.ok) {
    const detail = (await r.json().catch(() => null))?.detail
    throw new Error(typeof detail === 'string' ? detail : `API ${path} failed (${r.status})`)
  }
  return r.json()
}

interface ApiFile { id: number; original_filename: string; size_bytes: number; mime_type: string }
interface ApiSubmission {
  title: string
  notes: string
  files: ApiFile[]
  submitted_at: string
  repository_url: string | null
  repository_revision: string | null
  demo_url: string | null
  declared_criteria: { criterion_id: number; declared: boolean }[]
}
interface ApiMilestone {
  id: number
  sequence: number
  status: string
  review_deadline: string | null
  submitted_at: string | null
  settled_at: string | null
  current_submission: ApiSubmission | null
  dispute_id: number | null
  revision_count: number
  revision_note: string | null
}
export interface ApiContract {
  id: number
  status: 'draft' | 'agreed' | 'active' | 'completed'
  contract_hash: string
  escrow: { smart_contract_address: string | null; transaction_hash: string | null; funded_at: string | null } | null
  milestones: ApiMilestone[]
}
interface ApiWallet { address: string; available_balance: string | null; locked_in_escrow: string }

/** Milestone sudah selesai: dibayar, dikembalikan, atau dibagi arbiter. */
export const isSettled = (m: Milestone) => ['released', 'refunded', 'split'].includes(m.status)
/** Dana milestone yang sudah diterima freelancer (split: sesuai putusan arbiter). */
export const paidAmount = (m: Milestone) => m.settlement?.freelancer ?? (m.status === 'released' ? m.amount : 0)

function settlement(status: string, m: Milestone): Milestone['settlement'] {
  if (status === 'released') return { freelancer: m.amount, client: 0 }
  if (status === 'refunded') return { freelancer: 0, client: m.amount }
  return status === 'split' ? m.settlement : undefined // diisi dari putusan dispute
}

// draft = menunggu persetujuan freelancer; agreed = disetujui, menunggu dana escrow.
const CONTRACT_STATUS: Record<ApiContract['status'], ContractStatus> = {
  draft: 'pending_approval',
  agreed: 'awaiting_funding',
  active: 'active',
  completed: 'closed',
}

const kib = (n: number) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB')
const fileKind = (f: ApiFile): SubmissionFile['kind'] =>
  f.mime_type === 'application/pdf' ? 'pdf' : f.mime_type.includes('zip') ? 'archive' : 'report'

function submission(s: ApiSubmission, version: string): Submission {
  const files: SubmissionFile[] = s.files.map((f) => ({ apiId: f.id, name: f.original_filename, description: f.mime_type, size: kib(f.size_bytes), kind: fileKind(f) }))
  if (s.repository_url) files.push({ kind: 'repo', name: 'Repository', description: s.repository_url, url: s.repository_url })
  if (s.demo_url) files.push({ kind: 'link', name: 'Live demo', description: s.demo_url, url: s.demo_url })
  return {
    version,
    title: s.title,
    submittedAt: s.submitted_at,
    notes: s.notes,
    files,
    repositoryRevision: s.repository_revision ?? undefined,
    declaredCriteria: s.declared_criteria.filter((c) => c.declared).map((c) => String(c.criterion_id)),
  }
}

/** Gabungkan kondisi backend ke kontrak lokal (urutan milestone = `sequence`). */
export function applyRemote(local: Contract, remote: ApiContract): Contract {
  return {
    ...local,
    backendId: remote.id,
    status: CONTRACT_STATUS[remote.status],
    documentHash: remote.contract_hash,
    escrowAddress: remote.escrow?.smart_contract_address ?? local.escrowAddress,
    fundingTxHash: remote.escrow?.transaction_hash ?? local.fundingTxHash,
    startedAt: remote.escrow?.funded_at ?? local.startedAt,
    milestones: local.milestones.map((m): Milestone => {
      const r = remote.milestones.find((x) => x.sequence === m.seq)
      if (!r) return m
      // Backend hanya mengirim hasil terkini; hasil sebelum revisi tetap disimpan lokal sebagai riwayat.
      const current = r.current_submission && submission(r.current_submission, `v${r.revision_count + 1}.0`)
      const history = r.revision_count ? m.submissions.filter((s) => s.version !== current?.version) : []
      return {
        ...m,
        backendId: r.id,
        status: r.status as MilestoneStatus,
        reviewDeadline: r.review_deadline ?? undefined,
        releasedAt: r.settled_at ?? undefined,
        settlement: settlement(r.status, m),
        revisionCount: r.revision_count,
        revisionNote: r.revision_note ?? undefined,
        submissions: current ? [...history, current] : history,
      }
    }),
  }
}

/** createContractDraft: kirim kontrak yang disusun client; backend menghitung SHA-256 dokumennya. */
export async function createContractApi(invitationId: number, project: Project, c: Contract): Promise<ApiContract> {
  const start = new Date(project.startDate).getTime()
  const at = (day: number) => new Date(start + day * DAY_MS).toISOString()
  const { data } = await request<{ data: { contract: ApiContract } }>('POST', '/contracts', {
    invitation_id: invitationId,
    scope: c.scope,
    start_at: at(0),
    end_at: at(c.durationDays),
    milestones: c.milestones.map((m) => ({
      title: m.title,
      description: [m.description, ...m.deliverables.map((d) => '- ' + d)].filter(Boolean).join('\n'),
      amount: Math.round(m.amount),
      due_at: at(m.dueDay),
      criteria: m.criteria.map((cr) => ({ description: cr.text, is_mandatory: true })),
    })),
  })
  return data.contract
}

export const fetchContractApi = async (id: number) => (await request<{ data: ApiContract }>('GET', `/contracts/${id}`)).data

export const lockEscrowApi = async (contractId: number) =>
  (await request<{ data: { transaction_hash: string; smart_contract_address: string } }>('POST', '/escrow/lock', { contract_id: contractId })).data

export const approveMilestoneApi = async (milestoneId: number) =>
  (await request<{ data: { transaction_hash: string } }>('POST', `/milestones/${milestoneId}/approve`, {})).data

export const requestRevisionApi = async (milestoneId: number, notes: string) =>
  (await request<{ data: { transaction_hash: string } }>('POST', `/milestones/${milestoneId}/request-revision`, { notes })).data

export const closeContractApi = async (contractId: number) =>
  (await request<{ data: { transaction_hash: string } }>('POST', `/escrow/${contractId}/close`, {})).data

export const fetchVerdictApi = async (disputeId: number) =>
  (await request<{ data: { verdict: { freelancer_payout: number; client_refund: number; transaction_hash: string } | null } }>('GET', `/disputes/${disputeId}`)).data.verdict

export async function raiseDisputeApi(milestoneId: number, reason: string) {
  const form = new FormData()
  form.append('milestone_id', String(milestoneId))
  form.append('reason', reason)
  return (await request<{ data: { id: number; raise_transaction_hash: string } }>('POST', '/disputes', form)).data
}

/** Saldo on-chain dan dana terkunci dari backend; total dibayar/refund tetap dihitung dari kontrak lokal. */
export function walletFrom(api: ApiWallet, local: Wallet): Wallet {
  return {
    ...local,
    address: api.address,
    balance: api.available_balance === null ? local.balance : Number(api.available_balance),
    locked: Number(api.locked_in_escrow),
  }
}

export const fetchWalletApi = async () => (await request<{ data: ApiWallet }>('GET', '/wallet')).data

export const faucetApi = async () =>
  (await request<{ data: ApiWallet & { minted: string; transaction_hash: string } }>('POST', '/wallet/faucet', {})).data
