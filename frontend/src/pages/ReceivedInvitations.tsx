import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BriefcaseBusiness, Calendar, Check, ChevronRight, CircleCheck, CircleMinus, CircleX, Coins, Flag, Mail, MessageSquare, Sparkles, X } from 'lucide-react'
import { InvitationStatusBadge, Badge, SkillChip } from '../components/ui/Badge'
import { Button, LinkButton } from '../components/ui/Button'
import { Breadcrumb, CardTitle, EmptyState, PageHeader, Tabs } from '../components/ui/Display'
import { Alert } from '../components/ui/Feedback'
import { ProjectIcon } from '../components/ProjectRow'
import { SearchInput } from '../layouts/AppShell'
import { demoInbox, type ReceivedInvitation, type useReceivedInvitations } from '../services/receivedInvitations'
import { daysBetween, formatDate, formatIdr } from '../lib/format'
import InvitationMessages from '../components/InvitationMessages'

const base = '/freelancer/invitations'
const filters = ['all','pending','accepted','declined','cancelled'] as const
const icons = [Mail,CircleMinus,CircleCheck,CircleX,X]
type Inbox = ReturnType<typeof useReceivedInvitations>
function Chips({ skills }: { skills: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{skills.map(s => <SkillChip key={s}>{s}</SkillChip>)}</div>
}
function Facts({ i, detail = false }: { i: ReceivedInvitation; detail?: boolean }) {
  const p = i.project
  const duration = p.expected_start_at && p.expected_end_at ? daysBetween(p.expected_start_at, p.expected_end_at) + ' days' : 'To be agreed'
  return <dl className="my-4 grid gap-3 border-y border-line py-4 sm:grid-cols-3">{[
    { Icon: Coins, label: 'Estimated budget', value: p.budget_idr === null ? 'To be agreed' : formatIdr(p.budget_idr) },
    { Icon: Calendar, label: 'Duration', value: duration },
    detail && i.milestones ? { Icon: Flag, label: 'Milestones', value: i.milestones + ' milestones' } :
      { Icon: Flag, label: 'Match', value: i.match_score === null ? 'Unavailable' : Math.round(i.match_score) + '/100' },
  ].map(({ Icon, label, value }) => <div key={label}>
    <dt className="flex items-center gap-2 text-caption text-ink-muted"><Icon className="size-4" aria-hidden />{label}</dt>
    <dd className="tabular mt-1 text-small font-semibold">{value}</dd>
  </div>)}</dl>
}
function ProjectTitle({ i }: { i: ReceivedInvitation }) {
  return <div className="flex min-w-0 flex-1 basis-56 items-center gap-4"><ProjectIcon category={i.project.category} /><div className="min-w-0"><h2 className="text-body font-semibold">{i.project.title}</h2><p className="text-caption text-ink-muted">{i.client.name} · {i.project.category}</p></div></div>
}

export default function ReceivedInvitations({ inbox, id }: { inbox: Inbox; id?: string }) {
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [messages, showMessages] = useState(false)
  const request = useRef<AbortController>()
  useEffect(() => () => request.current?.abort(), [])
  const { list, item: i } = inbox
  if (inbox.error) return <Alert tone="danger" title={inbox.error} action={<span className="flex gap-3 text-small"><button type="button" className="link" onClick={inbox.retry}>Retry</button><Link className="link" to={base}>Received Invitations</Link></span>} />
  if (id && !i || !id && !list) return <p role="status" className="card px-5 py-4 text-small text-ink-muted">Loading invitations…</p>
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
    const search = params.toString()
    return <article>
      <Breadcrumb home="/freelancer/dashboard" items={[{ label: 'Invitations', to: base + (search ? '?' + search : '') }, { label: 'Invitation Detail' }]} />
      <PageHeader title="Invitation Detail" subtitle="Review the project details and match explanation, then respond to the invitation." actions={<InvitationStatusBadge status={i.status} />} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section className="card p-5 md:p-6"><ProjectTitle i={i} /><Facts i={i} detail />
            <h3 className="mb-1 text-small font-semibold">Project summary</h3><p className="break-words text-small leading-6">{i.project.description}</p>
            <h3 className="mb-2 mt-5 text-small font-semibold">Required skills</h3><Chips skills={i.project.required_skills} />
            {i.project.preferred_skills.length > 0 && <><h3 className="mb-2 mt-5 text-small font-semibold">Preferred skills</h3><Chips skills={i.project.preferred_skills} /></>}
          </section>
          <section className="card p-5">
            <CardTitle icon={<Sparkles className="size-5 text-brand" aria-hidden />} action={i.match_score !== null ? <Badge tone="success">Match {Math.round(i.match_score)}/100</Badge> : undefined}>Why you were invited (AI match)</CardTitle>
            <p className="break-words text-small leading-6">{i.match_explanation || 'No match explanation was provided.'}</p>
          </section>
          {i.evidence && <section className="card p-5"><CardTitle>Relevant portfolio evidence</CardTitle><p className="break-words text-small leading-6">{i.evidence}</p></section>}
          {i.message && <section className="card p-5"><CardTitle>Message from {i.client.name}</CardTitle><p className="break-words text-small leading-6">{i.message}</p></section>}
        </div>
        <aside className="space-y-4">
          <section className="card p-5">
            <CardTitle>Your response</CardTitle>
            <dl className="mb-4 divide-y divide-line text-small">
              <div className="flex justify-between gap-3 py-2"><dt className="text-ink-muted">Invited by</dt><dd className="text-right font-semibold">{i.client.name}</dd></div>
              <div className="flex justify-between gap-3 py-2"><dt className="text-ink-muted">Sent on</dt><dd className="text-right font-semibold">{formatDate(i.created_at)}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2"><dt className="text-ink-muted">Status</dt><dd><InvitationStatusBadge status={i.status} /></dd></div>
            </dl>
            {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
            <div className="flex flex-col gap-2">
              {can('accept') && <Button block disabled={busy} icon={<Check className="size-4" aria-hidden />} onClick={() => respond('accepted')}>Accept Invitation</Button>}
              {can('decline') && <Button block variant="quiet" disabled={busy} icon={<X className="size-4" aria-hidden />} onClick={() => respond('declined')}>Decline</Button>}
              {demoInbox && (i.allowed_actions.includes('message') || i.status === 'declined' || i.status === 'cancelled') && <Button block variant="secondary" icon={<MessageSquare className="size-4" aria-hidden />} onClick={() => showMessages(true)}>{i.allowed_actions.includes('message') ? 'Message Client' : 'View Messages'}</Button>}
            </div>
          </section>
          <Alert tone="brand">Accepting opens a discussion about project terms. Work and escrow funding start later, after contract agreement and funding.</Alert>
        </aside>
      </div>
      {messages && <InvitationMessages id={id} sender="freelancer" close={() => showMessages(false)} />}
    </article>
  }
  const query = (params.get('q') ?? '').trim().toLowerCase()
  const filter = params.get('status') ?? 'all'
  const searched = (list ?? []).filter(i => [i.project.title, i.client.name, i.project.category, ...i.project.required_skills].join(' ').toLowerCase().includes(query))
  const visible = searched.filter(i => filter === 'all' || i.status === filter)
  const update = (key: string, value: string, replace = false) => { const next = new URLSearchParams(params); next.set(key, value); setParams(next, { replace }) }
  const tabs = filters.flatMap((f, n) => {
    const count = f === 'all' ? searched.length : searched.filter(i => i.status === f).length
    if (f === 'cancelled' && !count && f !== filter) return []
    const Icon = icons[n]
    return [{ id: f as string, label: f[0].toUpperCase() + f.slice(1), icon: <Icon className="size-4" aria-hidden />, count }]
  })
  return <div>
    <PageHeader title="Received Invitations" subtitle="Clients invite you directly when your profile and portfolio match their project." />
    {/* Pencarian di header hanya tampil mulai md; di ponsel ada di sini. */}
    <SearchInput className="mb-3 md:hidden" aria-label="Search projects and invitations" placeholder="Search projects, invitations…" value={params.get('q') ?? ''} onChange={e => update('q', e.target.value, true)} />
    <Tabs label="Filter invitations" tabs={tabs} value={filter} onChange={value => update('status', value)} />
    <div className="stagger mt-4 space-y-3">
      {visible.length === 0 && <EmptyState icon={<Mail />} title="No invitations match this view" body="Invitations from clients will appear here." />}
      {visible.map(i => <article className="card p-4 md:p-5" key={i.id}>
        <div className="flex flex-wrap items-center justify-between gap-3"><ProjectTitle i={i} /><InvitationStatusBadge status={i.status} /></div>
        <Facts i={i} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Chips skills={i.project.required_skills} />
            <p className="flex items-center gap-2 text-caption text-ink-muted"><BriefcaseBusiness className="size-4" aria-hidden />Invited {formatDate(i.created_at)} by {i.client.name}</p>
          </div>
          <LinkButton variant="secondary" to={base + '/' + encodeURIComponent(i.id) + (params.toString() ? '?' + params.toString() : '')} iconRight={<ChevronRight className="size-4" aria-hidden />}>View Details</LinkButton>
        </div>
      </article>)}
    </div>
  </div>
}
