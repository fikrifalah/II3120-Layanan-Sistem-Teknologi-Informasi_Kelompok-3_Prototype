import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Code2, Globe, Layout, Server, Smartphone } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../services/store'
import type { Project } from '../types/domain'
import { formatDate, formatIdr } from '../lib/format'
import { nextAction } from '../lib/nextAction'
import { cn } from '../lib/cn'
import { ProjectStatusBadge } from './ui/Badge'
import { Progress } from './ui/Display'
import { AnonAvatar, PersonAvatar } from './ui/Identity'

const CATEGORY_ICON: Record<string, ReactNode> = {
  'Web Development': <Globe className="size-5" />,
  'Backend & API': <Server className="size-5" />,
  'Mobile App': <Smartphone className="size-5" />,
  'Data & Analytics': <BarChart3 className="size-5" />,
  'UI/UX Design': <Layout className="size-5" />,
}

export const categoryIcon = (c: string) => CATEGORY_ICON[c] ?? <Code2 className="size-5" />

export function ProjectIcon({ category, className }: { category: string; className?: string }) {
  return <span className={cn('inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand', className)}>{categoryIcon(category)}</span>
}

/** Board 03A "Recent & Active Projects" row: title, freelancer, milestones, due date, progress, next action. */
export function ProjectRow({ project }: { project: Project }) {
  const store = useStore()
  const contract = store.getContract(project.contractId)
  const action = nextAction(project, store.contracts, store.invitations)
  const ms = contract?.milestones ?? []
  const paid = ms.filter((m) => m.status === 'released').length
  const pct = project.status === 'completed' ? 100 : ms.length ? (paid / ms.length) * 100 + (ms.some((m) => m.status === 'under_review') ? 100 / ms.length / 2 : 0) : 0
  const hired = project.hiredCandidateId ? store.getCandidate(project.id, project.hiredCandidateId) : undefined
  const revealed = hired && store.isRevealed(project.id, hired.id)
  const candidateCount = store.candidates[project.id]?.length ?? 0

  return (
    <article className="card-link relative p-4 md:p-5">
      <div className="flex items-center gap-4">
        <ProjectIcon category={project.category} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body font-semibold text-ink">
            <Link to={`/client/projects/${project.id}`} className="after:absolute after:inset-0 after:rounded-lg focus-visible:shadow-none">
              {project.title}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
            <span>{project.category}</span>
            <span aria-hidden>·</span>
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
        {action && (
          <Link
            to={action.to}
            className={cn(
              'group/act relative z-10 hidden h-10 shrink-0 items-center justify-center gap-1.5 rounded-sm px-4 text-small font-semibold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] sm:inline-flex',
              action.urgent ? 'bg-brand text-white hover:bg-brand-hover' : 'bg-brand-soft text-brand hover:bg-[#E2DDFB]',
            )}
          >
            {action.label}
            <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover/act:translate-x-0.5" aria-hidden />
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {hired ? (
            <>
              {revealed ? <PersonAvatar initials={hired.identity.initials} size={36} /> : <AnonAvatar seed={hired.id} size={36} />}
              <div className="min-w-0 text-small">
                <p className="truncate font-semibold text-ink">{revealed ? hired.identity.name : `Candidate ${hired.id}`}</p>
                <p className="truncate text-caption text-ink-muted">{revealed ? hired.identity.role : hired.headline}</p>
              </div>
            </>
          ) : (
            <div className="text-small">
              <p className="font-semibold text-ink">{candidateCount ? `${candidateCount} anonymous candidates` : 'No freelancer yet'}</p>
              <p className="text-caption text-ink-muted">Budget {formatIdr(project.budgetIdr)}</p>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between text-caption text-ink-muted">
            <span>{ms.length ? `${paid} of ${ms.length} milestones paid` : `Due ${formatDate(project.endDate)}`}</span>
            <span className="tabular font-semibold text-ink">{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} tone={project.status === 'completed' ? 'success' : 'brand'} label={`${project.title} progress`} />
        </div>
      </div>

      {action && (
        <Link
          to={action.to}
          className={cn(
            'relative z-10 mt-4 flex h-11 items-center justify-center gap-1.5 rounded-sm text-small font-semibold sm:hidden',
            action.urgent ? 'bg-brand text-white' : 'bg-brand-soft text-brand',
          )}
        >
          {action.label}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </article>
  )
}
