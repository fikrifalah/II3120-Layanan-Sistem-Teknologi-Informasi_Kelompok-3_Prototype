import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BriefcaseBusiness, Calendar, Check, ChevronRight, CircleCheck, CircleMinus, CircleX, CodeXml, Coins, Flag, Info, Mail, MessageSquare, Sparkles, X } from 'lucide-react'
import { InvitationStatusBadge, SkillChip } from '../components/ui/Badge'
import { mockProfileEnabled } from '../services/freelancerProfile'
import { type ReceivedInvitation, type useReceivedInvitations } from '../services/receivedInvitations'
import { daysBetween, formatDate, formatIdr } from '../lib/format'
import InvitationMessages from '../components/InvitationMessages'
import './invitations.css'

const base = '/freelancer/invitations'
const filters = ['all','pending','accepted','declined','cancelled'] as const
const icons = [Mail,CircleMinus,CircleCheck,CircleX,X]
type Inbox = ReturnType<typeof useReceivedInvitations>
function Chips({ skills }: { skills: string[] }) {
  return <div className="inv-chips">{skills.map(s => <SkillChip key={s}>{s}</SkillChip>)}</div>
}
function Facts({ i, detail = false }: { i: ReceivedInvitation; detail?: boolean }) {
  const p = i.project
  const duration = p.expected_start_at && p.expected_end_at ? daysBetween(p.expected_start_at, p.expected_end_at) + ' days' : 'To be agreed'
  return <dl className="inv-facts">{[
    { Icon: Coins, label: 'Estimated Budget', value: p.budget_idr === null ? 'To be agreed' : formatIdr(p.budget_idr) },
    { Icon: Calendar, label: 'Duration', value: duration },
    detail && i.milestones ? { Icon: Flag, label: 'Milestones', value: i.milestones + ' milestones' } :
      { Icon: Flag, label: 'Match', value: i.match_score === null ? 'Unavailable' : Math.round(i.match_score) + '/100' },
  ].map(({ Icon, label, value }) => <div key={label}><Icon /><div><dt>{label}</dt><dd>{value}</dd></div></div>)}</dl>
}
function ProjectTitle({ i }: { i: ReceivedInvitation }) {
  return <div className="inv-title"><span className="code-tile"><CodeXml /></span><div><h2>{i.project.title}</h2><p>{i.client.name} · {i.project.category}</p></div></div>
}
function Notice({ children }: { children: React.ReactNode }) { return <div className="inv-notice"><Info />{children}</div> }

export default function ReceivedInvitations({ inbox, id }: { inbox: Inbox; id?: string }) {
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [messages, showMessages] = useState(false)
  const request = useRef<AbortController>()
  useEffect(() => () => request.current?.abort(), [])
  const { list, item: i } = inbox
  if (inbox.error) return <div className="inv-card" role="alert">{inbox.error} <button className="link" onClick={inbox.retry}>Retry</button> · <Link to={base}>Received Invitations</Link></div>
  if (id && !i || !id && !list) return <p role="status">Loading invitations…</p>
  async function respond(decision: 'accepted' | 'declined') {
    if (request.current || !i || i.status !== 'pending') return
    const controller = new AbortController()
    request.current = controller; setBusy(true); setError('')
    try { await inbox.respond(decision, controller.signal) }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Please retry.') }
    finally { if (!controller.signal.aborted) { setBusy(false); request.current = undefined } }
  }
  if (id && i) {
    const can = (action: string) => i.status === 'pending' && i.allowed_actions.some(a => [action, 'respond', 'respond_invitation', action + '_invitation'].includes(a))
    return <article className="inv-page">
      <Link className="link" to={{ pathname: base, search: params.toString() }}>Invitations</Link><span> / Invitation Detail</span>
      <header className="inv-heading"><h1>Invitation Detail</h1><InvitationStatusBadge status={i.status} /></header>
      <p>Review the project details and match explanation, then respond to the invitation.</p>
      <section className="inv-card"><ProjectTitle i={i} /><Facts i={i} detail />
        <h3>Project Summary</h3><p>{i.project.description}</p>
        <h3>Required Skills</h3><Chips skills={i.project.required_skills} />
        {i.project.preferred_skills.length > 0 && <><h3>Preferred Skills</h3><Chips skills={i.project.preferred_skills} /></>}
      </section>
      <section className="inv-match"><div><Sparkles /><h3>Why You Were Invited (AI Match)</h3>{i.match_score !== null && <b>Match: {Math.round(i.match_score)}/100</b>}</div>
        <p>{i.match_explanation || 'No match explanation was provided.'}</p></section>
      {i.evidence && <section className="inv-card"><h3>Relevant Portfolio Evidence</h3><p>{i.evidence}</p></section>}
      {i.message && <section className="inv-card"><h3>Message from {i.client.name}</h3><p>{i.message}</p></section>}
      <Notice>Accepting opens a discussion about project terms. Work and escrow funding start later, after contract agreement and funding.</Notice>
      <div className="inv-meta"><span>Invited by <b>{i.client.name}</b></span><span>Sent on <b>{formatDate(i.created_at)}</b></span><span>Status <InvitationStatusBadge status={i.status} /></span></div>
      {error && <p role="alert">{error}</p>}<div className="inv-actions">
        {can('accept') && <button className="primary-action" disabled={busy} onClick={() => respond('accepted')}><Check />Accept Invitation</button>}
        {can('decline') && <button className="outline-action" disabled={busy} onClick={() => respond('declined')}><X />Decline</button>}
        {mockProfileEnabled && (i.allowed_actions.includes('message') || i.status === 'declined' || i.status === 'cancelled') && <button className="outline-action" onClick={() => showMessages(true)}><MessageSquare />{i.allowed_actions.includes('message') ? 'Message Client' : 'View Messages'}</button>}
      </div>{messages && <InvitationMessages id={id} sender="freelancer" close={() => showMessages(false)} />}
    </article>
  }
  const query = (params.get('q') ?? '').trim().toLowerCase()
  const filter = params.get('status') ?? 'all'
  const searched = (list ?? []).filter(i => [i.project.title, i.client.name, i.project.category, ...i.project.required_skills].join(' ').toLowerCase().includes(query))
  const visible = searched.filter(i => filter === 'all' || i.status === filter)
  return <div className="inv-page"><h1>Received Invitations</h1><p>Project invitations from clients based on your profile and portfolio.</p>
    <Notice>Clients invite you directly when your profile matches their project.</Notice>
    <div className="inv-filters" aria-label="Filter invitations">{filters.map((f,n) => {
      const count = f === 'all' ? searched.length : searched.filter(i => i.status === f).length
      if (f === 'cancelled' && !count && f !== filter) return null
      const Icon = icons[n]
      return <button key={f} aria-pressed={filter === f} onClick={() => { const next = new URLSearchParams(params); next.set('status',f); setParams(next) }}><Icon />{f[0].toUpperCase()+f.slice(1)} ({count})</button>
    })}</div>
    {visible.length === 0 && <p className="inv-card">No invitations match this view.</p>}
    {visible.map(i => <article className="inv-card" key={i.id}><div className="inv-heading"><ProjectTitle i={i} /><InvitationStatusBadge status={i.status} /></div>
      <Facts i={i} /><p className="inv-sender"><BriefcaseBusiness />Invited {formatDate(i.created_at)} by {i.client.name}</p>
      <div className="inv-bottom"><Chips skills={i.project.required_skills} /><Link className="outline-action" to={{ pathname: base + '/' + encodeURIComponent(i.id), search: params.toString() }}>View Details <ChevronRight /></Link></div>
    </article>)}
  </div>
}
