import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  CheckCircle2,
  Circle,
  CodeXml,
  Coins,
  FileText,
  Flag,
  Folder,
  Layers,
  MessageSquare,
  Save,
  Send,
  Trash2,
} from 'lucide-react'
import { Dialog } from '../components/ui/Feedback'
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
  amount,
  defaultMilestone,
  downloadApiFile,
  settled,
  statusLabel,
  submitApi,
  type useProjectWork,
  type Work,
  type WorkFile,
  type WorkMilestone,
} from '../services/projectWork'
import './projects.css'

export const projectPath = (id: string) => '/projects/' + encodeURIComponent(id) + '/workspace'
export const milestonePath = (id: string, m: string) =>
  '/projects/' + encodeURIComponent(id) + '/milestones/' + encodeURIComponent(m)
const date = (s?: string) => (s ? formatDate(s) : 'To be agreed')
type Data = ReturnType<typeof useProjectWork>

export function FileList({ files, token }: { files: WorkFile[]; token: string }) {
  const [error, setError] = useState('')
  return (
    <>
      <ul className="delivery-files">
        {files.map((f, i) => (
          <li key={i}>
            <FileText />
            <span>
              {f.name}
              <small>{f.size || f.description}</small>
            </span>
            {f.blobId || f.apiId || (f.url && httpUrl(f.url)) ? (
              <button
                className="link"
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
              <small>Demo reference</small>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
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
      <div role="status">
        <h3>Awaiting submission confirmation</h3>
        <p>The submitted package is locked while the server confirms its status.</p>
        <button className="outline-action" disabled={busy} onClick={() => void submit()}>
          Retry same request
        </button>{' '}
        <button className="link" onClick={reload}>
          Check status
        </button>
        {message && <p>{message}</p>}
      </div>
    )
  return (
    <form className="delivery-form-grid" onSubmit={review}>
      <fieldset disabled={busy}>
        <label>
          Deliverable title
          <input required value={d.title} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <div className="delivery-columns">
          <div>
            <label>
              Deliverable Files
              <input
                type="file"
                multiple
                accept={acceptedFiles}
                onChange={(e) => {
                  const files = [...d.files, ...Array.from(e.target.files || [])]
                  e.target.value = ''
                  const error = fileError(files)
                  if (error) setMessage(error)
                  else patch({ files })
                }}
              />
            </label>
            <small>ZIP, PDF, PNG, JPEG or TXT · Up to 5 files, 20 MiB each</small>
            <ul className="delivery-files">
              {d.files.map((f, i) => (
                <li key={i}>
                  <FileText />
                  <span>
                    {f.name}
                    <small>{Math.ceil(f.size / 1024)} KB</small>
                  </span>
                  <button
                    type="button"
                    aria-label={'Remove ' + f.name}
                    onClick={() => patch({ files: d.files.filter((_, n) => n !== i) })}
                  >
                    <Trash2 />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <label>
            Submission Notes
            <textarea rows={4} value={d.notes} maxLength={4000} onChange={(e) => patch({ notes: e.target.value })} />
          </label>
        </div>
        <div className="delivery-columns">
          <label>
            Repository URL
            <input type="url" value={d.repository} onChange={(e) => patch({ repository: e.target.value })} />
          </label>
          <label>
            Demo URL
            <input type="url" value={d.demo} onChange={(e) => patch({ demo: e.target.value })} />
          </label>
        </div>
        {d.repository && (
          <label>
            Commit or tag (optional)
            <input value={d.revision} onChange={(e) => patch({ revision: e.target.value })} />
          </label>
        )}
        <h3>Acceptance criteria</h3>
        {m.criteria.map((c) => (
          <label key={c.id} className="delivery-check">
            <input
              type="checkbox"
              checked={d.criteria.includes(c.id)}
              onChange={(e) =>
                patch({ criteria: e.target.checked ? [...d.criteria, c.id] : d.criteria.filter((id) => id !== c.id) })
              }
            />
            {c.text}
            {!c.required && ' (optional)'}
          </label>
        ))}
        <div className="delivery-actions">
          <button className="primary-action">
            <Send />
            Submit Deliverable
          </button>
          <button type="button" className="outline-action" onClick={saveDraft}>
            <Save />
            Save as Draft
          </button>
        </div>
      </fieldset>
      {message && <p role="status">{message}</p>}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit final deliverable?"
        footer={
          <>
            <button type="button" className="outline-action" onClick={() => setConfirm(false)}>
              Keep editing
            </button>
            <button type="button" className="primary-action" onClick={() => void submit()}>
              Confirm final submission
            </button>
          </>
        }
      >
        The client will review this package against the agreed criteria. Once submitted, the files, links and notes are
        final.
      </Dialog>
    </form>
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
      <p role="alert">
        {data.error}{' '}
        <button className="link" onClick={data.reload}>
          Retry
        </button>
      </p>
    )
  if (!data.projects) return <p role="status">Loading projects…</p>
  if (!id)
    return (
      <div className="project-delivery">
        <h1>My Projects</h1>
        {!data.projects.length && <p>No assigned projects yet.</p>}
        {data.projects.map((p) => (
          <Link key={p.id} className="delivery-panel project-heading" to={projectPath(p.id)}>
            <span className="code-tile">
              <CodeXml />
            </span>
            <div>
              <h2>{p.title}</h2>
              <p>{p.category}</p>
            </div>
            <b className="green-pill">{statusLabel(p.status)}</b>
          </Link>
        ))}
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
    <ul className="delivery-events">
      {w.events.map((e, i) => (
        <li key={i}>
          <CheckCircle2 />
          <div>
            {e.text}
            <small>{formatDateTime(e.at)}</small>
          </div>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="project-delivery delivery-layout">
      <div>
        <div className="delivery-panel project-heading">
          <span className="code-tile">
            <CodeXml />
          </span>
          <div>
            <h1>{w.project.title}</h1>
            <p>{w.project.category}</p>
          </div>
          <b className="green-pill">{statusLabel(w.project.status)}</b>
        </div>
        <nav className="delivery-tabs" aria-label="Project sections">
          {[
            { name: 'Deliverables', Icon: Layers },
            { name: 'Discussion', Icon: MessageSquare },
            { name: 'Files', Icon: Folder },
            { name: 'Activity', Icon: Activity },
          ]
            .filter((t) => t.name !== 'Discussion' || w.invitationId)
            .map(({ name, Icon }) => (
              <button
                key={name}
                aria-current={tab === name ? 'page' : undefined}
                onClick={() => setParams({ tab: name })}
              >
                <Icon />
                {name}
              </button>
            ))}
        </nav>
        <section className="delivery-panel">
          {tab === 'Files' ? (
            <>
              <h2>Project files</h2>
              {w.files.length ? <FileList files={w.files} token={token} /> : <p>No submitted files yet.</p>}
            </>
          ) : tab === 'Discussion' && w.invitationId ? (
            <>
              <h2>Project discussion</h2>
              <button className="outline-action" onClick={() => setDialog('messages')}>
                Open conversation with client
              </button>
            </>
          ) : tab === 'Activity' ? (
            <>
              <h2>Project activity</h2>
              {timeline}
            </>
          ) : m ? (
            <>
              <h2>{m.eligible ? 'Submit Milestone ' + m.seq + ' Deliverable' : statusLabel(m.status)}</h2>
              <p>
                {m.eligible
                  ? 'Upload your deliverable for milestone completion.'
                  : m.deadline && m.status === 'under_review'
                  ? 'Review deadline: ' + formatDateTime(m.deadline)
                  : ''}
              </p>
              <div className="delivery-summary">
                <Flag />
                <div>
                  <b>
                    Milestone {m.seq}: {m.title}
                  </b>
                  <small>Due: {date(m.due)}</small>
                </div>
                <Coins />
                <div>
                  Amount<b>{amount(m.amount)}</b><small>{settled(m.status) ? statusLabel(m.status) : 'In escrow'}</small>
                </div>
              </div>
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
                <>
                  <h3>{m.submission.title}</h3>
                  <p className="whitespace-pre-wrap">{m.submission.notes}</p>
                  {m.submission.at && <small>Submitted {formatDateTime(m.submission.at)}</small>}
                  <FileList files={m.submission.files} token={token} />
                  {m.submission.revision && <p>Repository revision: {m.submission.revision}</p>}
                </>
              ) : (
                <p>
                  {m.transaction
                    ? 'Submission confirmation is pending.'
                    : 'Submission is unavailable at this milestone’s current status.'}{' '}
                  <button className="link" onClick={data.reload}>
                    Refresh status
                  </button>
                </p>
              )}
            </>
          ) : (
            <p>No milestones yet.</p>
          )}
        </section>
      </div>
      <aside>
        <section className="delivery-panel">
          <h2>Project Progress</h2>
          <div className="delivery-progress">
            <progress max={100} value={pct} aria-label="Project progress" />
            <b>{pct}%</b>
          </div>
        </section>
        <section className="delivery-panel">
          <h2>Milestones ({w.milestones.length})</h2>
          {w.milestones.map((x) => (
            <Link
              key={x.id}
              className="delivery-step"
              aria-current={x.id === m?.id ? 'step' : undefined}
              to={milestonePath(id, x.id)}
            >
              {settled(x.status) ? <CheckCircle2 /> : <Circle />}
              <div>
                <b>
                  Milestone {x.seq}: {x.title}
                </b>
                <small>{statusLabel(x.status)}</small>
              </div>
              <strong>{amount(x.amount)}</strong>
            </Link>
          ))}
        </section>
        <section className="delivery-panel">
          <h2>Project Details</h2>
          <dl>
            <div>
              <dt>Timeline</dt>
              <dd>
                {date(w.start)} – {date(w.end)}
              </dd>
            </div>
            <div>
              <dt>Total Contract</dt>
              <dd>{amount(w.total)}</dd>
            </div>
            <div>
              <dt>Escrow (Locked)</dt>
              <dd>{amount(w.locked)}</dd>
            </div>
          </dl>
          <button className="link" onClick={() => setDialog('contract')}>
            View Contract ↗
          </button>
        </section>
        <section className="delivery-panel">
          <h2>Activity Timeline</h2>
          {timeline}
        </section>
      </aside>
      <Dialog open={dialog === 'contract'} onClose={() => setDialog('')} title="Contract details">
        <p>
          {w.contractId} · Agreement {w.agreement}
        </p>
        <p className="my-3">{w.scope}</p>
        <b>{amount(w.total)}</b>
      </Dialog>
      {dialog === 'messages' && w.invitationId && (
        <InvitationMessages id={w.invitationId} sender="freelancer" close={() => setDialog('')} />
      )}
    </div>
  )
}
