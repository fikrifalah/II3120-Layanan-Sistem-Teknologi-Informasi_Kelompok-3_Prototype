import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Calendar, CheckCircle2, ChevronDown, Circle, Coins, FileText, FolderKanban, FolderOpen, Home, Info, LayoutDashboard, Mail, MessageSquare, Scale, Settings, LogOut, UserRound, Wallet } from 'lucide-react'
import AppShell, { AccountMenu, NotificationsMenu, WalletChip, initialsOf, type NavItem } from '../layouts/AppShell'
import FreelancerProjects, { projectPath, milestonePath, WorkStatusBadge } from './FreelancerProjects'
import { useFreelancerWallet, useProjectWork, amount, defaultMilestone, settled, statusLabel } from '../services/projectWork'
import ReceivedInvitations from './ReceivedInvitations'
import { useReceivedInvitations } from '../services/receivedInvitations'
import ProfilePage from './FreelancerProfile'
import type { FreelancerProfile } from '../services/freelancerProfile'
import { Badge, SkillChip } from '../components/ui/Badge'
import { Button, LinkButton } from '../components/ui/Button'
import { CardTitle, PageHeader, Progress, SectionTitle, StatCard } from '../components/ui/Display'
import { Dialog } from '../components/ui/Feedback'
import { Select } from '../components/ui/Field'
import { ProjectIcon } from '../components/ProjectRow'
import { formatDate, greeting } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'

const availabilityOptions = ['Available within 1 week', 'Available now', 'Unavailable']
const icon = 'size-5'

// Nominal token boleh turun baris di kartu sempit; angka uang tidak boleh terpotong.
const Money = ({ children }: { children: string }) => <span className="flex flex-wrap gap-x-1.5 text-h2 md:text-h1">{children.split(' ').map(part => <span key={part}>{part}</span>)}</span>

