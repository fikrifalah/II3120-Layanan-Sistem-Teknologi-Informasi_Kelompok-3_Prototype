import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Alert, Dialog } from '../components/ui/Feedback'
import { formatDateTime, formatSim, shortHash, timeAgo } from '../lib/format'
import { currentAccount, currentToken } from '../services/auth'
import { evidenceHref, listDisputes, submitVerdict, type DisputeCase } from '../services/disputes'

type VerdictAction = 'RELEASE' | 'REFUND' | 'SPLIT'

const verdictLabel: Record<VerdictAction, string> = {
  RELEASE: 'Release to freelancer',
  REFUND: 'Refund to client',
  SPLIT: 'Split payment',
}

function Metric({ icon, label, value, note, tone = 'brand' }: {
  icon: ReactNode
  label: string
  value: string
  note: string
  tone?: 'brand' | 'warning' | 'success'
}) {
  const iconTone = {
    brand: 'bg-brand-soft text-brand',
    warning: 'bg-accent-soft text-accent-strong',
    success: 'bg-success-soft text-success',
  }[tone]
  return (
    <article className="card flex items-center gap-4 p-4 md:p-5">
      <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md ${iconTone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-caption font-medium text-ink-muted">{label}</p>
        <p className="tabular text-h2">{value}</p>
        <p className="truncate text-caption text-ink-muted">{note}</p>
      </div>
    </article>
  )
}

function CaseCard({ dispute, selected, onSelect }: {
  dispute: DisputeCase
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`card w-full p-4 text-left transition-[border-color,box-shadow,background-color] hover:border-line-control/50 ${
        selected ? 'border-brand bg-brand-soft/30 shadow-card' : ''
      }`}
    >
      <span className="flex items-start gap-3">
        <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-sm ${
          dispute.status === 'open' ? 'bg-accent-soft text-accent-strong' : 'bg-success-soft text-success'
        }`}>
          {dispute.status === 'open' ? <Scale className="size-5" aria-hidden /> : <Check className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Dispute #{dispute.id} · {dispute.contract.job_title ?? 'Project'}</span>
            <Badge tone={dispute.status === 'open' ? 'warning' : 'success'} dot>
              {dispute.status === 'open' ? 'Open' : 'Resolved'}
            </Badge>
          </span>
          <span className="mt-1 block truncate text-small text-ink-muted">
            Milestone {dispute.milestone.index + 1}: {dispute.milestone.title}
          </span>
          <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
            <span>{dispute.client?.name ?? 'Client'} vs {dispute.freelancer?.name ?? 'Freelancer'}</span>
            <span>{timeAgo(dispute.created_at)}</span>
          </span>
          <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <span className="inline-flex items-center gap-1.5 text-caption text-ink-muted">
              <Wallet className="size-4" aria-hidden /> {formatSim(dispute.milestone.amount)} {dispute.status === 'open' ? 'frozen' : 'settled'}
            </span>
            <ChevronRight className="size-4 text-ink-muted" aria-hidden />
          </span>
        </span>
      </span>
    </button>
  )
}

function Detail({ dispute, token, onResolved }: {
  dispute: DisputeCase
  token: string
  onResolved: (updated: DisputeCase) => void
}) {
  const [action, setAction] = useState<VerdictAction>('RELEASE')
  const [share, setShare] = useState(50)
  const [reasoning, setReasoning] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setAction('RELEASE')
    setShare(50)
    setReasoning('')
    setConfirm(false)
    setSaving(false)
    setError('')
    setNotice('')
  }, [dispute.id])

  const freelancerPct = action === 'RELEASE' ? 100 : action === 'REFUND' ? 0 : share
  const freelancerAmount = dispute.milestone.amount * freelancerPct / 100
  const clientAmount = dispute.milestone.amount - freelancerAmount

  const decide = async () => {
    setSaving(true)
    setError('')
    try {
      const updated = await submitVerdict(token, dispute.id, action, share, reasoning.trim())
      onResolved(updated)
      setConfirm(false)
      setNotice(`Dispute #${dispute.id} resolved. Verdict recorded on-chain.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit verdict. Please retry.')
      setConfirm(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card min-w-0 overflow-hidden">
      <div className="border-b border-line p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Case file · #{dispute.id}</p>
            <h2 className="mt-1 text-h2">{dispute.contract.job_title ?? 'Project dispute'}</h2>
            <p className="mt-1 text-small text-ink-muted">
              Milestone {dispute.milestone.index + 1} · {dispute.milestone.title}
            </p>
          </div>
          <Badge tone={dispute.status === 'open' ? 'warning' : 'success'} dot>
            {dispute.status === 'open' ? 'Awaiting verdict' : 'Resolved'}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-canvas p-3">
            <p className="text-caption text-ink-muted">Funds at stake</p>
            <p className="mt-1 font-semibold">{formatSim(dispute.milestone.amount)}</p>
          </div>
          <div className="rounded-md bg-canvas p-3">
            <p className="text-caption text-ink-muted">Contract</p>
            <p className="mt-1 font-semibold">#{dispute.contract.id}</p>
          </div>
          <div className="rounded-md bg-canvas p-3">
            <p className="text-caption text-ink-muted">Raised</p>
            <p className="mt-1 font-semibold">{formatDateTime(dispute.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:p-6 xl:grid-cols-2">
        <div className="space-y-5">
          <section>
            <h3 className="flex items-center gap-2 font-semibold">
              <AlertCircle className="size-4 text-accent-strong" aria-hidden /> Dispute summary
            </h3>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-line bg-canvas/70 p-3 text-small leading-6">
              {dispute.reason}
            </p>
            <div className="mt-3 grid gap-2 text-small sm:grid-cols-2">
              <p><span className="text-ink-muted">Raised by</span><br /><strong>{dispute.raised_by?.name ?? 'Participant'}</strong></p>
              <p><span className="text-ink-muted">Client / freelancer</span><br /><strong>{dispute.client?.name ?? 'Client'} / {dispute.freelancer?.name ?? 'Freelancer'}</strong></p>
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 font-semibold">
              <FileText className="size-4 text-brand" aria-hidden /> Evidence ({dispute.evidence.length})
            </h3>
            {dispute.evidence.length ? (
              <ul className="mt-2 space-y-2">
                {dispute.evidence.map((file) => (
                  <li key={file.id} className="rounded-md border border-line p-3">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <a
                          href={evidenceHref(file.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="link inline-flex max-w-full items-center gap-1 truncate text-small font-semibold"
                        >
                          {file.filename}<ExternalLink className="size-3.5 shrink-0" aria-hidden />
                        </a>
                        <p className="mt-0.5 text-caption text-ink-muted">
                          {file.uploaded_by?.name ?? 'Participant'} · {(file.size_bytes / 1024).toFixed(0)} KB · {formatDateTime(file.uploaded_at)}
                        </p>
                        <p className="mt-1 break-all font-mono text-[11px] text-ink-muted" title={file.sha256}>
                          SHA-256 {shortHash(file.sha256)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-md bg-canvas p-3 text-small text-ink-muted">No files were attached to this dispute.</p>
            )}
          </section>

          {(dispute.raise_transaction_hash || dispute.milestone.deliverable_url || dispute.milestone.deliverable_hash) && (
            <section className="rounded-md border border-line p-3">
              <h3 className="font-semibold">On-chain & submission references</h3>
              <dl className="mt-2 space-y-2 text-caption">
                {dispute.raise_transaction_hash && <div><dt className="text-ink-muted">Dispute transaction</dt><dd className="break-all font-mono">{dispute.raise_transaction_hash}</dd></div>}
                {dispute.milestone.deliverable_hash && <div><dt className="text-ink-muted">Deliverable SHA-256</dt><dd className="break-all font-mono">{dispute.milestone.deliverable_hash}</dd></div>}
                {dispute.milestone.deliverable_url && <div><dt className="text-ink-muted">Deliverable</dt><dd><a className="link" href={dispute.milestone.deliverable_url} target="_blank" rel="noreferrer">Open submission</a></dd></div>}
              </dl>
            </section>
          )}
        </div>

        <div>
          {notice && <Alert tone="success" title="Verdict submitted" className="mb-4">{notice}</Alert>}
          {error && <Alert tone="danger" title="Could not submit verdict" className="mb-4">{error}</Alert>}
          {dispute.verdict ? (
            <section className="rounded-lg border border-success/20 bg-success-soft/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-success">
                <ShieldCheck className="size-5" aria-hidden /> Final verdict · {dispute.verdict.action}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-small text-ink">{dispute.verdict.reasoning}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-small">
                <div><dt className="text-ink-muted">Freelancer receives</dt><dd className="font-semibold">{formatSim(dispute.verdict.freelancer_payout)}</dd></div>
                <div><dt className="text-ink-muted">Client receives</dt><dd className="font-semibold">{formatSim(dispute.verdict.client_refund)}</dd></div>
              </dl>
              {!!dispute.verdict.voided_milestones?.length && (
                <p className="mt-3 text-small text-ink">
                  Project ended: {dispute.verdict.voided_milestones.map((m) => `Milestone ${m.sequence}`).join(', ')} voided and{' '}
                  <b>{formatSim(dispute.verdict.voided_refund ?? 0)}</b> more returned to the client.
                </p>
              )}
              {dispute.verdict.transaction_hash && (
                <p className="mt-4 break-all border-t border-success/15 pt-3 font-mono text-caption text-ink-muted">
                  Transaction: {dispute.verdict.transaction_hash}
                </p>
              )}
            </section>
          ) : (
            <section className="rounded-lg border border-brand/15 bg-brand-soft/20 p-4">
              <div className="flex items-center gap-2">
                <Gavel className="size-5 text-brand" aria-hidden />
                <h3 className="font-semibold">Issue a verdict</h3>
              </div>
              <p className="mt-1 text-caption text-ink-muted">Review the submitted evidence and agreement before settling the frozen funds.</p>

              <fieldset className="mt-4" disabled={saving}>
                <legend className="mb-2 text-small font-semibold">Outcome</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(['RELEASE', 'REFUND', 'SPLIT'] as const).map((option) => (
                    <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-caption font-semibold transition-colors ${
                      action === option ? 'border-brand bg-surface text-brand shadow-sm' : 'border-line bg-surface text-ink-muted hover:border-brand/40'
                    }`}>
                      <input className="accent-[#4A3FC1]" type="radio" name={`verdict-${dispute.id}`} value={option} checked={action === option} onChange={() => setAction(option)} />
                      {option}
                    </label>
                  ))}
                </div>

                {action === 'SPLIT' && (
                  <div className="mt-4">
                    <div className="flex justify-between text-small">
                      <label htmlFor={`share-${dispute.id}`} className="font-semibold">Freelancer share</label>
                      <span className="tabular font-semibold text-brand">{share}%</span>
                    </div>
                    <input
                      id={`share-${dispute.id}`}
                      type="range"
                      min="1"
                      max="99"
                      value={share}
                      onChange={(event) => setShare(Number(event.target.value))}
                      className="mt-2 w-full accent-[#4A3FC1]"
                    />
                    <div className="flex justify-between text-caption text-ink-muted">
                      <span>Freelancer {formatSim(freelancerAmount)}</span>
                      <span>Client {formatSim(clientAmount)}</span>
                    </div>
                  </div>
                )}

                <label htmlFor={`reasoning-${dispute.id}`} className="mt-4 block text-small font-semibold">Reasoning</label>
                <textarea
                  id={`reasoning-${dispute.id}`}
                  rows={4}
                  required
                  maxLength={4000}
                  value={reasoning}
                  onChange={(event) => setReasoning(event.target.value)}
                  placeholder="Explain how the evidence and agreed criteria support this outcome…"
                  className="mt-1.5 w-full resize-y rounded-sm border border-line-control bg-surface px-3 py-2.5 text-small text-ink placeholder:text-ink-muted/80 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                />
              </fieldset>

              <div className="mt-4 rounded-md bg-surface p-3 text-small">
                <p className="font-semibold">Settlement preview</p>
                <p className="mt-1 text-ink-muted">Freelancer: {formatSim(freelancerAmount)} · Client: {formatSim(clientAmount)}</p>
                {action === 'REFUND' && (
                  <p className="mt-2 text-danger">
                    REFUND ends the project: every unpaid milestone is voided and all remaining escrow funds also return to
                    the client. Milestones already paid stay with the freelancer.
                  </p>
                )}
              </div>
              <Button
                block
                className="mt-4"
                icon={<Gavel className="size-4" aria-hidden />}
                disabled={!reasoning.trim()}
                onClick={() => setConfirm(true)}
              >
                Review & submit verdict
              </Button>
            </section>
          )}
        </div>
      </div>

      <Dialog
        open={confirm}
        onClose={() => !saving && setConfirm(false)}
        title="Confirm final verdict"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(false)} disabled={saving}>Cancel</Button>
            <Button onClick={decide} loading={saving}>Confirm {action.toLowerCase()}</Button>
          </>
        }
      >
        <p>This executes the verdict on the escrow contract and cannot be reversed.</p>
        <p className="mt-3 font-semibold text-ink">{verdictLabel[action]}</p>
        <p className="mt-1">Freelancer: {formatSim(freelancerAmount)} · Client: {formatSim(clientAmount)}</p>
      </Dialog>
    </section>
  )
}

export default function ArbiterView({ onLogout }: { onLogout: () => void }) {
  const token = currentToken()
  const account = currentAccount()
  const [cases, setCases] = useState<DisputeCase[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadCases = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true)
    setError('')
    try {
      const data = await listDisputes(token)
      if (signal?.aborted) return
      setCases(data)
      setSelectedId((id) => data.some((dispute) => dispute.id === id) ? id : data.find((dispute) => dispute.status === 'open')?.id ?? data[0]?.id ?? null)
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Unable to load disputes.')
    } finally {
      if (!signal?.aborted) setRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    const controller = new AbortController()
    void loadCases(controller.signal)
    return () => controller.abort()
  }, [loadCases])

  const openCount = cases?.filter((item) => item.status === 'open').length ?? 0
  const resolvedCount = cases?.filter((item) => item.status === 'resolved').length ?? 0
  const frozen = cases?.filter((item) => item.status === 'open').reduce((total, item) => total + item.milestone.amount, 0) ?? 0
  const filteredCases = useMemo(() => (cases ?? []).filter((item) => {
    const matchesStatus = filter === 'all' || item.status === filter
    const term = search.trim().toLowerCase()
    const matchesQuery = !term || [
      item.contract.job_title,
      item.milestone.title,
      item.reason,
      item.client?.name,
      item.freelancer?.name,
      String(item.id),
    ].some((value) => value?.toLowerCase().includes(term))
    return matchesStatus && matchesQuery
  }), [cases, filter, search])
  const selected = filteredCases.find((item) => item.id === selectedId) ?? filteredCases[0]

  const updateResolved = (updated: DisputeCase) => {
    setCases((items) => items?.map((item) => item.id === updated.id ? updated : item) ?? [updated])
    setFilter('resolved')
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#arbiter-main" className="sr-only z-50 rounded-sm bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-sidebar flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <a href="/arbiter/dashboard" aria-label="Gigly Arbiter dashboard" className="mb-8 inline-flex rounded-sm">
          <img src="/brand/gigly-logo.png" alt="Gigly" width={480} height={200} className="h-9 w-auto" />
        </a>
        <p className="eyebrow mb-2 px-3">Arbiter workspace</p>
        <nav aria-label="Arbiter navigation" className="flex flex-col gap-1">
          <a href="#overview" className="flex h-11 items-center gap-3 rounded-sm bg-brand-soft px-3 text-small font-semibold text-brand">
            <LayoutDashboard className="size-5" aria-hidden /> Overview
          </a>
          <a href="#cases" className="flex h-11 items-center gap-3 rounded-sm px-3 text-small font-medium text-ink-muted hover:bg-canvas hover:text-ink">
            <Scale className="size-5" aria-hidden /> Disputes
            {openCount > 0 && <span className="ml-auto inline-flex size-5 items-center justify-center rounded-full bg-accent text-caption font-bold text-ink">{openCount}</span>}
          </a>
        </nav>
        <div className="mt-auto rounded-md border border-brand/10 bg-brand-soft/50 p-3 text-caption text-ink-muted">
          <div className="flex items-center gap-2 font-semibold text-brand"><ShieldCheck className="size-4" aria-hidden /> Independent review</div>
          <p className="mt-1">Assess the evidence and terms impartially before issuing a final decision.</p>
        </div>
      </aside>

      <div className="lg:pl-sidebar">
        <header className="material sticky top-0 z-10 border-b border-line/70">
          <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 md:px-8">
            <button type="button" className="inline-flex size-10 items-center justify-center rounded-sm text-ink-muted hover:bg-canvas lg:hidden" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <Menu className="size-5" aria-hidden />
            </button>
            <a href="/arbiter/dashboard" className="lg:hidden" aria-label="Gigly home">
              <img src="/brand/gigly-logo.png" alt="Gigly" className="h-8 w-auto" />
            </a>
            <div className="relative hidden w-full max-w-sm md:block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input
                type="search"
                aria-label="Search disputes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search cases, projects, people…"
                className="h-10 w-full rounded-sm border border-line bg-canvas pl-10 pr-3 text-small placeholder:text-ink-muted/80 focus:border-brand focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand/15"
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="mr-2 hidden text-right sm:block">
                <span className="block text-small font-semibold">{account?.name ?? 'Arbiter'}</span>
                <span className="block text-caption text-ink-muted">Arbiter</span>
              </span>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-soft text-caption font-bold text-brand" aria-hidden>
                {account?.name.split(/\s+/).map((name) => name[0]).slice(0, 2).join('').toUpperCase() ?? 'AR'}
              </span>
              <button type="button" onClick={onLogout} aria-label="Log out" className="ml-1 inline-flex size-10 items-center justify-center rounded-sm text-ink-muted hover:bg-canvas hover:text-ink">
                <LogOut className="size-5" aria-hidden />
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav aria-label="Mobile arbiter navigation" className="flex gap-2 border-t border-line px-4 py-2 lg:hidden">
              <a href="#overview" onClick={() => setMenuOpen(false)} className="rounded-full bg-brand-soft px-3 py-2 text-caption font-semibold text-brand">Overview</a>
              <a href="#cases" onClick={() => setMenuOpen(false)} className="rounded-full px-3 py-2 text-caption font-semibold text-ink-muted">Disputes {openCount > 0 ? `(${openCount})` : ''}</a>
            </nav>
          )}
        </header>

        <main id="arbiter-main" className="mx-auto max-w-content px-4 pb-10 pt-6 md:px-8 md:pt-8">
          <div id="overview" className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Gigly · Arbitration</p>
              <h1 className="mt-1 text-h1 md:text-h1-lg">Arbitration dashboard</h1>
              <p className="mt-1 text-small text-ink-muted md:text-body">Review disputes, evidence, and escrow outcomes in one place.</p>
            </div>
            <Button variant="quiet" size="sm" icon={<RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />} onClick={() => void loadCases()}>
              Refresh cases
            </Button>
          </div>

          {error && <Alert tone="danger" title="Could not load dispute cases" className="mb-5">{error}</Alert>}

          <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric icon={<Scale className="size-5" aria-hidden />} label="Open disputes" value={String(openCount)} note={openCount ? 'Require an impartial review' : 'You are all caught up'} tone="warning" />
            <Metric icon={<Wallet className="size-5" aria-hidden />} label="Funds in review" value={formatSim(frozen)} note="Frozen across open cases" tone="brand" />
            <Metric icon={<ShieldCheck className="size-5" aria-hidden />} label="Resolved cases" value={String(resolvedCount)} note="Final decisions recorded" tone="success" />
          </div>

          <section id="cases">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-h2">Dispute cases</h2>
                <p className="mt-1 text-caption text-ink-muted">Select a case to review its evidence and issue a verdict.</p>
              </div>
              <div className="flex gap-1 rounded-md bg-surface p-1 ring-1 ring-inset ring-line" role="tablist" aria-label="Filter disputes">
                {(['open', 'all', 'resolved'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={filter === option}
                    onClick={() => setFilter(option)}
                    className={`min-h-9 rounded-sm px-3 text-caption font-semibold capitalize transition-colors ${
                      filter === option ? 'bg-brand text-white' : 'text-ink-muted hover:bg-canvas hover:text-ink'
                    }`}
                  >
                    {option === 'all' ? `All (${cases?.length ?? 0})` : `${option} (${option === 'open' ? openCount : resolvedCount})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.4fr)]">
              <div className="space-y-3">
                <label className="relative block md:hidden">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                  <input
                    type="search"
                    aria-label="Search disputes"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search disputes…"
                    className="h-11 w-full rounded-sm border border-line bg-surface pl-10 pr-3 text-small placeholder:text-ink-muted/80 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                  />
                </label>
                {cases === null && !error ? (
                  <div className="card p-5" role="status"><div className="skeleton h-5 w-2/3" /><div className="skeleton mt-4 h-20 w-full" /></div>
                ) : filteredCases.length ? (
                  filteredCases.map((dispute) => (
                    <CaseCard key={dispute.id} dispute={dispute} selected={selected?.id === dispute.id} onSelect={() => setSelectedId(dispute.id)} />
                  ))
                ) : (
                  <div className="card flex flex-col items-center px-5 py-10 text-center">
                    <span className="inline-flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                      {filter === 'resolved' ? <Check className="size-6" aria-hidden /> : <Bell className="size-6" aria-hidden />}
                    </span>
                    <h3 className="mt-3 font-semibold">{search ? 'No matching cases' : filter === 'resolved' ? 'No resolved cases yet' : 'No open disputes'}</h3>
                    <p className="mt-1 max-w-xs text-small text-ink-muted">
                      {search ? 'Try another project, participant, or case number.' : 'New disputes assigned to you will appear here.'}
                    </p>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                {selected ? (
                  <Detail key={selected.id} dispute={selected} token={token} onResolved={updateResolved} />
                ) : (
                  <div className="card hidden min-h-64 flex-col items-center justify-center p-8 text-center xl:flex">
                    <Clock3 className="size-8 text-brand" aria-hidden />
                    <h3 className="mt-3 font-semibold">Select a dispute to review</h3>
                    <p className="mt-1 text-small text-ink-muted">Case details and available evidence will be shown here.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
          <footer className="mt-8 flex items-center justify-center gap-2 border-t border-line pt-5 text-caption text-ink-muted">
            <ShieldCheck className="size-4" aria-hidden /> Decisions are final and recorded by the escrow contract.
            <a href="/docs" target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">API docs <ArrowUpRight className="size-3.5" aria-hidden /></a>
          </footer>
        </main>
      </div>
    </div>
  )
}
