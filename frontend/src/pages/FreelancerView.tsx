import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import FreelancerProjects, { projectPath, milestonePath } from './FreelancerProjects'
import { useFreelancerWallet, useProjectWork, amount, defaultMilestone, settled, statusLabel } from '../services/projectWork'
import ReceivedInvitations from './ReceivedInvitations'
import { useReceivedInvitations } from '../services/receivedInvitations'
import ProfilePage from './FreelancerProfile'
import type { FreelancerProfile } from '../services/freelancerProfile'
import { Bell, Calendar, CheckCircle2, ChevronDown, ChevronRight, Circle, CircleAlert, CodeXml, Coins, FileText, FolderClosed, Home, Info, LogOut, Mail, Menu, MessageSquare, Settings, UserRound, Wallet } from 'lucide-react'
import { Dialog } from '../components/ui/Feedback'
import { formatDate } from '../lib/format'
import { usePageTitle } from '../lib/usePageTitle'
import './workspace.css'

const navigation = [
  { label: 'Dashboard', icon: Home }, { label: 'Invitations', icon: Mail },
  { label: 'My Projects', icon: FolderClosed }, { label: 'Contracts', icon: FileText },
  { label: 'Messages', icon: MessageSquare }, { label: 'Wallet', icon: Wallet },
  { label: 'Disputes', icon: CircleAlert }, { label: 'My Profile', icon: UserRound },
]
const metrics = [
  { label: 'New Invitations', icon: Mail }, { label: 'Active Projects', icon: FolderClosed },
  { label: 'Pending Payments', icon: Coins }, { label: 'Total Earnings (Confirmed)', icon: Wallet },
]

