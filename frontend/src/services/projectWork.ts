import { useCallback, useEffect, useMemo, useState } from 'react'
import { DAY_MS } from '../lib/format'
import { demoRecipient, useDemoWorkspace } from './demoWorkspace'
import { mockProfileEnabled } from './freelancerProfile'
import { downloadBlob, type DeliveryDraft } from './delivery'
import type { SubmissionFile } from '../types/domain'

export interface ProjectRow {
  id: string
  title: string
  category: string
  status: string
  description: string
}
export interface WorkFile extends SubmissionFile {
  apiId?: number
}
export interface WorkMilestone {
  id: string
  seq: number
  title: string
  due: string
  amount: string
  status: string
  eligible: boolean
  criteria: { id: string; text: string; required: boolean }[]
  deadline?: string
  transaction?: number
  submission?: { title: string; notes: string; files: WorkFile[]; at?: string; revision?: string; criteria?: string[] }
}
export interface Work {
  project: ProjectRow
  milestones: WorkMilestone[]
  start: string
  end: string
  total: string
  locked: string
  scope: string
  contractId: string
  agreement: string
  fundedAt: string
  events: { text: string; at: string }[]
  files: WorkFile[]
  invitationId?: string
}
export const statusLabel = (s: string) =>
  ({
    active: 'In Progress',
    in_progress: 'In Progress',
    under_review: 'Awaiting Client Review',
    completed: 'Completed',
    pending: 'Not Started',
    released: 'Paid',
    pending_confirmation: 'Awaiting Confirmation',
    closed_with_settlement: 'Closed with Settlement',
  }[s] ?? s.replaceAll('_', ' '))
export function amount(s: string) {
  return /^\d+$/.test(s) ? BigInt(s).toLocaleString('en-US') + ' SIM-IDR' : 'Unavailable'
}
export const settled = (s: string) => ['released', 'refunded', 'split'].includes(s)
export const defaultMilestone = (ms: WorkMilestone[]) =>
  ms.find((m) => ['in_progress', 'under_review', 'pending_confirmation', 'disputed'].includes(m.status)) ?? ms.at(-1)
