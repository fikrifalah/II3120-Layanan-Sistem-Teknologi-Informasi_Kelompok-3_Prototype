import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Scale } from 'lucide-react'
import { useStore } from '../../services/store'
import { formatDateTime, formatSim } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, PageHeader } from '../../components/ui/Display'
import { Alert } from '../../components/ui/Feedback'
import { contractsApiEnabled } from '../../services/clientContracts'
import { currentToken } from '../../services/auth'
import { evidenceHref, listDisputes, type DisputeCase } from '../../services/disputes'

const VERDICT_LABEL: Record<NonNullable<DisputeCase['verdict']>['action'], string> = {
  RELEASE: 'Released to freelancer',
  REFUND: 'Refunded to you',
  SPLIT: 'Split by arbiter',
}

/** Mode backend: sengketa terbuka dan yang sudah diputus, langsung dari `GET /disputes`. */
export default function Disputes() {
  usePageTitle('Disputes')
  if (!contractsApiEnabled) return <LocalDisputes />
  return <BackendDisputes />
}

function BackendDisputes() {
  const store = useStore()
  const [cases, setCases] = useState<DisputeCase[]>()
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = () =>
      listDisputes(currentToken())
        .then((rows) => {
          if (!alive) return
          setCases(rows)
          setError('')
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load disputes.'))
    void load()
    const timer = window.setInterval(load, 10_000) // putusan arbiter muncul tanpa refresh
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  /** Tautan ke halaman review milestone bila proyeknya ada di workspace client ini. */
  const reviewLink = (d: DisputeCase) => {
    const c = store.contracts.find((x) => x.backendId === d.contract.id)
    const m = c?.milestones.find((x) => x.backendId === d.milestone.id)
    return c && m ? `/client/projects/${c.projectId}/milestones/${m.id}/review` : undefined
  }

  const open = cases?.filter((d) => d.status === 'open') ?? []
  const resolved = cases?.filter((d) => d.status === 'resolved') ?? []

  return (
    <div>
      <PageHeader title="Disputes" subtitle="Milestones where funds were frozen for an arbiter to decide." />
      {error && (
        <Alert tone="danger" title="Could not load disputes" className="mb-4">
          {error}
        </Alert>
      )}
      {!cases ? (
        !error && <p className="text-small text-ink-muted">Loading disputes…</p>
      ) : cases.length === 0 ? (
        <EmptyState
          icon={<Scale className="size-6" />}
          title="No disputes"
          body="If a revised submission still misses an agreed criterion, you can raise a dispute from the milestone review."
        />
      ) : (
        <div className="space-y-8">
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 text-h3">In review ({open.length})</h2>
              <ul className="stagger space-y-3">
                {open.map((d) => (
                  <DisputeRow key={d.id} d={d} to={reviewLink(d)} />
                ))}
              </ul>
            </section>
          )}
          {resolved.length > 0 && (
            <section>
              <h2 className="mb-3 text-h3">Resolved ({resolved.length})</h2>
              <ul className="stagger space-y-3">
                {resolved.map((d) => (
                  <DisputeRow key={d.id} d={d} to={reviewLink(d)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function DisputeRow({ d, to }: { d: DisputeCase; to?: string }) {
  const v = d.verdict
  const body = (
    <>
      <span
        className={
          'inline-flex size-11 shrink-0 items-center justify-center rounded-md ' +
          (v ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')
        }
      >
        <Scale className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          Milestone {d.milestone.index + 1} · {d.milestone.title}
        </span>
        <span className="block truncate text-small text-ink-muted">
          {d.contract.job_title ?? `Project #${d.contract.job_id}`} · raised by {d.raised_by?.name ?? '—'} on{' '}
          {formatDateTime(d.created_at)}
        </span>
        <span className="mt-1 block truncate text-small">“{d.reason}”</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          {v ? <Badge tone="success">{VERDICT_LABEL[v.action]}</Badge> : <Badge tone="danger">In review</Badge>}
          <span className="text-caption text-ink-muted">Arbiter: {d.assigned_arbiter?.name ?? '—'}</span>
          {d.evidence[0] && (
            <a
              href={evidenceHref(d.evidence[0].url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-caption text-brand hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText className="size-3.5" aria-hidden />
              Evidence ({d.evidence.length})
            </a>
          )}
        </span>
        {v && (
          <span className="mt-2 block rounded-md bg-canvas p-3 text-small">
            <span className="block">
              Freelancer received <b className="tabular">{formatSim(v.freelancer_payout)}</b> ({v.freelancer_share_percentage}%) · you
              were refunded <b className="tabular">{formatSim(v.client_refund)}</b> ({v.client_refund_percentage}%)
            </span>
            {!!v.voided_milestones?.length && (
              <span className="mt-1 block font-semibold text-danger">
                Project ended: {v.voided_milestones.map((m) => `Milestone ${m.sequence}`).join(', ')} voided ·{' '}
                {formatSim(v.voided_refund ?? 0)} more refunded to you
              </span>
            )}
            <span className="mt-1 block text-ink-muted">Reasoning: {v.reasoning}</span>
            {v.resolved_at && <span className="mt-1 block text-caption text-ink-muted">Decided {formatDateTime(v.resolved_at)}</span>}
          </span>
        )}
      </span>
      <span className="tabular text-right text-small font-semibold">
        {formatSim(d.milestone.amount)}
        <span className="block text-caption font-normal text-ink-muted">{v ? 'settled' : 'frozen'}</span>
      </span>
      {to && <ChevronRight className="size-5 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />}
    </>
  )
  return (
    <li>
      {to ? (
        <Link to={to} className="card-link group flex items-start gap-4 p-4 md:p-5">
          {body}
        </Link>
      ) : (
        <div className="card flex items-start gap-4 p-4 md:p-5">{body}</div>
      )}
    </li>
  )
}

/** Mode demo (tanpa backend kontrak): sengketa terbuka dari workspace lokal. */
function LocalDisputes() {
  const store = useStore()
  const cases = store.contracts.flatMap((c) => c.milestones.filter((m) => m.status === 'disputed').map((m) => ({ c, m })))

  return (
    <div>
      <PageHeader title="Disputes" subtitle="Milestones where funds are frozen until an arbiter decides." />
      {cases.length === 0 ? (
        <EmptyState icon={<Scale className="size-6" />} title="No disputes" body="If a final submission misses an agreed criterion, you can raise a dispute from the milestone review." />
      ) : (
        <ul className="stagger space-y-3">
          {cases.map(({ c, m }) => (
            <li key={`${c.id}-${m.id}`}>
              <Link to={`/client/projects/${c.projectId}/milestones/${m.id}/review`} className="card-link group flex items-center gap-4 p-4 md:p-5">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
                  <Scale className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    Milestone {m.seq} · {store.getProject(c.projectId)?.title}
                  </span>
                  <span className="block truncate text-small text-ink-muted">{m.disputeReason}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="danger">In review</Badge>
                    <span className="text-caption text-ink-muted">Assigned to {c.arbiter}</span>
                  </span>
                </span>
                <span className="tabular text-right text-small font-semibold">{formatSim(m.amount)} frozen</span>
                <ChevronRight className="size-5 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