function CodeTile() { return <span className="code-tile"><CodeXml /></span> }
function Progress({ value, label }: { value: number; label: string }) {
  return <progress max={100} value={value} aria-label={label} />
}

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
  const [menu, setMenu] = useState(false)
  const prefix = 'gigly.freelancer.' + name + '.'
  const [availability, setAvailability] = useState(() => localStorage.getItem(prefix + 'availability') || 'Available within 1 week')
  function open(label: string) {
    setMenu(false)
    if (label === 'My Projects') { setPanel(''); navigate('/freelancer/projects'); return }
    if (label === 'Dashboard' || label === 'My Profile' || label === 'Invitations') {
      setPanel('')
      navigate(label === 'Invitations' ? '/freelancer/invitations' : label === 'Dashboard' ? '/freelancer/dashboard' : '/freelancer/profile')
    } else setPanel(label)
  }
  if (!projectsPage && ((!invitationsPage && invitationId) || (!invitationsPage && !profilePage && section !== 'dashboard'))) return <Navigate to="/freelancer/dashboard" replace />
  const summaries: Record<string, string> = {
    Contracts: work ? work.project.title + ' · ' + amount(work.total) : 'No active contract.',
    Wallet: 'Balance: ' + wallet.balance + '. Confirmed earnings: ' + wallet.earnings + '.',

    Notifications: (incoming ? 'New invitation for ' + incoming.project.title + '. ' : '') + (ms ? ms.title + ' · ' + statusLabel(ms.status) : ''),
    'Project Match': incoming?.match_explanation || 'No match explanation was provided.',
  }
  return <div className="freelance">
    <aside className={'freelance-side' + (menu ? ' mobile-open' : '')}>
      <img src="/brand/gigly-logo.png" alt="Gigly" />
      <nav aria-label="Freelancer workspace">{navigation.map(({ label, icon: Icon }) =>
        <button key={label} aria-current={label === page ? 'page' : undefined} onClick={() => open(label)}
          disabled={label === 'Messages' || label === 'Disputes'}><Icon />{label}{label === 'Messages' && <b className="count">3</b>}</button>)}
        <hr /><button disabled><Settings />Settings</button><button onClick={onLogout}><LogOut />Log out</button>
      </nav>
    </aside>
    <div className="freelance-main">
      <header className="freelance-top">
        <button className="menu-button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Toggle navigation"><Menu /></button>
        {invitationsPage && <input aria-label="Search projects and invitations" className="inv-search" type="search" placeholder="Search projects, invitations…" value={params.get('q') ?? ''} onChange={e => {
          const next = new URLSearchParams(params); next.set('q', e.target.value); navigate('/freelancer/invitations?' + next.toString(), { replace: true })
        }} />}{!invitationsPage && <span className="crumb"><Home /><ChevronRight size={16} />{page}{projectsPage && work && selectedProject && <> <ChevronRight size={16} />{work.project.title}</>}</span>}
        <button className="wallet-pill" onClick={() => open('Wallet')}><Wallet /> Wallet: {wallet.balance}</button>
        <button className="bell" aria-label="Notifications" onClick={() => open('Notifications')}><Bell /></button>
        <button className="account-button" onClick={() => open('Account')} aria-label="Account menu"><img src="/brand/rafi.png" alt="" /><ChevronDown size={16} /></button>
      </header>
      <main className="freelance-content">
        {projectsPage ? <FreelancerProjects key={selectedProject ?? 'list'} data={data} id={selectedProject} mid={milestoneId} token={token} account={account} /> : invitationsPage ? <ReceivedInvitations key={invitationId ?? 'list'} inbox={inbox} id={invitationId} /> : profilePage ? <ProfilePage token={token} onSaved={setSavedProfile} /> : <><div className="welcome"><img src="/brand/rafi.png" alt="" /><div><h1>Welcome back, {(savedProfile?.name ?? name).split(' ')[0]}! 👋</h1><p>Here’s your freelance workspace overview.</p></div>
          <label className="availability"><i />Availability: <select aria-label="Availability" value={availability} onChange={e => {
            setAvailability(e.target.value); localStorage.setItem(prefix + 'availability', e.target.value)
          }}>{['Available within 1 week', 'Available now', 'Unavailable'].map(a => <option key={a}>{a}</option>)}</select></label>
        </div>
        <div className="metrics">{metrics.map(({ label, icon: Icon }) => <div className="metric" key={label}>
          <span className="code-tile"><Icon /></span><div><span>{label}</span><strong>{label === 'New Invitations' ? pending?.length ?? '—' : label === 'Active Projects' ? activeProjects.length : label.startsWith('Total') ? wallet.earnings : wallet.pending}</strong></div>
        </div>)}</div>
        <div className="overview-grid"><div className="work-list">
          <section className="work-section"><h2>Incoming Invitation ({pending?.length ?? '—'})</h2>{incoming ? <div className="work-row">
            <CodeTile /><div className="project-copy"><h3>{incoming.project.title}</h3><p>{incoming.project.description}</p>
              <div className="skill-chips">{incoming.project.required_skills.map(s => <span key={s}>{s}</span>)}</div></div>
            <div className="row-detail"><small>Project Match</small><div className="score-line"><b className="green-pill">{incoming.match_score !== null ? Math.round(incoming.match_score) + ' / 100' : '—'}</b><button aria-label="About project match" onClick={() => open('Project Match')}><Info size={17} /></button></div></div>
            <button className="outline-action" onClick={() => navigate('/freelancer/invitations/' + encodeURIComponent(incoming.id))}>View Details</button>
          </div> : <p>{inbox.error || (pending ? 'No pending invitations.' : 'Loading invitations…')}</p>}</section>
          <section className="work-section"><h2>Active Projects ({activeProjects.length})</h2>{activeProjects.map(p=><div className="work-row" key={p.id}>
            <CodeTile /><div className="project-copy"><h3>{p.title}</h3><p>{p.description}</p></div>
            <div className="row-detail"><b className="green-pill">● In Progress</b>{work?.project.id===p.id && <small>{work.milestones.filter(m=>settled(m.status)).length} / {work.milestones.length} completed</small>}</div>
            <button className="outline-action" onClick={()=>navigate(projectPath(p.id))}>View Project</button>
          </div>)}</section>
        </div><aside className="status-stack">
          <section><div className="status-head"><h3><button onClick={() => open('My Profile')}>Profile Status</button></h3><b className="green-pill">● Published</b></div>
            <p>Your profile is visible and can be matched with relevant projects.</p><div className="status-head"><b>Profile Completeness</b><b>80%</b></div><Progress value={80} label="Profile completeness" /></section>
          <section><div className="status-head"><h3>Match Score (AI)</h3><b className="green-pill">94 / 100</b><Info size={17} aria-hidden /></div>
            <details><summary>How it’s calculated <ChevronDown size={16} /></summary><p>This demo illustrates how skills and experience contribute to a match.</p></details></section>
        </aside></div>
        <section className="action-section"><h2>{ms?.status==='under_review'?'Awaiting Client Review':'Action Required'} <b className="count">{allMilestones?.filter(m=>m.eligible).length ?? Number(!!ms?.eligible)}</b></h2>
          {(data.allDemo ?? (work?[work]:[])).filter(w=>['active','in_progress'].includes(w.project.status)).map(w=>{
            const current=defaultMilestone(w.milestones)
            if(!current)return null
            return <div className="action-row" key={w.contractId}><CodeTile/><div className="project-copy"><h3>{w.project.title}</h3><p>Milestone {current.seq}: {current.title}</p><small className="date"><Calendar/>Due {formatDate(current.due)}</small></div>
              <div className="milestones">{w.milestones.map(m=><div key={m.id}>{settled(m.status)?<CheckCircle2/>:<Circle/>}<span>Milestone {m.seq} – {m.title}</span><b>{amount(m.amount)} <small>({statusLabel(m.status)})</small></b></div>)}</div>
              <button className="primary-action" onClick={()=>navigate(milestonePath(w.project.id,current.id)+(current.eligible?'/submit':''))}>{current.eligible?'Submit Deliverable':'View Milestone'}</button></div>
          })}</section></>}
      </main>
    </div>
    <Dialog title={panel} open={!!panel} onClose={() => setPanel('')}>
      {panel === 'Account' ? <><p>{savedProfile?.name ?? name} · Freelancer</p><button className="outline-action mr-2" onClick={() => open('My Profile')}>My Profile</button><button className="outline-action mt-4" onClick={onLogout}>Log out</button></> :
        <p>{summaries[panel]}</p>}
    </Dialog>
  </div>
}
