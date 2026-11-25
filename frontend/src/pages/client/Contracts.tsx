import { Link } from 'react-router-dom'
import { ChevronRight, FileText } from 'lucide-react'
import { useStore } from '../../services/store'
import { formatDate, formatSim } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { ContractStatusBadge } from '../../components/ui/Badge'
import { EmptyState, PageHeader } from '../../components/ui/Display'
import { PersonAvatar } from '../../components/ui/Identity'
import { LinkButton } from '../../components/ui/Button'

export default function Contracts() {
  usePageTitle('Contracts')
  const store = useStore()

  return (
    <div>
      <PageHeader title="Contracts" subtitle="Drafts, agreements waiting on approval or funding, and active contracts." />
      {store.contracts.length === 0 ? (
        <EmptyState icon={<FileText className="size-6" />} title="No contracts yet" body="A contract is drafted after a freelancer accepts your invitation." action={<LinkButton to="/client/talent">Find freelancers</LinkButton>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_140px_160px_24px] gap-4 border-b border-line bg-canvas/60 px-5 py-3 text-caption font-semibold uppercase tracking-wide text-ink-muted md:grid">
            <span>Project</span>
            <span>Freelancer</span>
            <span className="text-right">Value</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="stagger divide-y divide-line">
            {store.contracts.map((c) => {
              const p = store.getProject(c.projectId)
              const f = store.getCandidate(c.projectId, c.candidateId)
              const to =
                c.status === 'awaiting_funding' ? `/client/projects/${c.projectId}/fund` : c.status === 'active' || c.status === 'closed' ? `/client/projects/${c.projectId}` : `/client/projects/${c.projectId}/contract`
              return (
                <li key={c.id}>
                  <Link to={to} className="group grid items-center gap-3 px-5 py-4 transition-colors hover:bg-brand-soft/30 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_140px_160px_24px] md:gap-4">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{p?.title}</span>
                      <span className="block text-caption text-ink-muted">
                        {c.id} · v{c.version}
                        {c.startedAt && ` · started ${formatDate(c.startedAt)}`}
                      </span>
                    </span>
                    {f && (
                      <span className="flex min-w-0 items-center gap-2.5">
                        <PersonAvatar initials={f.identity.initials} size={32} />
                        <span className="truncate text-small">{f.identity.name}</span>
                      </span>
                    )}
                    <span className="tabular text-small font-semibold md:text-right">{formatSim(c.milestones.reduce((n, m) => n + m.amount, 0))}</span>
                    <span>
                      <ContractStatusBadge status={c.status} />
                    </span>
                    <ChevronRight className="hidden size-5 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 md:block" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