const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
async function api(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch(base + path, { ...init, headers: { Authorization: 'Bearer ' + token, ...init.headers } })
  if (!r.ok)
    throw new Error(
      r.status === 403 || r.status === 404
        ? 'Project or milestone unavailable.'
        : 'Request failed (' + r.status + '). Please retry.'
    )
  return r
}
interface ApiProject extends Omit<ProjectRow, 'id'> {
  id: number
  expected_start_at: string
  expected_end_at: string
}
interface ApiFile {
  id: number
  original_filename: string
  size_bytes: number
  mime_type: string
}
interface ApiMilestone {
  id: number
  sequence: number
  title: string
  due_at: string
  amount: string
  status: string
  allowed_actions: string[]
  active_transaction_id: number | null
  review_deadline: string | null
  criteria?: { id: number; description: string; is_mandatory: boolean }[]
  current_submission?: {
    title: string
    notes: string
    files: ApiFile[]
    submitted_at: string
    status: string
    repository_url?: string
    demo_url?: string
    repository_revision?: string
    declared_criteria?: { criterion_id: number; declared: boolean }[]
  }
}
interface ApiWork {
  project: ApiProject
  milestones: ApiMilestone[]
  contract: { id: number; status: string; total_amount: string }
  agreement: { version: number; terms: { scope: string; scope_summary?: string } }
  escrow: { status: string; remaining_locked_amount: string; funded_at: string }
  recent_activity: { summary: string; created_at: string }[]
  files: ApiFile[]
}
const apiFile = (f: ApiFile): WorkFile => ({
  apiId: f.id,
  name: f.original_filename,
  size: Math.ceil(f.size_bytes / 1024) + ' KB',
  description: f.mime_type,
  kind: 'report',
})
function apiMilestone(m: ApiMilestone, funded: boolean): WorkMilestone {
  const sub = m.current_submission
  const files = sub?.files.map(apiFile) ?? []
  if (sub?.repository_url)
    files.push({ kind: 'repo', name: 'Repository', description: sub.repository_url, url: sub.repository_url })
  if (sub?.demo_url) files.push({ kind: 'link', name: 'Live demo', description: sub.demo_url, url: sub.demo_url })
  return {
    id: String(m.id),
    seq: m.sequence,
    title: m.title,
    due: m.due_at,
    amount: m.amount,
    status: sub?.status === 'pending_confirmation' ? sub.status : m.status,
    eligible:
      funded &&
      m.status === 'in_progress' &&
      !m.active_transaction_id &&
      (!sub || sub.status === 'failed') &&
      m.allowed_actions.some((x) => ['submit', 'submit_deliverable', 'submit_milestone'].includes(x)),
    transaction: m.active_transaction_id ?? undefined,
    deadline: m.review_deadline ?? undefined,
    criteria: (m.criteria ?? []).map((x) => ({ id: String(x.id), text: x.description, required: x.is_mandatory })),
    submission:
      sub && sub.status !== 'failed'
        ? {
            title: sub.title,
            notes: sub.notes,
            files,
            at: sub.submitted_at,
            revision: sub.repository_revision,
            criteria: sub.declared_criteria?.filter((c) => c.declared).map((c) => String(c.criterion_id)),
          }
        : undefined,
  }
}
export function useProjectWork(token: string, id?: string, mid?: string, enabled = true) {
  const workspace = useDemoWorkspace(mockProfileEnabled && enabled)
  const demo = useMemo(
    () =>
      workspace?.contracts
        .filter((c) => c.candidateId === demoRecipient && ['active', 'closed'].includes(c.status))
        .flatMap((c) => {
          const p = workspace.projects.find((p) => p.id === c.projectId)
          if (!p) return []
          const milestones: WorkMilestone[] = c.milestones.map((m) => {
            const sub = m.submissions.at(-1)
            return {
              id: m.id,
              seq: m.seq,
              title: m.title,
              amount: String(m.amount),
              status: m.status,
              deadline: m.reviewDeadline,
              due: new Date(Date.parse(c.startedAt || p.startDate) + m.dueDay * DAY_MS).toISOString(),
              eligible: c.status === 'active' && !!c.fundingTxHash && m.status === 'in_progress' && !sub,
              criteria: m.criteria.map((k) => ({ ...k, required: true })),
              submission: sub && {
                title: sub.title || m.title,
                notes: sub.notes,
                files: sub.files,
                at: sub.submittedAt,
                criteria: sub.declaredCriteria,
                revision: sub.repositoryRevision,
              },
            }
          })
          return [
            {
              project: p,
              milestones,
              start: p.startDate,
              end: p.endDate,
              total: String(c.milestones.reduce((v, m) => v + m.amount, 0)),
              locked: String(c.milestones.reduce((v, m) => v + (settled(m.status) ? 0 : m.amount), 0)),
              scope: c.scope,
              contractId: c.id,
              agreement: 'v' + c.version,
              fundedAt: c.startedAt || '',
              events: workspace.activity.filter((a) => a.projectId === p.id),
              files: milestones.flatMap((m) => m.submission?.files ?? []),
              invitationId: workspace.invitations.find(
                (i) => i.projectId === p.id && i.candidateId === demoRecipient && i.status === 'accepted'
              )?.id,
            } satisfies Work,
          ]
        }),
    [workspace]
  )
  const [remote, setRemote] = useState<{ key: string; projects: ProjectRow[]; work?: Work }>()
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  useEffect(() => {
    if (mockProfileEnabled || !enabled) return
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [enabled, reload])
  const key = JSON.stringify([id, mid])
  useEffect(() => {
    if (mockProfileEnabled || !enabled) return
    const controller = new AbortController()
    const read = async () => {
      const projects: ProjectRow[] = []
      for (let page = 1; ; page++) {
        const res = await api('/projects?page_size=50&page=' + page, token, { signal: controller.signal })
        const { data, meta }: { data: ApiProject[]; meta: { total: number } } = await res.json()
        projects.push(...data.map((p) => ({ ...p, id: String(p.id) })))
        if (!data.length || projects.length >= meta.total) break
      }
      const selected = id ?? projects.find((p) => p.status === 'in_progress')?.id
      let work: Work | undefined
      if (selected && projects.some((p) => p.id === selected)) {
        const { data: w }: { data: ApiWork } = await (
          await api('/projects/' + encodeURIComponent(selected) + '/workspace', token, { signal: controller.signal })
        ).json()
        const funded = w.contract.status === 'active' && w.escrow?.status === 'active'
        const milestones = w.milestones.map((m) => apiMilestone(m, funded))
        const target = mid || defaultMilestone(milestones)?.id
        if (target && milestones.some((m) => m.id === target)) {
          const { data: m }: { data: ApiMilestone } = await (
            await api('/milestones/' + encodeURIComponent(target), token, { signal: controller.signal })
          ).json()
          if (String(m.id) !== target) throw new Error('Milestone unavailable.')
          milestones[milestones.findIndex((row) => row.id === target)] = apiMilestone(m, funded)
        }
        work = {
          project: { ...w.project, id: String(w.project.id) },
          milestones,
          start: w.project.expected_start_at,
          end: w.project.expected_end_at,
          total: w.contract.total_amount,
          locked: w.escrow?.remaining_locked_amount,
          scope: w.agreement.terms.scope || w.agreement.terms.scope_summary || '',
          contractId: String(w.contract.id),
          agreement: 'v' + w.agreement.version,
          fundedAt: w.escrow?.funded_at,
          events: w.recent_activity.map((e) => ({ text: e.summary, at: e.created_at })),
          files: w.files.map(apiFile),
        }
      }
      if (!controller.signal.aborted) setRemote({ key, projects, work })
    }
    setError('')
    read().catch((e) => {
      if (!controller.signal.aborted) setError(e.message)
    })
    return () => controller.abort()
  }, [key, id, mid, token, enabled, version])
  const activeDemo = demo?.filter((w) => w.project.status === 'active')
  return {
    projects: demo?.map((w) => w.project) ?? (remote?.key === key ? remote.projects : undefined),
    work: demo
      ? id
        ? demo.find((w) => w.project.id === id)
        : activeDemo?.[0]
      : remote?.key === key
      ? remote.work
      : undefined,
    allDemo: demo,
    error,
    reload,
  }
}
export async function downloadApiFile(token: string, file: WorkFile) {
  const r = await api('/files/' + file.apiId + '/content', token)
  downloadBlob(await r.blob(), file.name)
}
export async function submitApi(token: string, m: WorkMilestone, d: DeliveryDraft, key: string) {
  // Freeze the staged manifest before sending so a lost response can replay the identical request.
  let intent = localStorage.getItem(key)
  if (!intent) {
    const ids: number[] = []
    for (const file of d.files) {
      const body = new FormData()
      body.append('file', file)
      body.append('purpose', 'deliverable')
      const { data } = await (await api('/files', token, { method: 'POST', body })).json()
      if (!Number.isSafeInteger(data?.id)) throw new Error('Upload was not confirmed.')
      ids.push(data.id)
    }
    intent = JSON.stringify({
      id: crypto.randomUUID(),
      body: {
        title: d.title.trim(),
        notes: d.notes.trim() || null,
        file_ids: ids,
        repository_url: d.repository.trim() || null,
        repository_revision: d.revision.trim() || null,
        demo_url: d.demo.trim() || null,
        declared_criteria: m.criteria.map((c) => ({ criterion_id: Number(c.id), declared: d.criteria.includes(c.id) })),
      },
    })
    localStorage.setItem(key, intent)
  }
  const frozen = JSON.parse(intent)
  let path = '/milestones/' + encodeURIComponent(m.id) + '/submit'
  let body = frozen.body
  let requestId = frozen.id
  if (frozen.transactionId) {
    const { data: transaction } = await (await api('/transactions/' + frozen.transactionId, token)).json()
    if (!['failed', 'cancelled'].includes(transaction.status)) {
      if (transaction.status === 'awaiting_signature')
        throw new Error('The transaction is awaiting a wallet signature.')
      if (transaction.status !== 'confirmed')
        await api('/transactions/' + transaction.id + '/reconcile', token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      return
    }
    path = '/transactions/' + transaction.id + '/retry'
    frozen.retryKey ??= crypto.randomUUID()
    localStorage.setItem(key, JSON.stringify(frozen))
    requestId = frozen.retryKey
    body = {}
  }
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
    body: JSON.stringify(body),
  })
  if (r.status === 422 && !frozen.transactionId) {
    localStorage.removeItem(key)
    throw new Error('Submission validation failed. Check your files, links and criteria.')
  }
  if (!r.ok) throw new Error('Submission is unconfirmed. Check status or retry the same submission.')
  const { data } = await r.json()
  if (data?.transaction?.id) {
    localStorage.setItem(key, JSON.stringify({ ...frozen, transactionId: data.transaction.id, retryKey: undefined }))
    if (data.transaction.status === 'awaiting_signature')
      throw new Error('The transaction is awaiting a wallet signature.')
  }
}

