import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Coins,
  FileText,
  Flag,
  Folder,
  FolderOpen,
  Layers,
  MessageSquare,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import { Badge, type Tone } from '../components/ui/Badge'
import { Button, IconButton } from '../components/ui/Button'
import { Breadcrumb, CardTitle, EmptyState, KeyValue, PageHeader, Progress, Tabs } from '../components/ui/Display'
import { Alert, Dialog } from '../components/ui/Feedback'
import { Checkbox, Field, Input, Textarea } from '../components/ui/Field'
import { ProjectIcon } from '../components/ProjectRow'
import { cn } from '../lib/cn'
import InvitationMessages from '../components/InvitationMessages'
import { formatDate, formatDateTime } from '../lib/format'
import { mockProfileEnabled } from '../services/freelancerProfile'
import {
  acceptedFiles,
  checkFileContents,
  deliveryError,
  emptyDraft,
  fileError,
  httpUrl,
  openDemoFile,
  readRecord,
  submitDemo,
  writeRecords,
  type DeliveryDraft,
} from '../services/delivery'
import {
  acceptContractApi,
  withdrawContractApi,
  amount,
  defaultMilestone,
  downloadApiFile,
  raiseDisputeApi,
  settled,
  statusLabel,
  submitApi,
  type useProjectWork,
  type Work,
  type WorkFile,
  type WorkMilestone,
} from '../services/projectWork'

export const projectPath = (id: string) => '/projects/' + encodeURIComponent(id) + '/workspace'
export const milestonePath = (id: string, m: string) =>
  '/projects/' + encodeURIComponent(id) + '/milestones/' + encodeURIComponent(m)
const date = (s?: string) => (s ? formatDate(s) : 'To be agreed')
type Data = ReturnType<typeof useProjectWork>

// Warna status mengikuti badge sisi client.
const STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  in_progress: 'info',
  under_review: 'warning',
  pending_confirmation: 'warning',
  revision_required: 'brand',
  disputed: 'danger',
  released: 'success',
}
export function WorkStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{statusLabel(status)}</Badge>
}

export function FileList({ files, token }: { files: WorkFile[]; token: string }) {
  const [error, setError] = useState('')
  return (
    <>
      <ul className="my-3 space-y-2">
        {files.map((f, i) => (
          <li key={i} className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5">
            <FileText className="size-5 shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1 break-words text-small font-semibold">
              {f.name}
              <span className="block text-caption font-normal text-ink-muted">{f.size || f.description}</span>
            </span>
            {f.blobId || f.apiId || (f.url && httpUrl(f.url)) ? (
              <button
                type="button"
                className="link text-small"
                onClick={async () => {
                  try {
                    setError('')
                    if (f.apiId) await downloadApiFile(token, f)
                    else await openDemoFile(f)
                  } catch {
                    setError('File unavailable. Please retry.')
                  }
                }}
              >
                {f.url ? 'Open' : 'Download'}
              </button>
            ) : (
              <span className="text-caption text-ink-muted">Demo reference</span>
            )}
          </li>
        ))}
      </ul>
      {error && <Alert tone="danger">{error}</Alert>}
    </>
  )
}

