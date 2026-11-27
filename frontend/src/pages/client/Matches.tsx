import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, EyeOff, Loader2, RefreshCw, SearchX, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useStore } from '../../services/store'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/cn'
import type { Candidate } from '../../types/domain'
import { Button, LinkButton } from '../../components/ui/Button'
import { Breadcrumb, EmptyState, PageHeader } from '../../components/ui/Display'
import { Alert } from '../../components/ui/Feedback'
import { Select } from '../../components/ui/Field'
import { ProjectStrip } from '../../components/ProjectStrip'
import { CandidateCard } from '../../components/CandidateCard'

const PIPELINE = [
  'Reading your confirmed requirements',
  'Removing names, photos and locations from profiles',
  'Filtering on mandatory skills',
  'Comparing skills, experience and portfolio',
  'Writing the reasons behind each rank',
]

function MatchingProgress() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(PIPELINE.length - 1, s + 1)), 520)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="card overflow-hidden" role="status" aria-live="polite">
      <div className="relative h-1 overflow-hidden bg-brand-soft">
        <div className="absolute inset-y-0 w-1/3 animate-scan rounded-full bg-brand" />
      </div>
      <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-8">
        <div>
          <p className="flex items-center gap-2 text-h2 text-ink">
            <Sparkles className="size-5 text-accent" aria-hidden /> Ranking freelancers
          </p>
          <p className="mt-2 text-small text-ink-muted">Candidates are scored without their identity. You will see why each one ranks where they do.</p>
          <ol className="mt-6 space-y-3">
            {PIPELINE.map((p, i) => (
              <li key={p} className={cn('flex items-center gap-3 text-small transition-colors duration-300', i <= step ? 'text-ink' : 'text-ink-muted/60')}>
                <span className={cn('inline-flex size-6 items-center justify-center rounded-full', i < step ? 'bg-success text-white' : i === step ? 'bg-brand-soft text-brand' : 'bg-canvas')}>
                  {i < step ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i === step ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-md border border-line p-4" style={{ opacity: 1 - i * 0.25 }}>
              <div className="skeleton size-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-2/5" />
                <div className="skeleton h-3 w-3/5" />
                <div className="flex gap-1.5 pt-1">
                  <div className="skeleton h-6 w-16 rounded-full" />
                  <div className="skeleton h-6 w-20 rounded-full" />
                </div>
              </div>
              <div className="skeleton size-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type Sort = 'best' | 'estimate' | 'experience'

export default function Matches() {
  const { projectId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const project = store.getProject(projectId)
  usePageTitle(project ? `Matches · ${project.title}` : 'Matches')
  const candidates = store.candidates[projectId]
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState(false)
  const [skillFilter, setSkillFilter] = useState<string[]>([])
  const [availNow, setAvailNow] = useState(false)
  const [withinBudget, setWithinBudget] = useState(false)
  const [sort, setSort] = useState<Sort>('best')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const started = useRef(false)

  const run = async () => {
    setRunning(true)
    setFailed(false)
    try {
      await store.runMatching(projectId)
    } catch {
      setFailed(true)
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (started.current || !project) return
    if (params.get('run') === '1' || (!candidates && project.status === 'draft')) {
      started.current = true
      setParams({}, { replace: true })
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  const visible = useMemo(() => {
    const list = (candidates ?? []).filter(
      (c) =>
        skillFilter.every((s) => c.matchedSkills.includes(s)) &&
        (!availNow || c.availableNow) &&
        (!withinBudget || (project && c.estimateIdr <= project.budgetIdr)),
    )
    const by: Record<Sort, (a: Candidate, b: Candidate) => number> = {
      best: (a, b) => a.rank - b.rank,
      estimate: (a, b) => a.estimateIdr - b.estimateIdr,
      experience: (a, b) => b.experienceYears - a.experienceYears,
    }
    return [...list].sort(by[sort])
  }, [candidates, skillFilter, availNow, withinBudget, sort, project])

  if (!project) return <Navigate to="/client/projects" replace />

  const eligible = visible.filter((c) => c.eligible)
  const near = visible.filter((c) => !c.eligible)
  const hidden = (candidates?.length ?? 0) - visible.length
  const invitationFor = (cid: string) => store.invitations.find((i) => i.projectId === projectId && i.candidateId === cid && i.status !== 'cancelled')
  const anyInvited = store.invitations.some((i) => i.projectId === projectId)

  const resetFilters = () => {
    setSkillFilter([])
    setAvailNow(false)
    setWithinBudget(false)
  }

  const filters = (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-1 text-small font-semibold text-ink">Has required skill</legend>
        {project.requiredSkills.map((s) => {
          const count = (candidates ?? []).filter((c) => c.matchedSkills.includes(s)).length
          return (
            <label key={s} className="flex min-h-10 cursor-pointer items-center gap-3 text-small">
              <input type="checkbox" className="size-[18px] accent-brand" checked={skillFilter.includes(s)} onChange={(e) => setSkillFilter((f) => (e.target.checked ? [...f, s] : f.filter((x) => x !== s)))} />
              <span className="flex-1">{s}</span>
              <span className="tabular text-caption text-ink-muted">{count}</span>
            </label>
          )
        })}
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-small font-semibold text-ink">Fit</legend>
        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-small">
          <input type="checkbox" className="size-[18px] accent-brand" checked={availNow} onChange={(e) => setAvailNow(e.target.checked)} />
          Available now
        </label>
        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-small">
          <input type="checkbox" className="size-[18px] accent-brand" checked={withinBudget} onChange={(e) => setWithinBudget(e.target.checked)} />
          Estimate within budget
        </label>
      </fieldset>
      <div className="rounded-md bg-canvas p-3 text-caption text-ink-muted">Filters narrow the list; they never change a candidate’s score or the reasons shown.</div>
    </div>
  )

  return (
    <div>
      <Breadcrumb items={[{ label: 'My Projects', to: '/client/projects' }, { label: project.title, to: `/client/projects/${project.id}` }, { label: 'AI matches' }]} />
      <PageHeader
        title="AI matching results"
        subtitle="Anonymous freelancers ranked for this project on skills, experience and relevant work."
        actions={
          <>
            {anyInvited && (
              <LinkButton to={`/client/projects/${projectId}/invitations`} variant="secondary">
                View invitations
              </LinkButton>
            )}
            <Button variant="quiet" icon={<RefreshCw className={cn('size-4', running && 'animate-spin')} aria-hidden />} onClick={run} disabled={running}>
              Rerun matching
            </Button>
          </>
        }
      />

      <ProjectStrip project={project} />

      <div className="mt-4">
        <Alert tone="brand" title="Identities stay hidden while you choose">
          Names, photos, locations and contact details are removed before ranking. You see the evidence; a freelancer’s identity appears only when they accept your invitation.
        </Alert>
      </div>

      <div className="mt-6">
        {running ? (
          <MatchingProgress />
        ) : failed ? (
          <Alert tone="danger" title="Matching could not finish" action={<Button size="sm" variant="danger" onClick={run}>Try again</Button>}>
            The matching service did not respond. Your project is saved.
          </Alert>
        ) : !candidates ? (
          <EmptyState icon={<Sparkles className="size-6" />} title="Matching has not run yet" body="Run matching to rank anonymous freelancers against this project’s requirements." action={<Button onClick={run}>Run AI matching</Button>} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="card sticky top-24 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-h3">Filter candidates</p>
                  <button type="button" onClick={resetFilters} className="link text-small">
                    Reset
                  </button>
                </div>
                {filters}
              </div>
            </aside>

            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <p className="text-h3 text-ink">
                  {eligible.length} eligible {eligible.length === 1 ? 'candidate' : 'candidates'}
                  {near.length > 0 && <span className="font-normal text-ink-muted"> · {near.length} near-match</span>}
                </p>
                <Button variant="quiet" size="sm" className="lg:hidden" icon={<SlidersHorizontal className="size-4" aria-hidden />} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
                  Filters
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <label htmlFor="sort" className="text-small text-ink-muted">
                    Sort by
                  </label>
                  <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 w-40">
                    <option value="best">Best match</option>
                    <option value="estimate">Lowest estimate</option>
                    <option value="experience">Most experience</option>
                  </Select>
                </div>
              </div>

              {filtersOpen && <div className="card mb-4 p-5 lg:hidden">{filters}</div>}

              {visible.length === 0 ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No candidates match these filters"
                  body={`${hidden} ranked ${hidden === 1 ? 'candidate is' : 'candidates are'} hidden by your filters.`}
                  action={<Button variant="secondary" onClick={resetFilters}>Clear filters</Button>}
                />
              ) : (
                <div className="stagger space-y-4">
                  {eligible.map((c) => (
                    <CandidateCard key={c.id} c={c} invitation={invitationFor(c.id)} projectTitle={project.title} />
                  ))}

                  {near.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 pt-4">
                        <EyeOff className="size-4 text-ink-muted" aria-hidden />
                        <h2 className="text-h3 text-ink">Near-matches</h2>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                      <p className="-mt-2 text-small text-ink-muted">Missing evidence for at least one required skill. Shown so you can judge for yourself — not equally qualified.</p>
                      {near.map((c) => (
                        <CandidateCard key={c.id} c={c} invitation={invitationFor(c.id)} projectTitle={project.title} />
                      ))}
                    </>
                  )}
                  {hidden > 0 && <p className="pt-2 text-center text-small text-ink-muted">{hidden} more hidden by filters.</p>}
                  <p className="pt-2 text-center text-caption text-ink-muted">The score ranks fit for this project only. It is not a guarantee of quality or a hiring decision.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
