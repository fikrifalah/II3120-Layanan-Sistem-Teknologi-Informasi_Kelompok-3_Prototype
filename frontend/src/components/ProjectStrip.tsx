import { CalendarDays, Info, Wallet } from 'lucide-react'
import type { Project } from '../types/domain'
import { daysBetween, formatIdr } from '../lib/format'
import { SkillChip } from './ui/Badge'
import { ProjectIcon } from './ProjectRow'

/** Board 03B project summary bar: title, category, budget, duration, required and preferred skills. */
export function ProjectStrip({ project }: { project: Project }) {
  return (
    <div className="card grid gap-4 p-4 md:grid-cols-[minmax(0,1.4fr)_auto_auto] md:items-center xl:grid-cols-[minmax(0,1.3fr)_auto_auto_minmax(0,1.2fr)] xl:gap-6">
      <div className="flex min-w-0 items-center gap-3.5">
        <ProjectIcon category={project.category} />
        <div className="min-w-0">
          <p className="truncate text-body font-semibold text-ink">{project.title}</p>
          <span className="mt-1 inline-flex h-6 items-center rounded-full bg-accent-soft px-2.5 text-caption font-semibold text-accent-strong">{project.category}</span>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <Wallet className="size-5 text-accent" aria-hidden />
        <div>
          <p className="text-caption text-ink-muted">Budget{project.budgetFlexible ? ' · flexible' : ''}</p>
          <p className="tabular text-small font-semibold">{formatIdr(project.budgetIdr)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <CalendarDays className="size-5 text-brand" aria-hidden />
        <div>
          <p className="text-caption text-ink-muted">Duration</p>
          <p className="text-small font-semibold">{daysBetween(project.startDate, project.endDate)} days</p>
        </div>
      </div>
      <div className="min-w-0 md:col-span-3 xl:col-span-1">
        <p className="mb-1.5 text-caption text-ink-muted">Required skills</p>
        <div className="flex flex-wrap gap-1.5">
          {project.requiredSkills.map((s) => (
            <SkillChip key={s}>{s}</SkillChip>
          ))}
          {project.preferredSkills.length > 0 && (
            <span className="inline-flex h-7 items-center gap-1 text-caption text-ink-muted" title={`Preferred: ${project.preferredSkills.join(', ')}`}>
              <Info className="size-3.5" aria-hidden /> +{project.preferredSkills.length} preferred
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