function DeliveryForm({
  work,
  m,
  token,
  account,
  reload,
}: {
  work: Work
  m: WorkMilestone
  token: string
  account: string
  reload: () => void
}) {
  const navigate = useNavigate()
  const key = JSON.stringify([
    mockProfileEnabled ? 'demo' : 'api',
    account,
    work.project.id,
    work.contractId,
    work.fundedAt,
    m.id,
  ])
  const draftKey = 'gigly.draft.' + key,
    intentKey = 'gigly.intent.' + key
  const [draft, setDraft] = useState<DeliveryDraft>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(() => !!localStorage.getItem(intentKey))
  const live = useRef(true)
  const active = useRef(false)
  useEffect(() => {
    live.current = true
    readRecord<DeliveryDraft>(draftKey)
      .then((d) => {
        if (live.current) setDraft(d ?? { ...emptyDraft })
      })
      .catch(() => {
        if (live.current) setMessage('Could not read the saved draft. Reload to retry.')
      })
    return () => {
      live.current = false
    }
  }, [draftKey])
  useEffect(() => {
    if (!pending || mockProfileEnabled) return
    const timer = window.setInterval(reload, 5000)
    return () => clearInterval(timer)
  }, [pending, reload])
  if (!draft) return <p role="status">{message || 'Loading draft…'}</p>
  const d = draft
  const patch = (v: Partial<DeliveryDraft>) => {
    setDraft({ ...d, ...v })
    setMessage('')
  }
  const required = m.criteria.filter((c) => c.required).map((c) => c.id)
  async function saveDraft() {
    setBusy(true)
    try {
      await writeRecords([[draftKey, d]])
      setMessage('Draft saved on this device.')
    } catch {
      setMessage('Draft could not be saved. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  async function submit() {
    if (active.current) return
    active.current = true
    setBusy(true)
    setConfirm(false)
    setMessage('')
    try {
      if (!pending) {
        const error = deliveryError(d, required)
        if (error) throw new Error(error)
        await checkFileContents(d.files)
      }
      await navigator.locks.request('gigly.final.' + key, async () => {
        if (!live.current) return
        if (mockProfileEnabled) await submitDemo(work.project.id, m.id, d)
        else {
          await submitApi(token, m, d, intentKey)
          if (live.current) setPending(true)
        }
      })
      if (live.current) {
        navigate(milestonePath(work.project.id, m.id), { replace: true })
        reload()
      }
      if (mockProfileEnabled) await writeRecords([[draftKey, undefined]])
    } catch (e) {
      if (live.current) {
        setMessage(e instanceof Error ? e.message : 'Could not submit. Please retry.')
        setPending(!!localStorage.getItem(intentKey))
      }
    } finally {
      active.current = false
      if (live.current) setBusy(false)
    }
  }
  function review(e: FormEvent) {
    e.preventDefault()
    const error = deliveryError(d, required)
    if (error) setMessage(error)
    else setConfirm(true)
  }
  if (pending)
    return (
      <Alert tone="warning" title="Awaiting submission confirmation">
        <p>The submitted package is locked while the server confirms its status.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void submit()}>
            Retry same request
          </Button>
          <button type="button" className="link" onClick={reload}>
            Check status
          </button>
        </div>
        {message && <p className="mt-2">{message}</p>}
      </Alert>
    )
  return (
    <form onSubmit={review}>
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <Field label="Deliverable title">
          {({ id }) => <Input id={id} required value={d.title} onChange={(e) => patch({ title: e.target.value })} />}
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <Field label="Deliverable Files" hint="ZIP, PDF, PNG, JPEG or TXT · Up to 5 files, 20 MiB each">
              {({ id, describedBy }) => (
                <input
                  id={id}
                  aria-describedby={describedBy}
                  type="file"
                  multiple
                  accept={acceptedFiles}
                  className="w-full text-small text-ink-muted file:mr-3 file:h-11 file:cursor-pointer file:rounded-sm file:border-0 file:bg-brand-soft file:px-4 file:text-small file:font-semibold file:text-brand"
                  onChange={(e) => {
                    const files = [...d.files, ...Array.from(e.target.files || [])]
                    e.target.value = ''
                    const error = fileError(files)
                    if (error) setMessage(error)
                    else patch({ files })
                  }}
                />
              )}
            </Field>
            <ul className="mt-2 space-y-2">
              {d.files.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-md border border-line py-1 pl-3 pr-1">
                  <FileText className="size-5 shrink-0 text-brand" aria-hidden />
                  <span className="min-w-0 flex-1 break-words text-small font-semibold">
                    {f.name}
                    <span className="block text-caption font-normal text-ink-muted">{Math.ceil(f.size / 1024)} KB</span>
                  </span>
                  <IconButton label={'Remove ' + f.name} onClick={() => patch({ files: d.files.filter((_, n) => n !== i) })}>
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
          <Field label="Submission Notes">
            {({ id }) => <Textarea id={id} rows={4} value={d.notes} maxLength={4000} onChange={(e) => patch({ notes: e.target.value })} />}
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Repository URL">
            {({ id }) => <Input id={id} type="url" value={d.repository} onChange={(e) => patch({ repository: e.target.value })} />}
          </Field>
          <Field label="Demo URL">
            {({ id }) => <Input id={id} type="url" value={d.demo} onChange={(e) => patch({ demo: e.target.value })} />}
          </Field>
        </div>
        {d.repository && (
          <Field label="Commit or tag (optional)">
            {({ id }) => <Input id={id} value={d.revision} onChange={(e) => patch({ revision: e.target.value })} />}
          </Field>
        )}
        <div>
          <h3 className="mb-1 text-small font-semibold">Acceptance criteria</h3>
          {m.criteria.map((c) => (
            <Checkbox
              key={c.id}
              checked={d.criteria.includes(c.id)}
              onChange={(checked) =>
                patch({ criteria: checked ? [...d.criteria, c.id] : d.criteria.filter((id) => id !== c.id) })
              }
              label={c.required ? c.text : c.text + ' (optional)'}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
          <Button type="submit" icon={<Send className="size-4" aria-hidden />}>
            Submit Deliverable
          </Button>
          <Button variant="quiet" icon={<Save className="size-4" aria-hidden />} onClick={saveDraft}>
            Save as Draft
          </Button>
        </div>
      </fieldset>
      {message && (
        <p role="status" className="mt-3 text-small text-ink">
          {message}
        </p>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit final deliverable?"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Keep editing
            </Button>
            <Button onClick={() => void submit()}>Confirm final submission</Button>
          </>
        }
      >
        The client will review this package against the agreed criteria. Once submitted, the files, links and notes are
        final.
      </Dialog>
    </form>
  )
}

/** Sengketa atas permintaan perbaikan yang tidak disetujui freelancer (dana milestone dibekukan). */
function DisputeDialog({ m, token, close, reload }: { m: WorkMilestone; token: string; close: () => void; reload: () => void }) {
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function send() {
    setBusy(true)
    setMessage('')
    try {
      await raiseDisputeApi(token, m.id, reason.trim(), files)
      close()
      reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Dispute could not be raised. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onClose={close}
      title={'Dispute revision request for Milestone ' + m.seq + '?'}
      footer={
        <>
          <Button variant="quiet" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 10} onClick={() => void send()}>
            Raise dispute
          </Button>
        </>
      }
    >
      <fieldset disabled={busy} className="grid min-w-0 gap-4">
        <p>
          The milestone funds stay frozen in escrow until an arbiter rules. Explain why the delivered work already meets
          the agreed criteria.
        </p>
        <Field label="Reason" hint="At least 10 characters">
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} rows={4} maxLength={4000} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </Field>
        <Field label="Evidence (optional)" hint="Up to 5 files">
          {({ id, describedBy }) => (
            <input
              id={id}
              aria-describedby={describedBy}
              type="file"
              multiple
              accept={acceptedFiles}
              className="w-full text-small text-ink-muted file:mr-3 file:h-11 file:cursor-pointer file:rounded-sm file:border-0 file:bg-brand-soft file:px-4 file:text-small file:font-semibold file:text-brand"
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
            />
          )}
        </Field>
        {message && <Alert tone="danger">{message}</Alert>}
      </fieldset>
    </Dialog>
  )
}

export default function FreelancerProjects({
  data,
  id,
  mid,
  token,
  account,
}: {
  data: Data
  id?: string
  mid?: string
  token: string
  account: string
}) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'Deliverables'
  const navigate = useNavigate()
  const location = useLocation()
  const [dialog, setDialog] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const selected = mid
    ? data.work?.milestones.find((x) => x.id === mid)
    : data.work && defaultMilestone(data.work.milestones)
  const project = data.work
  useEffect(() => {
    if (!project || !selected?.submission?.at || selected.status === 'pending_confirmation') return
    const key = JSON.stringify([
      mockProfileEnabled ? 'demo' : 'api',
      account,
      project.project.id,
      project.contractId,
      project.fundedAt,
      selected.id,
    ])
    localStorage.removeItem('gigly.intent.' + key)
    void writeRecords([['gigly.draft.' + key, undefined]]).catch(() => {})
    if (location.pathname.endsWith('/submit'))
      navigate(milestonePath(project.project.id, selected.id), { replace: true })
  }, [project, selected, account, location.pathname, navigate])
  const waiting = !!selected?.transaction || selected?.status === 'pending_confirmation'
  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(data.reload, 5000)
    return () => clearInterval(timer)
  }, [waiting, data.reload])
  if (data.error)
    return (
      <Alert
        tone="danger"
        title={data.error}
        action={
          <button type="button" className="link text-small" onClick={data.reload}>
            Retry
          </button>
        }
      />
    )
  if (!data.projects)
    return (
      <p role="status" className="card px-5 py-4 text-small text-ink-muted">
        Loading projects…
      </p>
    )
  if (!id)
    return (
      <div>
        <PageHeader title="My Projects" subtitle="Contracts assigned to you and where each one stands." />
        {!data.projects.length ? (
          <EmptyState
            icon={<FolderOpen />}
            title="No assigned projects yet"
            body="Projects appear here after a client funds a contract with you."
          />
        ) : (
          <div className="stagger space-y-3">
            {data.projects.map((p) => (
              <Link key={p.id} className="card-link flex flex-wrap items-center gap-4 p-4 md:p-5" to={projectPath(p.id)}>
                <ProjectIcon category={p.category} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-body font-semibold">{p.title}</h2>
                  <p className="text-caption text-ink-muted">{p.category}</p>
                </div>
                <WorkStatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  const w = data.work
  const m = selected
  if (!w || (mid && !m))
    return (
      <p>
        Project or milestone unavailable.{' '}
        <Link className="link" to="/freelancer/projects">
          My Projects
        </Link>
      </p>
    )
  const pct = w.milestones.length
    ? Math.round((w.milestones.filter((x) => settled(x.status)).length * 100) / w.milestones.length)
    : 0
  const timeline = (
    <ol className="space-y-3">
      {w.events.map((e, i) => (
        <li key={i} className="flex gap-3 text-small">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <div>
            <p>{e.text}</p>
            <p className="text-caption text-ink-muted">{formatDateTime(e.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
  const sections = [
    { id: 'Deliverables', label: 'Deliverables', icon: <Layers className="size-4" aria-hidden /> },
    { id: 'Discussion', label: 'Discussion', icon: <MessageSquare className="size-4" aria-hidden /> },
    { id: 'Files', label: 'Files', icon: <Folder className="size-4" aria-hidden /> },
    { id: 'Activity', label: 'Activity', icon: <Activity className="size-4" aria-hidden /> },
  ].filter((t) => t.id !== 'Discussion' || w.invitationId)
  return (
    <div>
      <Breadcrumb home="/freelancer/dashboard" items={[{ label: 'My Projects', to: '/freelancer/projects' }, { label: w.project.title }]} />
      <PageHeader
        title={w.project.title}
        subtitle={w.project.category}
        back={<ProjectIcon category={w.project.category} />}
        actions={<WorkStatusBadge status={w.project.status} />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Tabs label="Project sections" tabs={sections} value={tab} onChange={(name) => setParams({ tab: name })} />
          {w.canAccept && (
            <section className="card mt-4 border-brand bg-brand-soft p-5 md:p-6" aria-label="Contract approval">
              <h2 className="text-h3">Review and accept the contract</h2>
              <p className="mt-1 text-small text-ink-muted">
                The client has drafted the contract. Check the scope, milestones and acceptance criteria. The client can
                lock escrow funds only after you accept.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" icon={<FileText className="size-4" aria-hidden />} onClick={() => setDialog('contract')}>
                  View contract
                </Button>
                <Button
                  icon={<CheckCircle2 className="size-4" aria-hidden />}
                  loading={accepting}
                  onClick={async () => {
                    setAccepting(true)
                    setAcceptError('')
                    try {
                      await acceptContractApi(token, w.contractId)
                      data.reload()
                    } catch (e) {
                      setAcceptError(e instanceof Error ? e.message : 'Could not accept the contract.')
                    } finally {
                      setAccepting(false)
                    }
                  }}
                >
                  Accept contract
                </Button>
              </div>
              {acceptError && (
                <Alert tone="danger" className="mt-3">
                  {acceptError}
                </Alert>
              )}
            </section>
          )}
          {w.withdrawn ? (
            <div className="mt-4">
              <Alert tone="warning" title="You withdrew from this project">
                The client will reassign the remaining milestones to another freelancer. Funds you already received stay
                yours.
              </Alert>
            </div>
          ) : (
            w.canWithdraw && (
              <section className="card mt-4 p-5 md:p-6" aria-label="Withdraw">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-h3">Can&apos;t continue?</h2>
                    <p className="mt-1 text-small text-ink-muted">
                      Withdraw to let the client reassign the remaining milestones. You cannot undo this.
                    </p>
                  </div>
                  <Button variant="danger" className="shrink-0" loading={accepting} onClick={() => setDialog('withdraw')}>
                    Withdraw from project
                  </Button>
                </div>
                {acceptError && (
                  <Alert tone="danger" className="mt-3">
                    {acceptError}
                  </Alert>
                )}
              </section>
            )
          )}
          <section className="card mt-4 p-5 md:p-6">
            {tab === 'Files' ? (
              <>
                <CardTitle>Project files</CardTitle>
                {w.files.length ? <FileList files={w.files} token={token} /> : <p className="text-small text-ink-muted">No submitted files yet.</p>}
              </>
            ) : tab === 'Discussion' && w.invitationId ? (
              <>
                <CardTitle>Project discussion</CardTitle>
                <Button variant="secondary" onClick={() => setDialog('messages')}>
                  Open conversation with client
                </Button>
              </>
            ) : tab === 'Activity' ? (
              <>
                <CardTitle>Project activity</CardTitle>
                {timeline}
              </>
            ) : m ? (
              <>
                <h2 className="text-h2">
                  {m.eligible
                    ? (m.status === 'revision_required' ? 'Resubmit' : 'Submit') + ' Milestone ' + m.seq + ' Deliverable'
                    : statusLabel(m.status)}
                </h2>
                <p className="mt-1 text-small text-ink-muted">
                  {m.eligible
                    ? 'Upload your deliverable for milestone completion.'
                    : m.deadline && m.status === 'under_review'
                    ? 'Review deadline: ' + formatDateTime(m.deadline)
                    : ''}
                </p>
                <div className="my-4 grid gap-4 rounded-md bg-canvas p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="flex items-start gap-3">
                    <Flag className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                    <p className="min-w-0 text-small">
                      <span className="block font-semibold">
                        Milestone {m.seq}: {m.title}
                      </span>
                      <span className="text-caption text-ink-muted">Due: {date(m.due)}</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Coins className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden />
                    <p className="text-small">
                      <span className="tabular block font-semibold">{amount(m.amount)}</span>
                      <span className="text-caption text-ink-muted">{settled(m.status) ? statusLabel(m.status) : w.fundedAt ? 'In escrow' : 'Not funded yet'}</span>
                    </p>
                  </div>
                </div>
                {m.revisionNote && (
                  <div role="note" className="my-3 flex flex-wrap items-start gap-2.5 rounded-md border border-accent/40 bg-accent-soft p-3">
                    <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-accent-strong" aria-hidden />
                    <div className="min-w-0 flex-1 text-small">
                      <p className="font-semibold">Revision requested by the client</p>
                      <p className="my-1 whitespace-pre-wrap">{m.revisionNote}</p>
                      <p className="text-caption text-ink-muted">
                        Resubmit the improved deliverable, or raise a dispute if you disagree with the request.
                      </p>
                    </div>
                    {m.canDispute && (
                      <Button variant="danger" size="sm" className="shrink-0" onClick={() => setDialog('dispute')}>
                        Raise dispute
                      </Button>
                    )}
                  </div>
                )}
                {m.eligible ? (
                  <DeliveryForm
                    key={w.contractId + m.id}
                    work={w}
                    m={m}
                    token={token}
                    account={account}
                    reload={data.reload}
                  />
                ) : m.submission ? (
                  <div className="text-small">
                    <h3 className="text-h3">{m.submission.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap leading-6">{m.submission.notes}</p>
                    {m.submission.at && <p className="mt-2 text-caption text-ink-muted">Submitted {formatDateTime(m.submission.at)}</p>}
                    <FileList files={m.submission.files} token={token} />
                    {m.submission.revision && <p>Repository revision: {m.submission.revision}</p>}
                  </div>
                ) : (
                  <p className="text-small text-ink-muted">
                    {m.transaction
                      ? 'Submission confirmation is pending.'
                      : m.status === 'disputed'
                      ? 'Funds for this milestone are frozen until the arbiter rules on the dispute.'
                      : !w.fundedAt
                      ? 'Work starts once you accept the contract and the client funds the escrow.'
                      : 'Submission is unavailable at this milestone’s current status.'}{' '}
                    <button type="button" className="link" onClick={data.reload}>
                      Refresh status
                    </button>
                  </p>
                )}
              </>
            ) : (
              <p className="text-small text-ink-muted">No milestones yet.</p>
            )}
          </section>
        </div>
        <aside className="min-w-0 space-y-4">
          <section className="card p-5">
            <CardTitle action={<span className="tabular text-small font-semibold">{pct}%</span>}>Project progress</CardTitle>
            <Progress value={pct} label="Project progress" />
          </section>
          <section className="card p-5">
            <CardTitle>Milestones ({w.milestones.length})</CardTitle>
            <ul className="space-y-2">
              {w.milestones.map((x) => (
                <li key={x.id}>
                  <Link
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 text-small transition-colors',
                      x.id === m?.id ? 'border-brand bg-brand-soft/40' : 'border-line hover:border-line-control/50',
                    )}
                    aria-current={x.id === m?.id ? 'step' : undefined}
                    to={milestonePath(id, x.id)}
                  >
                    {settled(x.status) ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        Milestone {x.seq}: {x.title}
                      </span>
                      <span className="block text-caption text-ink-muted">{statusLabel(x.status)}</span>
                      <span className="tabular block text-caption font-semibold">{amount(x.amount)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <CardTitle>Project details</CardTitle>
            <dl className="mb-3 divide-y divide-line">
              <KeyValue label="Timeline">
                {date(w.start)} – {date(w.end)}
              </KeyValue>
              <KeyValue label="Total contract">{amount(w.total)}</KeyValue>
              <KeyValue label="Escrow (locked)">{w.fundedAt ? amount(w.locked) : 'Not funded yet'}</KeyValue>
            </dl>
            <button type="button" className="link text-small" onClick={() => setDialog('contract')}>
              View contract
            </button>
          </section>
          <section className="card p-5">
            <CardTitle>Activity timeline</CardTitle>
            {timeline}
          </section>
        </aside>
      </div>
      <Dialog
        open={dialog === 'withdraw'}
        onClose={() => setDialog('')}
        title="Withdraw from this project?"
        footer={
          <>
            <Button variant="quiet" onClick={() => setDialog('')}>
              Keep working
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setDialog('')
                setAccepting(true)
                setAcceptError('')
                try {
                  await withdrawContractApi(token, w.contractId)
                  data.reload()
                } catch (e) {
                  setAcceptError(e instanceof Error ? e.message : 'Could not withdraw.')
                } finally {
                  setAccepting(false)
                }
              }}
            >
              Withdraw
            </Button>
          </>
        }
      >
        You will not be able to continue the remaining milestones. The client will reassign them to another freelancer.
      </Dialog>
      <Dialog open={dialog === 'contract'} onClose={() => setDialog('')} title="Contract details">
        <p>
          {w.contractId} · Agreement {w.agreement}
        </p>
        <p className="my-3">{w.scope}</p>
        <p className="font-semibold text-ink">{amount(w.total)}</p>
      </Dialog>
      {dialog === 'dispute' && m && (
        <DisputeDialog m={m} token={token} close={() => setDialog('')} reload={data.reload} />
      )}
      {dialog === 'messages' && w.invitationId && (
        <InvitationMessages id={w.invitationId} sender="freelancer" close={() => setDialog('')} />
      )}
    </div>
  )
}
