import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ClipboardList, Clock, Download, ExternalLink, FileArchive, FileCode2, FileText, GitBranch, History, Info, Link2, Lock, Pencil, Scale } from 'lucide-react'
import { useStore } from '../../services/store'
import { formatDateTime, formatSim } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/cn'
import type { SubmissionFile } from '../../types/domain'
import { Button, LinkButton } from '../../components/ui/Button'
import { MilestoneStatusBadge } from '../../components/ui/Badge'
import { Breadcrumb, CardTitle } from '../../components/ui/Display'
import { Alert, Dialog, useToast } from '../../components/ui/Feedback'
import { Field, Textarea } from '../../components/ui/Field'
import { ProjectIcon } from '../../components/ProjectRow'

const FILE_ICON: Record<SubmissionFile['kind'], ReactNode> = {
  archive: <FileArchive className="size-5" />,
  code: <FileCode2 className="size-5" />,
  pdf: <FileText className="size-5 text-danger" />,
  report: <ClipboardList className="size-5" />,
  link: <Link2 className="size-5" />,
  repo: <GitBranch className="size-5" />,
}

function useCountdown(iso?: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!iso) return null
  const ms = Math.max(0, new Date(iso).getTime() - now)
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return { d, h, m, done: ms === 0 }
}

export default function MilestoneReview() {
  const { projectId = '', milestoneId = '' } = useParams()
  const store = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const project = store.getProject(projectId)
  const contract = store.getContract(project?.contractId)
  const m = contract?.milestones.find((x) => x.id === milestoneId)
  usePageTitle(m ? `Review · Milestone ${m.seq}` : 'Review')

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<null | 'approve' | 'revise' | 'dispute'>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [releasing, setReleasing] = useState(false)
  const left = useCountdown(m?.reviewDeadline)

  if (!project || !contract || !m) return <Navigate to={`/client/projects/${projectId}`} replace />

  const c = store.getCandidate(projectId, contract.candidateId)
  const sub = m.submissions.at(-1)
  const canAct = m.status === 'under_review'
  const allMet = m.criteria.every((cr) => checked[cr.id])
  const unmet = m.criteria.filter((cr) => !checked[cr.id])
  const paidBefore = contract.milestones.filter((x) => x.status === 'released').reduce((n, x) => n + x.amount, 0)

  const openDialog = (d: 'revise' | 'dispute') => {
    setNote(d === 'revise' && unmet.length ? `Please complete: ${unmet.map((u) => u.text.toLowerCase()).join('; ')}.\n\n` : '')
    setNoteError('')
    setDialog(d)
  }

  const approve = async () => {
    setReleasing(true)
    await store.approveMilestone(contract.id, m.id)
    setReleasing(false)
    setDialog(null)
    toast({ tone: 'success', title: 'Payment released', body: `${formatSim(m.amount)} sent to ${c?.identity.name ?? 'the freelancer'}.` })
    navigate(`/client/projects/${projectId}`)
  }

  const submitNote = () => {
    if (note.trim().length < 20) {
      setNoteError('Write at least 20 characters so the freelancer knows exactly what to change.')
      return
    }
    if (dialog === 'revise') {
      store.requestRevision(contract.id, m.id, note.trim())
      toast({ tone: 'info', title: 'Revision requested', body: 'Funds stay locked. A new 5-day review starts when they resubmit.' })
    } else {
      store.raiseDispute(contract.id, m.id, note.trim())
      toast({ tone: 'danger', title: 'Dispute raised', body: `${formatSim(m.amount)} is frozen until the arbiter decides.` })
    }
    setDialog(null)
  }

  return (
    <div>
      <Breadcrumb items={[{ label: project.title, to: `/client/projects/${projectId}` }, { label: `Milestone ${m.seq}` }, { label: 'Review' }]} />
      <header className="mb-6 flex items-start gap-3">
        <LinkButton to={`/client/projects/${projectId}`} variant="quiet" size="md" aria-label="Back to project" className="w-11 shrink-0 px-0">
          <ArrowLeft className="size-5" aria-hidden />
        </LinkButton>
        <div>
          <h1 className="text-h1 md:text-h1-lg">Review milestone</h1>
          <p className="mt-1 text-small text-ink-muted md:text-body">Check the submitted work against the agreed acceptance criteria, then decide.</p>
        </div>
      </header>

      <div className="card mb-5 grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:divide-x md:divide-line">
        <div className="flex min-w-0 items-center gap-3">
          <ProjectIcon category={project.category} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{project.title}</p>
            <p className="truncate text-caption text-ink-muted">Freelancer: {c?.identity.name ?? contract.candidateId}</p>
          </div>
        </div>
        <div className="min-w-0 md:pl-4">
          <p className="truncate font-semibold">
            Milestone {m.seq} — {m.title}
          </p>
          <p className="tabular text-caption text-ink-muted">
            Contract total {formatSim(contract.milestones.reduce((n, x) => n + x.amount, 0))} · paid so far {formatSim(paidBefore)}
          </p>
        </div>
        <div className="md:pl-4">
          <MilestoneStatusBadge status={m.status} />
        </div>
      </div>

      {m.status === 'revision_required' && (
        <Alert tone="brand" title="Revision requested — waiting for a new submission" className="mb-5">
          {m.revisionNote}
        </Alert>
      )}
      {m.status === 'disputed' && (
        <Alert tone="danger" title="Disputed — funds are frozen" className="mb-5" action={<LinkButton to="/client/disputes" size="sm" variant="danger">Open dispute</LinkButton>}>
          {m.disputeReason}
        </Alert>
      )}
      {m.status === 'released' && (
        <Alert tone="success" title={`Paid${m.releasedAt ? ` on ${formatDateTime(m.releasedAt)}` : ''}`} className="mb-5">
          {formatSim(m.amount)} was released to {c?.identity.name ?? 'the freelancer'}.
        </Alert>
      )}

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <div className={cn('card flex items-center gap-4 p-4', canAct && 'border-accent/40 bg-accent-soft/40')}>
          <Clock className="size-8 shrink-0 text-accent" aria-hidden />
          <div>
            {canAct && left ? (
              <>
                <p className="tabular text-h3">
                  {left.d}d {left.h}h {left.m}m left
                </p>
                <p className="text-caption text-ink-muted">Then payment releases automatically ({contract.reviewDays}-day review window)</p>
              </>
            ) : (
              <>
                <p className="text-h3">No review clock</p>
                <p className="text-caption text-ink-muted">Runs only while work is under review</p>
              </>
            )}
          </div>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <Lock className="size-8 shrink-0 text-brand" aria-hidden />
          <div>
            <p className="tabular text-h3">{formatSim(m.amount)}</p>
            <p className="text-caption text-ink-muted">{m.status === 'released' ? 'Released from escrow' : `Locked in escrow for Milestone ${m.seq}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-info/15 bg-info-soft p-4 text-small text-ink">
          <Info className="size-5 shrink-0 text-info" aria-hidden />
          You review this work against the agreed criteria. AI does not approve or reject submissions.
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
        <section className="card p-5">
          <CardTitle icon={<FileText className="size-5 text-brand" aria-hidden />}>Submitted files</CardTitle>
          {sub ? (
            <>
              <ul className="divide-y divide-line">
                {sub.files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 py-2.5">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm bg-canvas text-ink-muted">{FILE_ICON[f.kind]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-small font-semibold">{f.name}</span>
                      <span className="block truncate text-caption text-ink-muted">{f.description}</span>
                    </span>
                    {f.size && <span className="tabular hidden text-caption text-ink-muted sm:block">{f.size}</span>}
                    <button
                      type="button"
                      aria-label={f.url ? `Open ${f.name}` : `Download ${f.name}`}
                      onClick={() => toast({ tone: 'info', title: 'Demo file', body: 'Files are not stored in this prototype.' })}
                      className="inline-flex size-9 items-center justify-center rounded-sm border border-line text-brand transition-colors hover:border-brand/50 hover:bg-brand-soft active:scale-95"
                    >
                      {f.url ? <ExternalLink className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
              {sub.notes && <p className="mt-3 rounded-md bg-canvas p-3 text-small text-ink-muted">“{sub.notes}”</p>}
            </>
          ) : (
            <p className="text-small text-ink-muted">Nothing submitted yet.</p>
          )}
        </section>

        <div className="space-y-5">
          <section className="card p-5">
            <CardTitle icon={<History className="size-5 text-brand" aria-hidden />}>Submission history</CardTitle>
            <ol className="space-y-2">
              {[...m.submissions].reverse().map((s, i) => (
                <li key={s.version} className={cn('flex items-start gap-3 rounded-md px-3 py-2.5', i === 0 ? 'bg-brand-soft/70' : '')}>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', i === 0 ? 'bg-brand' : 'bg-line-control/50')} aria-hidden />
                  <span className="text-small">
                    <span className="block font-semibold">
                      {s.version} {i === 0 && <span className="font-normal text-ink-muted">(current)</span>}
                    </span>
                    <span className="text-caption text-ink-muted">{formatDateTime(s.submittedAt)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="card p-5">
            <CardTitle icon={<ClipboardList className="size-5 text-brand" aria-hidden />}>Acceptance criteria</CardTitle>
            <ul className="space-y-1">
              {m.criteria.map((cr) => {
                const on = m.status === 'released' || Boolean(checked[cr.id])
                return (
                  <li key={cr.id}>
                    <label className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors', canAct && !on && 'hover:bg-canvas', canAct && 'has-[:focus-visible]:shadow-focus', !on && canAct && Object.keys(checked).length > 0 && 'bg-accent-soft/50')}>
                      <input type="checkbox" className="sr-only" disabled={!canAct} checked={on} onChange={(e) => setChecked((x) => ({ ...x, [cr.id]: e.target.checked }))} />
                      <span className={cn('mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors duration-150', on ? 'border-success bg-success text-white' : 'border-line-control/50 bg-surface')} aria-hidden>
                        {on && <Check className="size-3.5 animate-check" strokeWidth={3} />}
                      </span>
                      <span className="text-small">
                        <span className="block font-semibold text-ink">{cr.text}</span>
                        {cr.hint && <span className="block text-caption text-ink-muted">{cr.hint}</span>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <section className="card flex flex-col p-5">
          <CardTitle icon={<CheckCircle2 className="size-5 text-brand" aria-hidden />}>Your decision</CardTitle>
          {canAct ? (
            <>
              <p className="text-small text-ink-muted">
                {allMet
                  ? 'Every criterion is ticked. Approving releases the payment for this milestone.'
                  : `Tick each criterion the work meets. ${unmet.length} of ${m.criteria.length} not yet accepted.`}
              </p>
              {!allMet && (
                <div className="mt-4 flex gap-2 rounded-md bg-brand-soft/60 p-3 text-small text-brand">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="font-semibold">Approval unlocks once all criteria are accepted.</span>
                </div>
              )}
              <div className="mt-auto flex flex-col gap-2 pt-6">
                <Button block disabled={!allMet} icon={<Check className="size-4" aria-hidden />} onClick={() => setDialog('approve')}>
                  Approve & release payment
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => openDialog('revise')}>
                    Request revision
                  </Button>
                  <Button variant="danger" icon={<AlertTriangle className="size-4" aria-hidden />} onClick={() => openDialog('dispute')}>
                    Raise dispute
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-small text-ink-muted">No decision is needed right now.</p>
          )}
        </section>
      </div>

      <Dialog
        open={dialog === 'approve'}
        onClose={() => !releasing && setDialog(null)}
        title={`Approve Milestone ${m.seq}?`}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDialog(null)} disabled={releasing}>
              Cancel
            </Button>
            <Button onClick={approve} loading={releasing}>
              {releasing ? 'Releasing' : `Release ${formatSim(m.amount)}`}
            </Button>
          </>
        }
      >
        This releases {formatSim(m.amount)} from escrow to {c?.identity.name ?? 'the freelancer'}. A confirmed release cannot be reversed.
      </Dialog>

      <Dialog
        open={dialog === 'revise' || dialog === 'dispute'}
        onClose={() => setDialog(null)}
        size="lg"
        title={dialog === 'revise' ? 'Request revision' : 'Raise a dispute'}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant={dialog === 'dispute' ? 'danger' : 'primary'} icon={dialog === 'dispute' ? <Scale className="size-4" aria-hidden /> : undefined} onClick={submitNote}>
              {dialog === 'revise' ? 'Send revision request' : 'Raise dispute'}
            </Button>
          </>
        }
      >
        <p className="mb-4">
          {dialog === 'revise'
            ? `${formatSim(m.amount)} stays locked. Ask only for what the agreed criteria cover; a valid resubmission starts a new ${contract.reviewDays}-day review.`
            : `${formatSim(m.amount)} is frozen and the case goes to ${contract.arbiter}, who reviews the contract and both sides’ evidence. Try a revision request first if the issue can be fixed.`}
        </p>
        <Field label={dialog === 'revise' ? 'What needs to change' : 'Reason for the dispute'} required error={noteError}>
          {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} rows={5} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </Dialog>
    </div>
  )
}