export function useFreelancerWallet(token: string) {
  const workspace = useDemoWorkspace(mockProfileEnabled)
  const [wallet, setWallet] = useState<{available_balance:string | null; pending_payout:string | null; total_earnings:string | null}>()
  useEffect(() => {
    if (mockProfileEnabled) return
    const controller = new AbortController()
    const load = () => api('/wallet', token, { signal:controller.signal }).then(r => r.json()).then(({data}) => {
      if (!controller.signal.aborted) setWallet(data)
    }).catch(() => { if (!controller.signal.aborted) setWallet(undefined) })
    void load()
    window.addEventListener('focus', load)
    return () => { controller.abort(); window.removeEventListener('focus', load) }
  }, [token])
  if (workspace) {
    const milestones = workspace.contracts.filter(c => c.candidateId === demoRecipient && ['closed','active'].includes(c.status)).flatMap(c => c.milestones)
    const earnings = milestones.filter(m => m.status === 'released').reduce((n,m) => n+m.amount,0)
    const pending = milestones.filter(m => !settled(m.status)).reduce((n,m) => n+m.amount,0)
    // Opening demo balance before M1 was paid.
    return {balance:amount(String(9000+earnings)),earnings:amount(String(earnings)),pending:amount(String(pending))}
  }
  return {balance:amount(wallet?.available_balance ?? ''),earnings:amount(wallet?.total_earnings ?? ''),pending:amount(wallet?.pending_payout ?? '')}
}