export default function FreelancerView({ name, account, token, onLogout }: { name: string; account: string; token: string; onLogout: () => void }) {
  const { section, invitationId, projectId, milestoneId } = useParams()
  const [params] = useSearchParams()
  const invitationsPage = section === 'invitations'
  const inbox = useReceivedInvitations(token, invitationsPage ? invitationId : undefined)
  const pending = inbox.list?.filter(i => i.status === 'pending')
  const incoming = pending?.[0]
  const navigate = useNavigate()
  const profilePage = section === 'profile'
  const projectsPage = section === 'projects' || !!projectId
  const selectedProject = projectId ?? (projectsPage ? invitationId : undefined)
  const data = useProjectWork(token,selectedProject,milestoneId,projectsPage || section === 'dashboard')
  const work = data.work
  const ms = work && defaultMilestone(work.milestones)
  const activeProjects = data.projects?.filter(p => ['active','in_progress'].includes(p.status)) ?? []
  const allMilestones = data.allDemo?.flatMap(w=>w.milestones)
  const wallet=useFreelancerWallet(token)
  const page = projectsPage ? 'My Projects' : invitationsPage ? 'Invitations' : profilePage ? 'My Profile' : 'Dashboard'
  const [savedProfile, setSavedProfile] = useState<FreelancerProfile>()
  usePageTitle(invitationsPage && invitationId ? 'Invitation Detail' : page === 'Dashboard' ? 'Freelancer Dashboard' : page)
  const [panel, setPanel] = useState('')
  const prefix = 'gigly.freelancer.' + name + '.'
  const [availability, setAvailability] = useState(() => localStorage.getItem(prefix + 'availability') || availabilityOptions[0])
  const fullName = savedProfile?.name ?? name
  if (!projectsPage && ((!invitationsPage && invitationId) || (!invitationsPage && !profilePage && section !== 'dashboard'))) return <Navigate to="/freelancer/dashboard" replace />
  const summaries: Record<string, string> = {
    Contracts: work ? work.project.title + ' · ' + amount(work.total) : 'No active contract.',
    Wallet: 'Balance: ' + wallet.balance + '. Confirmed earnings: ' + wallet.earnings + '.',
    'Project Match': incoming?.match_explanation || 'No match explanation was provided.',
  }

  const nav: NavItem[] = [
    { to: '/freelancer/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={icon} /> },
    { to: '/freelancer/invitations', label: 'Invitations', icon: <Mail className={icon} />, badge: pending?.length || undefined, match: () => invitationsPage },
    { to: '/freelancer/projects', label: 'My Projects', icon: <FolderKanban className={icon} />, match: () => projectsPage },
    { label: 'Contracts', icon: <FileText className={icon} />, onClick: () => setPanel('Contracts') },
    { label: 'Messages', icon: <MessageSquare className={icon} />, disabled: true },
    { label: 'Wallet', icon: <Wallet className={icon} />, onClick: () => setPanel('Wallet') },
    { label: 'Disputes', icon: <Scale className={icon} />, disabled: true },
    { to: '/freelancer/profile', label: 'My Profile', icon: <UserRound className={icon} /> },
  ]

  const notices = [
    ...(incoming ? [{ id: 'invitation', title: 'New invitation', body: incoming.project.title, onSelect: () => navigate('/freelancer/invitations/' + encodeURIComponent(incoming.id)) }] : []),
    ...(work && ms ? [{ id: 'milestone', title: ms.title, body: statusLabel(ms.status), onSelect: () => navigate(milestonePath(work.project.id, ms.id)) }] : []),
  ]

  const activeWork = (data.allDemo ?? (work ? [work] : [])).filter(w => ['active','in_progress'].includes(w.project.status))
  const actionCount = allMilestones?.filter(m=>m.eligible).length ?? Number(!!ms?.eligible)

  const dashboard = <div>
    <PageHeader title={`${greeting()}, ${fullName.split(' ')[0]}`} subtitle="Here is your freelance work and what needs you today."
      actions={<label className="flex items-center gap-2.5 text-small text-ink-muted">
        <span className={'size-2 rounded-full ' + (availability === 'Unavailable' ? 'bg-line-control' : 'bg-success')} aria-hidden />
        Availability
        <Select aria-label="Availability" value={availability} onChange={e => {
          setAvailability(e.target.value); localStorage.setItem(prefix + 'availability', e.target.value)
        }}>{availabilityOptions.map(a => <option key={a}>{a}</option>)}</Select>
      </label>} />

    <section aria-label="Summary" className="stagger grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <StatCard icon={<Mail />} label="New invitations" value={pending?.length ?? '—'} to="/freelancer/invitations" />
      <StatCard icon={<FolderOpen />} label="Active projects" value={activeProjects.length} to="/freelancer/projects" />
      <StatCard icon={<Coins />} label="Pending payments" value={<Money>{wallet.pending}</Money>} tone="accent" />
      <StatCard icon={<CheckCircle2 />} label="Confirmed earnings" value={<Money>{wallet.earnings}</Money>} tone="success" />
    </section>

    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-8">
        <section aria-labelledby="action-title">
          <SectionTitle id="action-title" action={actionCount ? <Badge tone="warning">{actionCount} to submit</Badge> : undefined}>
            {ms?.status==='under_review' ? 'Awaiting client review' : 'Action required'}
          </SectionTitle>
          {activeWork.some(w => defaultMilestone(w.milestones)) ? <ul className="stagger space-y-3">{activeWork.map(w => {
            const current = defaultMilestone(w.milestones)
            if (!current) return null
            return <li className="card p-4 md:p-5" key={w.contractId}>
              <div className="flex flex-wrap items-center gap-4">
                <ProjectIcon category={w.project.category} />
                <div className="min-w-0 flex-1 basis-48">
                  <h3 className="truncate text-body font-semibold">{w.project.title}</h3>
                  <p className="text-small text-ink-muted">Milestone {current.seq}: {current.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-caption text-ink-muted"><Calendar className="size-3.5" aria-hidden />Due {formatDate(current.due)}</p>
                </div>
                <Button variant={current.eligible ? 'primary' : 'secondary'} onClick={()=>navigate(milestonePath(w.project.id,current.id)+(current.eligible?'/submit':''))}>{current.eligible?'Submit Deliverable':'View Milestone'}</Button>
              </div>
              <ul className="mt-4 divide-y divide-line border-t border-line">{w.milestones.map(m => <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-small">
                {settled(m.status) ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Circle className="size-4 text-ink-muted" aria-hidden />}
                <span className="min-w-0 flex-1">Milestone {m.seq}: {m.title}</span>
                <span className="tabular font-semibold">{amount(m.amount)}</span>
                <WorkStatusBadge status={m.status} />
              </li>)}</ul>
            </li>
          })}</ul> : <p className="card px-5 py-4 text-small text-ink-muted">Nothing needs you right now.</p>}
        </section>

        <section aria-labelledby="invitation-title">
          <SectionTitle id="invitation-title">Incoming invitation ({pending?.length ?? '—'})</SectionTitle>
          {incoming ? <article className="card p-4 md:p-5">
            <div className="flex flex-wrap items-start gap-4">
              <ProjectIcon category={incoming.project.category} />
              <div className="min-w-0 flex-1 basis-48">
                <h3 className="text-body font-semibold">{incoming.project.title}</h3>
                <p className="line-clamp-2 text-small text-ink-muted">{incoming.project.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{incoming.project.required_skills.map(s => <SkillChip key={s}>{s}</SkillChip>)}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <button type="button" onClick={() => setPanel('Project Match')} aria-label="About project match" className="flex min-h-11 items-center gap-2 rounded-sm text-small text-ink-muted hover:text-brand">
                Project match <Badge tone="success">{incoming.match_score !== null ? Math.round(incoming.match_score) + ' / 100' : '—'}</Badge><Info className="size-4" aria-hidden />
              </button>
              <LinkButton variant="secondary" to={'/freelancer/invitations/' + encodeURIComponent(incoming.id)}>View Details</LinkButton>
            </div>
          </article> : <p className="card px-5 py-4 text-small text-ink-muted">{inbox.error || (pending ? 'No pending invitations.' : 'Loading invitations…')}</p>}
        </section>

        <section aria-labelledby="projects-title">
          <SectionTitle id="projects-title">Active projects ({activeProjects.length})</SectionTitle>
          {activeProjects.length ? <ul className="stagger space-y-3">{activeProjects.map(p => <li className="card flex flex-wrap items-center gap-4 p-4 md:p-5" key={p.id}>
            <ProjectIcon category={p.category} />
            <div className="min-w-0 flex-1 basis-48">
              <h3 className="truncate text-body font-semibold">{p.title}</h3>
              <p className="line-clamp-2 text-small text-ink-muted">{p.description}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                <WorkStatusBadge status={p.status} />
                {work?.project.id===p.id && <span>{work.milestones.filter(m=>settled(m.status)).length} / {work.milestones.length} milestones completed</span>}
              </div>
            </div>
            <LinkButton variant="secondary" to={projectPath(p.id)}>View Project</LinkButton>
          </li>)}</ul> : <p className="card px-5 py-4 text-small text-ink-muted">No active projects yet.</p>}
        </section>
      </div>

      <aside className="min-w-0 space-y-4">
        <section className="card p-5">
          <CardTitle action={<Badge tone="success" dot>Published</Badge>}>
            <button type="button" className="rounded-sm hover:text-brand" onClick={() => navigate('/freelancer/profile')}>Profile status</button>
          </CardTitle>
          <p className="text-small text-ink-muted">Your profile is visible and can be matched with relevant projects.</p>
          <div className="mb-1.5 mt-4 flex justify-between text-caption text-ink-muted"><span>Profile completeness</span><span className="tabular font-semibold text-ink">80%</span></div>
          <Progress value={80} label="Profile completeness" />
        </section>
        <section className="card p-5">
          <CardTitle action={<Badge tone="success">94 / 100</Badge>}>Match score (AI)</CardTitle>
          <details className="group text-small">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-sm font-medium [&::-webkit-details-marker]:hidden">How it’s calculated <ChevronDown className="size-4 text-ink-muted transition-transform duration-200 ease-out group-open:rotate-180" aria-hidden /></summary>
            <p className="text-ink-muted">This demo illustrates how skills and experience contribute to a match.</p>
          </details>
        </section>
      </aside>
    </div>
  </div>

  return <>
    <AppShell
      home="/freelancer/dashboard"
      nav={nav}
      footerNav={[
        { label: 'Settings', icon: <Settings className={icon} />, disabled: true },
        { label: 'Log out', icon: <LogOut className={icon} />, onClick: onLogout },
      ]}
      tabs={[
        { to: '/freelancer/dashboard', label: 'Home', icon: <Home className={icon} /> },
        { to: '/freelancer/invitations', label: 'Invitations', icon: <Mail className={icon} />, match: () => invitationsPage },
        { to: '/freelancer/projects', label: 'Projects', icon: <FolderKanban className={icon} />, match: () => projectsPage },
        { to: '/freelancer/profile', label: 'Profile', icon: <UserRound className={icon} /> },
      ]}
      search={invitationsPage ? { 'aria-label': 'Search projects and invitations', placeholder: 'Search projects, invitations…', value: params.get('q') ?? '', onChange: e => {
        const next = new URLSearchParams(params); next.set('q', e.target.value); navigate('/freelancer/invitations?' + next.toString(), { replace: true })
      } } : undefined}
      // Kunci per halaman, bukan per URL: pindah dari milestone ke /submit tidak me-reset form.
      pageKey={[page, selectedProject, invitationsPage ? invitationId : ''].join('|')}
      tools={<>
        <WalletChip value={wallet.balance} onClick={() => setPanel('Wallet')} />
        <NotificationsMenu items={notices} />
        <AccountMenu initials={initialsOf(fullName)} name={fullName} caption="Freelancer"
          actions={[{ label: 'My Profile', icon: <UserRound className="size-4" />, onClick: () => navigate('/freelancer/profile') }]} onLogout={onLogout} />
      </>}
    >
      {projectsPage ? <FreelancerProjects key={selectedProject ?? 'list'} data={data} id={selectedProject} mid={milestoneId} token={token} account={account} />
        : invitationsPage ? <ReceivedInvitations key={invitationId ?? 'list'} inbox={inbox} id={invitationId} />
        : profilePage ? <ProfilePage token={token} onSaved={setSavedProfile} />
        : dashboard}
    </AppShell>
    <Dialog title={panel} open={!!panel} onClose={() => setPanel('')}><p>{summaries[panel]}</p></Dialog>
  </>
}
