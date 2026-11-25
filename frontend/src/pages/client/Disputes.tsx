import { Link } from 'react-router-dom'
import { ChevronRight, Scale } from 'lucide-react'
import { useStore } from '../../services/store'
import { formatSim } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, PageHeader } from '../../components/ui/Display'

export default function Disputes() {
  usePageTitle('Disputes')
  const store = useStore()
  const cases = store.contracts.flatMap((c) => c.milestones.filter((m) => m.status === 'disputed').map((m) => ({ c, m })))

  return (
    <div>
      <PageHeader title="Disputes" subtitle="Milestones where funds are frozen until an arbiter decides." />
      {cases.length === 0 ? (
        <EmptyState icon={<Scale className="size-6" />} title="No disputes" body="If a final submission misses an agreed criterion, you can raise a dispute from the milestone review." />
      ) : (
        <ul className="stagger space-y-3">
          {cases.map(({ c, m }) => (
            <li key={`${c.id}-${m.id}`}>
              <Link to={`/client/projects/${c.projectId}/milestones/${m.id}/review`} className="card-link group flex items-center gap-4 p-4 md:p-5">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
                  <Scale className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    Milestone {m.seq} · {store.getProject(c.projectId)?.title}
                  </span>
                  <span className="block truncate text-small text-ink-muted">{m.disputeReason}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone="danger">In review</Badge>
                    <span className="text-caption text-ink-muted">Assigned to {c.arbiter}</span>
                  </span>
                </span>
                <span className="tabular text-right text-small font-semibold">{formatSim(m.amount)} frozen</span>
                <ChevronRight className="size-5 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
