import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Activity, ArrowRight, CheckCircle2, ChevronRight, Coins, FileText, Flag, LayoutGrid, ListChecks, Lock, ShieldCheck, Unlock } from 'lucide-react'
import { useStore } from '../../services/store'
import { daysBetween, formatDate, formatDateTime, formatIdr, formatSim, shortHash, timeAgo } from '../../lib/format'
import { nextAction } from '../../lib/nextAction'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/cn'
import type { Contract, Project } from '../../types/domain'
import { Button, LinkButton } from '../../components/ui/Button'
import { Alert } from '../../components/ui/Feedback'
import { Select } from '../../components/ui/Field'
import { ContractStatusBadge, MilestoneStatusBadge, ProjectStatusBadge, SkillChip } from '../../components/ui/Badge'
import { Breadcrumb, CardTitle, KeyValue, Progress, StatCard, Tabs } from '../../components/ui/Display'
import { isSettled, paidAmount } from '../../services/clientContracts'
import { AnonAvatar, PersonAvatar } from '../../components/ui/Identity'
import { ProjectIcon } from '../../components/ProjectRow'
import { CopyButton } from './FundEscrow'

type Tab = 'overview' | 'milestones' | 'contract' | 'activity'

const STAGES = ['Posted', 'Matched', 'Invited', 'Contract', 'Funded']
const stageIndex: Record<Project['status'], number> = { draft: 0, matching: 1, inviting: 2, contracting: 3, funding: 4, active: 5, completed: 5, cancelled: 0 }

