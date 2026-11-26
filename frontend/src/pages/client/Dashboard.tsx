import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Clock, Coins, FileSignature, FolderOpen, Plus, Sparkles, UserCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../../services/store'
import { formatSim, timeAgo } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/cn'
import { LinkButton } from '../../components/ui/Button'
import { EmptyState, PageHeader, SectionTitle, StatCard } from '../../components/ui/Display'
import { ProjectRow } from '../../components/ProjectRow'

interface ActionItem {
  key: string
  icon: ReactNode
  title: string
  detail: string
  to: string
  cta: string
  tone: 'warning' | 'brand'
}

function greeting() {
  const h = new Date().getHours()
  return h < 11 ? 'Good morning' : h < 15 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  usePageTitle('Dashboard')
  const { user, projects, contracts, invitations, wallet, activity, candidates, getProject } = useStore()

  const active = projects.filter((p) => !['completed', 'cancelled'].includes(p.status))
  const completed = projects.filter((p) => p.status === 'completed').length
  const reviewItems = contracts.flatMap((c) => c.milestones.filter((m) => m.status === 'under_review').map((m) => ({ c, m })))

  const actions: ActionItem[] = [
    ...reviewItems.map<ActionItem>(({ c, m }) => ({
      key: `${c.id}-${m.id}`,
      icon: <AlertTriangle className="size-5" />,
      title: `Review Milestone ${m.seq}`,
      detail: `${getProject(c.projectId)?.title} · submitted work is waiting for your decision`,
      to: `/client/projects/${c.projectId}/milestones/${m.id}/review`,
      cta: 'Review now',
      tone: 'warning',
    })),
    ...contracts
      .filter((c) => c.status === 'awaiting_funding')
      .map<ActionItem>((c) => ({
        key: `fund-${c.id}`,
        icon: <Coins className="size-5" />,
        title: 'Fund escrow to start work',
        detail: `${getProject(c.projectId)?.title} · ${formatSim(c.milestones.reduce((n, m) => n + m.amount, 0))}`,
        to: `/client/projects/${c.projectId}/fund`,
        cta: 'Fund escrow',
        tone: 'warning',
      })),
    ...projects
      .filter((p) => (p.status === 'inviting' || p.status === 'contracting') && !contracts.some((c) => c.projectId === p.id) && invitations.some((i) => i.projectId === p.id && i.status === 'accepted'))
      .map<ActionItem>((p) => ({
        key: `contract-${p.id}`,
        icon: <FileSignature className="size-5" />,
        title: 'Invitation accepted — draft the contract',
        detail: p.title,
        to: `/client/projects/${p.id}/invitations`,
        cta: 'Create contract',
        tone: 'brand',
      })),
    ...projects
      .filter((p) => p.status === 'matching')
      .map<ActionItem>((p) => ({
        key: `match-${p.id}`,
        icon: <Sparkles className="size-5" />,
        title: `${candidates[p.id]?.length ?? 0} anonymous candidates are ready`,
        detail: p.title,
        to: `/client/projects/${p.id}/matches`,
        cta: 'Compare',
        tone: 'brand',
      })),
  ]

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user.firstName}`}
        subtitle="Here is what is moving and what needs you today."
        actions={
          <LinkButton to="/client/projects/new" icon={<Plus className="size-4" aria-hidden />}>
            Create Project
          </LinkButton>
        }
      />

      <section aria-label="Summary" className="stagger grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard icon={<FolderOpen className="size-5" />} label="Active projects" value={active.length} to="/client/projects" />
        <StatCard icon={<Clock className="size-5" />} label="Pending reviews" value={reviewItems.length} tone="accent" />
        <StatCard icon={<Coins className="size-5" />} label="Funds in escrow" value={formatSim(wallet.locked)} tone="accent" to="/client/wallet" />
        <StatCard icon={<CheckCircle2 className="size-5" />} label="Completed" value={completed} tone="success" />
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="action-title">
            <SectionTitle id="action-title">Action required</SectionTitle>
            {actions.length ? (
              <ul className="stagger space-y-2.5">
                {actions.map((a) => (
                  <li key={a.key}>
                    <Link
                      to={a.to}
                      className={cn(
                        'group card-link flex items-center gap-4 px-4 py-3.5',
                      )}
                    >
                      <span className={cn('shrink-0', a.tone === 'warning' ? 'text-accent-strong' : 'text-brand')} aria-hidden>
                        {a.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-small font-semibold text-ink">{a.title}</span>
                        <span className="block truncate text-caption text-ink-muted">{a.detail}</span>
                      </span>
                      <span className="hidden h-9 items-center rounded-sm border border-line px-3.5 text-small font-semibold text-ink transition-colors group-hover:border-brand group-hover:text-brand sm:inline-flex">
                        {a.cta}
                      </span>
                      <ChevronRight className="size-5 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 sm:hidden" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card px-5 py-4 text-small text-ink-muted">Nothing needs you right now.</p>
            )}
          </section>

          <section aria-labelledby="projects-title">
            <SectionTitle
              id="projects-title"
              action={
                <Link to="/client/projects" className="link inline-flex items-center gap-1 text-small">
                  View all projects <ArrowRight className="size-4" aria-hidden />
                </Link>
              }
            >
              Recent & active projects
            </SectionTitle>
            {active.length ? (
              <div className="stagger space-y-3">
                {active.slice(0, 4).map((p) => (
                  <ProjectRow key={p.id} project={p} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FolderOpen className="size-6" />}
                title="No projects yet"
                body="Describe the work you need. Gigly ranks anonymous freelancers against it, and you choose who to invite."
                action={<LinkButton to="/client/projects/new">Create your first project</LinkButton>}
              />
            )}
          </section>
        </div>

        <aside aria-labelledby="activity-title" className="min-w-0">
          <SectionTitle id="activity-title">Recent activity</SectionTitle>
          <ol className="stagger card divide-y divide-line">
            {activity.slice(0, 7).map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-3.5">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full',
                    { brand: 'bg-brand-soft text-brand', success: 'bg-success-soft text-success', warning: 'bg-accent-soft text-accent-strong', danger: 'bg-danger-soft text-danger', neutral: 'bg-canvas text-ink-muted' }[a.tone],
                  )}
                  aria-hidden
                >
                  {a.tone === 'success' ? <UserCheck className="size-3.5" /> : a.tone === 'warning' ? <Clock className="size-3.5" /> : a.tone === 'brand' ? <Sparkles className="size-3.5" /> : <Coins className="size-3.5" />}
                </span>
                <div className="min-w-0 text-small">
                  <p className="text-ink">{a.text}</p>
                  <p className="text-caption text-ink-muted">{timeAgo(a.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  )
}
