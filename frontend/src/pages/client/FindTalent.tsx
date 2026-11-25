import { Link } from 'react-router-dom'
import { ArrowRight, EyeOff, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../../services/store'
import { usePageTitle } from '../../lib/usePageTitle'
import { LinkButton } from '../../components/ui/Button'
import { ProjectStatusBadge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/Display'
import { AnonAvatar } from '../../components/ui/Identity'
import { ProjectIcon } from '../../components/ProjectRow'

/** Master Plan §6.7: Find Freelancers starts from a project; there is no open directory in the MVP. */
export default function FindTalent() {
  usePageTitle('Find freelancers')
  const { projects, candidates } = useStore()
  const open = projects.filter((p) => ['draft', 'matching', 'inviting', 'contracting'].includes(p.status))

  return (
    <div>
      <PageHeader title="Find freelancers" subtitle="Matching runs per project, so every candidate is ranked against real requirements." />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-line bg-surface p-5">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          <EyeOff className="size-5" aria-hidden />
        </span>
        <div className="text-small">
          <p className="font-semibold text-ink">You choose on evidence, not on names</p>
          <p className="text-ink-muted">Candidates appear without name, photo or location. You compare skills, portfolio and estimates, invite the ones you like, and see who they are once they accept.</p>
        </div>
      </div>

      <div className="stagger grid gap-4 md:grid-cols-2">
        {open.map((p) => {
          const list = candidates[p.id] ?? []
          return (
            <Link key={p.id} to={`/client/projects/${p.id}/matches`} className="card-link group flex flex-col p-5">
              <div className="flex items-start gap-3.5">
                <ProjectIcon category={p.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{p.title}</p>
                  <div className="mt-1">
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                {list.length ? (
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {list.slice(0, 4).map((c) => (
                        <AnonAvatar key={c.id} seed={c.id} size={32} className="ring-2 ring-surface" />
                      ))}
                    </div>
                    <span className="ml-3 text-small text-ink-muted">{list.length} ranked</span>
                  </div>
                ) : (
                  <span className="text-small text-ink-muted">Not matched yet</span>
                )}
                <span className="inline-flex items-center gap-1 text-small font-semibold text-brand">
                  {list.length ? 'Compare' : 'Run matching'}
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
          )
        })}
        <Link to="/client/projects/new" className="group flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line p-5 text-center transition-colors hover:border-brand/50 hover:bg-brand-soft/30">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-200 group-hover:scale-105">
            <Plus className="size-5" aria-hidden />
          </span>
          <span className="font-semibold text-ink">New project</span>
          <span className="text-small text-ink-muted">Describe the work to get a ranked shortlist</span>
        </Link>
      </div>

      {open.length === 0 && (
        <div className="mt-6 text-center">
          <LinkButton to="/client/projects/new" icon={<Sparkles className="size-4" aria-hidden />}>
            Create a project to start matching
          </LinkButton>
        </div>
      )}
    </div>
  )
}