function PreContract({ project }: { project: Project }) {
  const store = useStore()
  const action = nextAction(project, store.contracts, store.invitations)
  const at = stageIndex[project.status]
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="card p-5 md:p-6">
        <CardTitle>Project brief</CardTitle>
        <p className="text-small leading-6 text-ink">{project.description}</p>
        <h3 className="mb-2 mt-6 text-small font-semibold">Deliverables</h3>
        <ul className="space-y-1.5 text-small">
          {project.deliverables.map((d) => (
            <li key={d} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> {d}
            </li>
          ))}
        </ul>
        <h3 className="mb-2 mt-6 text-small font-semibold">Skills</h3>
        <div className="flex flex-wrap gap-1.5">
          {project.requiredSkills.map((s) => (
            <SkillChip key={s}>{s}</SkillChip>
          ))}
          {project.preferredSkills.map((s) => (
            <SkillChip key={s} tone="neutral">
              {s} · preferred
            </SkillChip>
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        <section className="card p-5">
          <CardTitle>Where this stands</CardTitle>
          <ol className="space-y-0">
            {STAGES.map((s, i) => (
              <li key={s} className="relative flex items-center gap-3 pb-4 last:pb-0">
                {i < STAGES.length - 1 && <span className={cn('absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5', i < at ? 'bg-brand' : 'bg-line')} aria-hidden />}
                <span className={cn('relative z-10 inline-flex size-6 items-center justify-center rounded-full border-2', i < at ? 'border-brand bg-brand text-white' : i === at ? 'border-brand bg-surface' : 'border-line bg-surface')}>
                  {i < at ? <CheckCircle2 className="size-3.5" aria-hidden /> : i === at ? <span className="size-2 rounded-full bg-brand" /> : null}
                </span>
                <span className={cn('text-small', i === at ? 'font-semibold text-brand' : i < at ? 'text-ink' : 'text-ink-muted')}>{s}</span>
              </li>
            ))}
          </ol>
          {action && (
            <LinkButton to={action.to} block className="mt-5" iconRight={<ArrowRight className="size-4" aria-hidden />}>
              {action.label}
            </LinkButton>
          )}
        </section>
        <section className="card p-5">
          <dl className="divide-y divide-line">
            <KeyValue label="Budget">{formatIdr(project.budgetIdr)}</KeyValue>
            <KeyValue label="Duration">{daysBetween(project.startDate, project.endDate)} days</KeyValue>
            <KeyValue label="Start">{formatDate(project.startDate)}</KeyValue>
            <KeyValue label="Posted">{formatDate(project.createdAt)}</KeyValue>
          </dl>
        </section>
      </aside>
    </div>
  )
}

function MilestoneList({ contract }: { contract: Contract }) {
  return (
    <ol className="stagger space-y-3">
      {contract.milestones.map((m) => {
        const review = m.status === 'under_review'
        const to = `/client/projects/${contract.projectId}/milestones/${m.id}/review`
        const clickable = m.submissions.length > 0
        const body = (
          <>
            <span className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-md', m.status === 'released' ? 'bg-success-soft text-success' : review ? 'bg-accent-soft text-accent-strong' : 'bg-brand-soft text-brand')}>
              {m.status === 'released' ? <CheckCircle2 className="size-5" aria-hidden /> : <Flag className="size-5" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-caption text-ink-muted">Milestone {m.seq} · due day {m.dueDay}</span>
              <span className="block truncate font-semibold text-ink">{m.title}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-2">
                <MilestoneStatusBadge status={m.status} />
                {m.submissions.length > 0 && <span className="text-caption text-ink-muted">{m.submissions.length} submission{m.submissions.length > 1 ? 's' : ''}</span>}
              </span>
            </span>
            <span className="tabular text-right">
              <span className="block text-body font-semibold">{formatSim(m.amount, false)}</span>
              <span className="block text-caption text-ink-muted">SIM-IDR</span>
            </span>
            {clickable && <ChevronRight className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />}
          </>
        )
        return (
          <li key={m.id}>
            {clickable ? (
              <Link to={to} className={cn('card-link group flex items-center gap-4 p-4', review && 'border-accent/50')}>
                {body}
              </Link>
            ) : (
              <div className="card flex items-center gap-4 p-4">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Freelancer menyerah (demo): pilih pengganti dari undangan yang sudah diterima, lalu alihkan milestone tersisa. */
function ReassignPanel({ projectId, contract }: { projectId: string; contract: Contract }) {
  const store = useStore()
  const options = store.invitations.filter(
    (i) => i.projectId === projectId && i.status === 'accepted' && i.backendId && i.candidateId !== contract.candidateId,
  )
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selected = choice || options[0]?.id || ''
  const reassign = async () => {
    setBusy(true)
    setError('')
    try {
      await store.reassignContract(contract.id, selected)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reassign.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Alert tone="danger" title="Freelancer withdrew from this project" className="mb-6">
      <p>Remaining milestones and their escrow funds are on hold. Invite a replacement, then reassign the remaining milestones.</p>
      {options.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={selected} onChange={(e) => setChoice(e.target.value)} className="h-10 max-w-xs" aria-label="Replacement freelancer">
            {options.map((i) => (
              <option key={i.id} value={i.id}>
                {store.displayName(projectId, i.candidateId)}
              </option>
            ))}
          </Select>
          <Button loading={busy} onClick={reassign}>
            Reassign remaining milestones
          </Button>
        </div>
      ) : (
        <LinkButton to={`/client/projects/${projectId}/matches`} size="sm" className="mt-3">
          Invite a replacement
        </LinkButton>
      )}
      {error && (
        <p role="alert" className="mt-2 text-small text-danger">
          {error}
        </p>
      )}
    </Alert>
  )
}

export default function Workspace() {
  const { projectId = '' } = useParams()
  const store = useStore()
  const project = store.getProject(projectId)
  const [tab, setTab] = useState<Tab>('overview')
  usePageTitle(project?.title ?? 'Project')
  if (!project) return <Navigate to="/client/projects" replace />

  const contract = store.getContract(project.contractId)
  const live = contract && (contract.status === 'active' || contract.status === 'closed')
  const hired = project.hiredCandidateId ? store.getCandidate(projectId, project.hiredCandidateId) : undefined
  const revealed = hired && store.isRevealed(projectId, hired.id)
  const action = nextAction(project, store.contracts, store.invitations)

  const header = (
    <>
      <Breadcrumb items={[{ label: 'My Projects', to: '/client/projects' }, { label: project.title }]} />
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <ProjectIcon category={project.category} className="size-14" />
          <div className="min-w-0">
            <h1 className="text-h1 md:text-h1-lg">{project.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-small text-ink-muted">
              <ProjectStatusBadge status={project.status} />
              <span>{project.category}</span>
              {hired && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    {revealed ? <PersonAvatar initials={hired.identity.initials} size={20} /> : <AnonAvatar seed={hired.id} size={20} />}
                    {revealed ? hired.identity.name : `Candidate ${hired.id}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {action && live && action.urgent && (
          <LinkButton to={action.to} className="md:ml-auto" iconRight={<ArrowRight className="size-4" aria-hidden />}>
            {action.label}
          </LinkButton>
        )}
      </header>
    </>
  )

  if (!live || !contract) {
    return (
      <div>
        {header}
        <PreContract project={project} />
      </div>
    )
  }

  const total = contract.milestones.reduce((n, m) => n + m.amount, 0)
  const released = contract.milestones.reduce((n, m) => n + paidAmount(m), 0)
  const remaining = contract.milestones.filter((m) => !isSettled(m)).reduce((n, m) => n + m.amount, 0)
  const paidCount = contract.milestones.filter(isSettled).length
  const activity = store.activity.filter((a) => a.projectId === projectId)
  const txs = store.transactions.filter((t) => t.projectId === projectId)

  return (
    <div>
      {header}
      {contract.withdrawnAt && contract.status === 'active' && <ReassignPanel projectId={projectId} contract={contract} />}

      <section aria-label="Funds" className="stagger mb-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard icon={<Coins className="size-5" />} label="Contract value" value={formatSim(total)} />
        <StatCard icon={<Unlock className="size-5" />} label="Released" value={formatSim(released)} tone="success" />
        <StatCard icon={<Lock className="size-5" />} label="Remaining in escrow" value={formatSim(remaining)} tone="accent" />
        <div className="card p-4">
          <p className="text-small text-ink-muted">Milestones paid</p>
          <p className="tabular text-h2">
            {paidCount} / {contract.milestones.length}
          </p>
          <Progress value={(paidCount / contract.milestones.length) * 100} className="mt-2" tone={contract.status === 'closed' ? 'success' : 'brand'} label="Milestones paid" />
        </div>
      </section>

      <Tabs<Tab>
        label="Project sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: <LayoutGrid className="size-4" aria-hidden /> },
          { id: 'milestones', label: 'Milestones', icon: <ListChecks className="size-4" aria-hidden />, count: contract.milestones.length },
          { id: 'contract', label: 'Contract', icon: <FileText className="size-4" aria-hidden /> },
          { id: 'activity', label: 'Activity', icon: <Activity className="size-4" aria-hidden /> },
        ]}
      />

      <div key={tab} className="animate-fade pt-6">
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-6">
              <section>
                <h2 className="mb-3 text-h3">Milestones</h2>
                <MilestoneList contract={contract} />
              </section>
              <section className="card p-5">
                <CardTitle>Scope</CardTitle>
                <p className="text-small leading-6">{contract.scope}</p>
              </section>
            </div>
            <aside className="space-y-4">
              {hired && (
                <section className="card p-5">
                  <CardTitle>Freelancer</CardTitle>
                  <div className="flex items-center gap-3">
                    <PersonAvatar initials={hired.identity.initials} size={48} />
                    <div>
                      <p className="font-semibold">{hired.identity.name}</p>
                      <p className="text-caption text-ink-muted">
                        {hired.identity.role} · {hired.identity.location}
                      </p>
                    </div>
                  </div>
                  <LinkButton to="/client/messages" variant="secondary" block className="mt-4">
                    Message
                  </LinkButton>
                </section>
              )}
              <section className="card p-5">
                <CardTitle>Recent activity</CardTitle>
                <ol className="space-y-3">
                  {activity.slice(0, 4).map((a) => (
                    <li key={a.id} className="text-small">
                      <p>{a.text}</p>
                      <p className="text-caption text-ink-muted">{timeAgo(a.at)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        )}

        {tab === 'milestones' && <MilestoneList contract={contract} />}

        {tab === 'contract' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <CardTitle action={<ContractStatusBadge status={contract.status} />}>Agreement</CardTitle>
              <dl className="divide-y divide-line">
                <KeyValue label="Contract">{contract.id}</KeyValue>
                <KeyValue label="Version">v{contract.version} · approved by both</KeyValue>
                <KeyValue label="Duration">{contract.durationDays} days</KeyValue>
                <KeyValue label="Review period">{contract.reviewDays} days, then auto-release</KeyValue>
                <KeyValue label="Arbiter">{contract.arbiter}</KeyValue>
                {contract.startedAt && <KeyValue label="Started">{formatDate(contract.startedAt)}</KeyValue>}
              </dl>
            </section>
            <section className="card p-5">
              <CardTitle>On-chain record</CardTitle>
              <div className="mb-3 flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-small font-semibold text-success">
                <ShieldCheck className="size-4" aria-hidden /> Agreement hash matches the approved version
              </div>
              <dl className="divide-y divide-line">
                {contract.documentHash && (
                  <KeyValue label="Agreement hash">
                    <span className="inline-flex items-center font-mono">
                      {shortHash(contract.documentHash)}
                      <CopyButton value={contract.documentHash} label="Agreement hash" />
                    </span>
                  </KeyValue>
                )}
                {contract.escrowAddress && (
                  <KeyValue label="Escrow contract">
                    <span className="inline-flex items-center font-mono">
                      {shortHash(contract.escrowAddress)}
                      <CopyButton value={contract.escrowAddress} label="Escrow address" />
                    </span>
                  </KeyValue>
                )}
                <KeyValue label="Network">{store.wallet.network}</KeyValue>
              </dl>
            </section>
          </div>
        )}

        {tab === 'activity' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <CardTitle>Timeline</CardTitle>
              <ol className="relative space-y-4 border-l-2 border-line pl-5">
                {activity.map((a) => (
                  <li key={a.id} className="relative text-small">
                    <span className={cn('absolute -left-[27px] top-1 size-3 rounded-full border-2 border-surface', { brand: 'bg-brand', success: 'bg-success', warning: 'bg-accent', danger: 'bg-danger', neutral: 'bg-line-control' }[a.tone])} aria-hidden />
                    <p>{a.text}</p>
                    <p className="text-caption text-ink-muted">{formatDateTime(a.at)}</p>
                  </li>
                ))}
              </ol>
            </section>
            <section className="card p-5">
              <CardTitle>Transactions</CardTitle>
              <ul className="divide-y divide-line">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3 text-small">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.label}</span>
                      <span className="block font-mono text-caption text-ink-muted">{shortHash(t.hash)}</span>
                    </span>
                    <span className="tabular font-semibold">{formatSim(t.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
