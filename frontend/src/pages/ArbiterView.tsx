import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Gavel,
  Home,
  Inbox,
  LayoutDashboard,
  RefreshCw,
  Scale,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import AppShell, { AccountMenu, SearchInput, initialsOf, type NavItem } from '../layouts/AppShell'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CardTitle, EmptyState, PageHeader, SectionTitle, StatCard, Tabs } from '../components/ui/Display'
import { Alert, Dialog } from '../components/ui/Feedback'
import { Field, Textarea } from '../components/ui/Field'
import { cn } from '../lib/cn'
import { usePageTitle } from '../lib/usePageTitle'
import { formatDateTime, formatSim, shortHash, timeAgo } from '../lib/format'
import { currentAccount, currentToken } from '../services/auth'
import { evidenceHref, listDisputes, submitVerdict, type DisputeCase } from '../services/disputes'

type VerdictAction = 'RELEASE' | 'REFUND' | 'SPLIT'

const verdictLabel: Record<VerdictAction, string> = {
  RELEASE: 'Release to freelancer',
  REFUND: 'Refund to client',
  SPLIT: 'Split payment',
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
      className={cn('card-link w-full p-4 text-left', selected && '!border-brand bg-brand-soft/30')}
    >
      <span className="flex items-start gap-3">
        <span className={`inline-flex size-12 shrink-0 items-center justify-center rounded-md ${
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
              {dispute.verdict.transaction_hash && (
                <p className="mt-4 break-all border-t border-success/15 pt-3 font-mono text-caption text-ink-muted">
                  Transaction: {dispute.verdict.transaction_hash}
                </p>
              )}
            </section>
          ) : (
            <section className="rounded-lg border border-line p-4 md:p-5">
              <CardTitle icon={<Gavel className="size-5 text-brand" aria-hidden />}>Issue a verdict</CardTitle>
              <p className="-mt-2 text-caption text-ink-muted">Review the submitted evidence and agreement before settling the frozen funds.</p>

              <fieldset className="mt-4" disabled={saving}>
                <legend className="mb-2 text-small font-semibold">Outcome</legend>
                <div className="grid gap-2">
                  {(['RELEASE', 'REFUND', 'SPLIT'] as const).map((option) => (
                    <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 text-caption font-semibold transition-colors ${
                      action === option ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-muted hover:border-brand/40'
                    }`}>
                      <input className="accent-brand" type="radio" name={`verdict-${dispute.id}`} value={option} checked={action === option} onChange={() => setAction(option)} />
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
                      className="mt-2 w-full accent-brand"
                    />
                    <div className="flex justify-between text-caption text-ink-muted">
                      <span>Freelancer {formatSim(freelancerAmount)}</span>
                      <span>Client {formatSim(clientAmount)}</span>
                    </div>
                  </div>
                )}

                <Field label="Reasoning" required className="mt-4">
                  {({ id }) => (
                    <Textarea
                      id={id}
                      rows={4}
                      required
                      maxLength={4000}
                      value={reasoning}
                      onChange={(event) => setReasoning(event.target.value)}
                      placeholder="Explain how the evidence and agreed criteria support this outcome…"
                    />
                  )}
                </Field>
              </fieldset>

              <div className="mt-4 rounded-md bg-canvas p-3 text-small">
                <p className="font-semibold">Settlement preview</p>
                <p className="mt-1 text-ink-muted">Freelancer: {formatSim(freelancerAmount)} · Client: {formatSim(clientAmount)}</p>
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
  usePageTitle('Arbitration')

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

  const name = account?.name ?? 'Arbiter'
  const showCases = () => document.getElementById('cases')?.scrollIntoView({ behavior: 'smooth' })
  const showTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const nav: NavItem[] = [
    { to: '/arbiter/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="size-5" />, match: () => true, onClick: showTop },
    { label: 'Disputes', icon: <Scale className="size-5" />, badge: openCount || undefined, onClick: showCases },
  ]
  const emptyTitle = search ? 'No matching cases' : filter === 'resolved' ? 'No resolved cases yet' : 'No open disputes'

  return (
    <AppShell
      home="/arbiter/dashboard"
      nav={nav}
      note="Assess the evidence and terms impartially before issuing a final decision."
      tabs={[{ ...nav[0], label: 'Home', icon: <Home className="size-5" /> }, { ...nav[1], badge: undefined }]}
      search={{ 'aria-label': 'Search disputes', placeholder: 'Search cases, projects, people…', value: search, onChange: (event) => setSearch(event.target.value) }}
      tools={<AccountMenu initials={initialsOf(name)} name={name} caption="Arbiter" onLogout={onLogout} />}
    >
      <PageHeader
        title="Arbitration dashboard"
        subtitle="Review disputes, evidence, and escrow outcomes in one place."
        actions={
          <Button variant="quiet" icon={<RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />} onClick={() => void loadCases()}>
            Refresh cases
          </Button>
        }
      />

      {error && <Alert tone="danger" title="Could not load dispute cases" className="mb-5">{error}</Alert>}

      <section aria-label="Summary" className="stagger grid gap-3 sm:grid-cols-3 md:gap-4">
        <StatCard icon={<Scale />} label="Open disputes" value={openCount} tone="accent" />
        <StatCard icon={<Wallet />} label="Funds in review" value={formatSim(frozen)} />
        <StatCard icon={<ShieldCheck />} label="Resolved cases" value={resolvedCount} tone="success" />
      </section>

      <section id="cases" className="mt-8 scroll-mt-20">
        <SectionTitle>Dispute cases</SectionTitle>
        <Tabs
          label="Filter disputes"
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: 'open' as const, label: 'Open', count: openCount },
            { id: 'all' as const, label: 'All', count: cases?.length ?? 0 },
            { id: 'resolved' as const, label: 'Resolved', count: resolvedCount },
          ]}
        />

        <div className="mt-4 space-y-3 md:hidden">
          <SearchInput aria-label="Search disputes" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search disputes…" />
        </div>

        {cases === null && !error ? (
          <div className="card mt-4 p-5" role="status" aria-label="Loading dispute cases"><div className="skeleton h-5 w-2/3" /><div className="skeleton mt-4 h-20 w-full" /></div>
        ) : !filteredCases.length ? (
          <div className="mt-4">
            <EmptyState
              icon={filter === 'resolved' ? <Check /> : <Inbox />}
              title={emptyTitle}
              body={search ? 'Try another project, participant, or case number.' : 'New disputes assigned to you will appear here.'}
            />
          </div>
        ) : (
          <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(19rem,0.8fr)_minmax(0,1.4fr)]">
            <div className="stagger space-y-3">
              {filteredCases.map((dispute) => (
                <CaseCard key={dispute.id} dispute={dispute} selected={selected?.id === dispute.id} onSelect={() => setSelectedId(dispute.id)} />
              ))}
            </div>
            <div className="min-w-0">
              {selected ? (
                <Detail key={selected.id} dispute={selected} token={token} onResolved={updateResolved} />
              ) : (
                <EmptyState icon={<Clock3 />} title="Select a dispute to review" body="Case details and available evidence will be shown here." />
              )}
            </div>
          </div>
        )}
      </section>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-small text-ink-muted">
        <ShieldCheck className="size-4 text-brand" aria-hidden /> Decisions are final and recorded by the escrow contract.
        <a href="/docs" target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">API docs <ArrowUpRight className="size-3.5" aria-hidden /></a>
      </p>
    </AppShell>
  )
}
