import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Circle, EyeOff, Info, Pencil, Sparkles, Star, Wallet } from 'lucide-react'
import { useStore, type NewProjectInput } from '../../services/store'
import { CATEGORIES, matchingApiEnabled, suggestSkills } from '../../services/matching'
import { dateInput, daysBetween, formatDate, formatIdr, isoDaysFromNow } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/cn'
import type { ExperienceLevel } from '../../types/domain'
import { Button } from '../../components/ui/Button'
import { Breadcrumb, CardTitle, PageHeader, Stepper } from '../../components/ui/Display'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Alert, useToast } from '../../components/ui/Feedback'
import { SkillInput } from '../../components/SkillInput'

const STEPS = ['Project details', 'Requirements', 'Budget & timeline', 'Review & match']

interface Draft {
  title: string
  category: string
  description: string
  deliverables: string
  links: string
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: ExperienceLevel
  industry: string
  budget: string
  budgetFlexible: boolean
  startDate: string
  endDate: string
}

const EMPTY: Draft = {
  title: '',
  category: '',
  description: '',
  deliverables: '',
  links: '',
  requiredSkills: [],
  preferredSkills: [],
  experienceLevel: 'mid',
  industry: '',
  budget: '',
  budgetFlexible: false,
  startDate: dateInput(isoDaysFromNow(7)),
  endDate: dateInput(isoDaysFromNow(37)),
}

const LEVELS: Array<{ id: ExperienceLevel; label: string; hint: string }> = [
  { id: 'junior', label: 'Entry', hint: '1+ years' },
  { id: 'mid', label: 'Intermediate', hint: '3+ years' },
  { id: 'senior', label: 'Expert', hint: '5+ years' },
]

const lines = (s: string) => s.split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean)

type Errors = Partial<Record<keyof Draft, string>>

function validate(step: number, d: Draft): Errors {
  const e: Errors = {}
  if (step === 0) {
    if (d.title.trim().length < 6) e.title = 'Give the project a title of at least 6 characters.'
    if (!d.category) e.category = 'Pick the category closest to the work.'
    if (d.description.trim().length < 40) e.description = 'Describe the work in at least 40 characters so matching has something to read.'
    if (!lines(d.deliverables).length) e.deliverables = 'List at least one deliverable.'
  }
  if (step === 1 && !d.requiredSkills.length) e.requiredSkills = 'Add at least one required skill.'
  if (step === 2) {
    const n = Number(d.budget.replace(/\D/g, ''))
    if (!n || n < 500_000) e.budget = 'Enter a budget of at least Rp500.000.'
    if (!d.startDate) e.startDate = 'Choose a start date.'
    if (!d.endDate || d.endDate <= d.startDate) e.endDate = 'The end date must be after the start date.'
  }
  return e
}

export default function CreateProject() {
  usePageTitle('Create project')
  const navigate = useNavigate()
  const toast = useToast()
  const { createProject } = useStore()
  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [summaryEdit, setSummaryEdit] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const budgetNum = Number(d.budget.replace(/\D/g, ''))
  const deliverables = lines(d.deliverables)
  const autoSummary = useMemo(
    () =>
      d.description.trim()
        ? `${d.description.trim().replace(/\.$/, '')}. Deliverables: ${deliverables.join('; ')}.`
        : '',
    [d.description, deliverables],
  )
  const [summary, setSummary] = useState('')
  const reviewNotes = [
    !d.industry && 'No industry given — matching will not weigh industry experience.',
    !d.preferredSkills.length && 'No preferred skills — candidates are ranked on required skills only.',
    !lines(d.links).length && 'No reference links. Optional, but they help freelancers judge the scope.',
  ].filter(Boolean) as string[]

  const next = () => {
    const e = validate(step, d)
    setErrors(e)
    if (Object.keys(e).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    if (step === 2 && !summary) setSummary(autoSummary)
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const build = (): NewProjectInput => ({
    title: d.title.trim(),
    category: d.category,
    description: (summary || autoSummary || d.description).trim(),
    deliverables,
    links: lines(d.links),
    requiredSkills: d.requiredSkills,
    preferredSkills: d.preferredSkills,
    experienceLevel: d.experienceLevel,
    industry: d.industry.trim().toLowerCase(),
    budgetIdr: budgetNum,
    budgetFlexible: d.budgetFlexible,
    startDate: new Date(d.startDate).toISOString(),
    endDate: new Date(d.endDate).toISOString(),
  })

  const saveDraft = () => {
    if (d.title.trim().length < 6) {
      setStep(0)
      setErrors({ title: 'A draft needs a title of at least 6 characters.' })
      return
    }
    createProject(build())
    toast({ tone: 'success', title: 'Draft saved', body: 'Find it under My Projects.' })
    navigate('/client/projects')
  }

  const findMatches = () => {
    const id = createProject(build())
    navigate(`/client/projects/${id}/matches?run=1`)
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'My Projects', to: '/client/projects' }, { label: 'Create project' }]} />
      <PageHeader
        title="Create project"
        subtitle="Describe the work. Gigly ranks anonymous freelancers against it, and you decide who to invite."
        actions={<span className="inline-flex h-8 items-center rounded-full bg-brand-soft px-3 text-small font-semibold text-brand">Step {step + 1} of 4</span>}
      />

      <div className="card mb-6 px-4 py-5 md:px-8">
        <Stepper steps={STEPS} current={step} onStep={setStep} />
        <p className="mt-3 text-center text-small font-semibold text-brand sm:hidden">{STEPS[step]}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card overflow-hidden p-5 md:p-7">
          <div key={step} className="animate-rise">
          {step === 0 && (
            <div className="space-y-5">
              <CardTitle>Project details</CardTitle>
              <Field label="Project title" required error={errors.title} hint="A clear, short name freelancers will see first.">
                {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Backend microservices for our ordering app" />}
              </Field>
              <Field label="IT category" required error={errors.category}>
                {(p) => (
                  <Select id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} value={d.category} onChange={(e) => set('category', e.target.value)}>
                    <option value="" disabled>
                      Select a category
                    </option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Project description" required error={errors.description} hint="What you are building, for whom, and what exists already.">
                {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} rows={5} value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="We run an ordering platform for 40 restaurants and need the user and order services split out of the monolith…" />}
              </Field>
              <Field label="Expected deliverables" required error={errors.deliverables} hint="One per line.">
                {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} rows={4} value={d.deliverables} onChange={(e) => set('deliverables', e.target.value)} placeholder={'User and order services\nOpenAPI documentation\nDeployment guide'} />}
              </Field>
              <Field label="Reference links" hint="Optional. Specs, designs or a current site — one per line.">
                {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} rows={2} value={d.links} onChange={(e) => set('links', e.target.value)} placeholder="https://" />}
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <CardTitle>Requirements</CardTitle>
              <Field label="Required skills" required error={errors.requiredSkills} hint="Candidates missing any of these are listed separately as near-matches.">
                {(p) => <SkillInput id={p.id} describedBy={p.describedBy} invalid={p.invalid} value={d.requiredSkills} onChange={(v) => set('requiredSkills', v)} suggestions={suggestSkills(d.category)} exclude={d.preferredSkills} />}
              </Field>
              <Field label="Preferred skills" hint="Nice to have. These raise a candidate's score but never rule anyone out.">
                {(p) => <SkillInput id={p.id} describedBy={p.describedBy} value={d.preferredSkills} onChange={(v) => set('preferredSkills', v)} suggestions={suggestSkills(d.category)} exclude={d.requiredSkills} placeholder="Optional" />}
              </Field>
              <fieldset>
                <legend className="mb-2 text-small font-semibold text-ink">Experience level</legend>
                <div className="grid grid-cols-3 gap-2.5">
                  {LEVELS.map((l) => (
                    <label
                      key={l.id}
                      className={cn(
                        'flex cursor-pointer flex-col rounded-md border px-3 py-3 transition-[border-color,background-color] duration-150 has-[:focus-visible]:shadow-focus',
                        d.experienceLevel === l.id ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand/40',
                      )}
                    >
                      <input type="radio" name="level" className="sr-only" checked={d.experienceLevel === l.id} onChange={() => set('experienceLevel', l.id)} />
                      <span className="text-small font-semibold text-ink">{l.label}</span>
                      <span className="text-caption text-ink-muted">{l.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Relevant industry experience" hint="Optional. For example e-commerce, logistics or health.">
                {(p) => <Input id={p.id} aria-describedby={p.describedBy} value={d.industry} onChange={(e) => set('industry', e.target.value)} placeholder="e-commerce" />}
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <CardTitle>Budget & timeline</CardTitle>
              <Field label="Total project budget" required error={errors.budget} hint={budgetNum ? `${formatIdr(budgetNum)} — locked in escrow later as SIM-IDR, milestone by milestone.` : 'Total in Indonesian Rupiah.'}>
                {(p) => (
                  <Input
                    id={p.id}
                    aria-describedby={p.describedBy}
                    invalid={p.invalid}
                    inputMode="numeric"
                    value={budgetNum ? budgetNum.toLocaleString('id-ID') : d.budget}
                    onChange={(e) => set('budget', e.target.value.replace(/\D/g, ''))}
                    placeholder="15.000.000"
                    suffix="IDR"
                  />
                )}
              </Field>
              <Checkbox checked={d.budgetFlexible} onChange={(v) => set('budgetFlexible', v)} label="Budget is flexible" hint="Candidates up to 20% over budget are not penalised as hard." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Expected start" required error={errors.startDate}>
                  {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="date" value={d.startDate} onChange={(e) => set('startDate', e.target.value)} />}
                </Field>
                <Field label="Expected completion" required error={errors.endDate}>
                  {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid={p.invalid} type="date" value={d.endDate} onChange={(e) => set('endDate', e.target.value)} />}
                </Field>
              </div>
              {d.startDate && d.endDate > d.startDate && (
                <p className="flex items-center gap-2 text-small text-ink-muted">
                  <CalendarDays className="size-4" aria-hidden />
                  {daysBetween(d.startDate, d.endDate)} days of work
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <section className="rounded-md border border-brand/15 bg-brand-soft/40 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-small font-semibold text-ink">
                    <Sparkles className="size-4 text-accent" aria-hidden /> AI requirement summary
                  </h3>
                  <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setSummaryEdit((v) => !v)}>
                    {summaryEdit ? 'Done' : 'Edit'}
                  </Button>
                </div>
                {summaryEdit ? (
                  <Textarea aria-label="Requirement summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
                ) : (
                  <p className="text-small leading-6 text-ink">{summary || autoSummary}</p>
                )}
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-md border border-line p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-small font-semibold">
                    <CheckCircle2 className="size-4 text-success" aria-hidden /> Mandatory
                  </h3>
                  <ul className="space-y-2 text-small">
                    {d.requiredSkills.map((s) => (
                      <li key={s} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {s}
                      </li>
                    ))}
                    {deliverables.map((x) => (
                      <li key={x} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {x}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="rounded-md border border-line p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-small font-semibold">
                    <Star className="size-4 text-accent" aria-hidden /> Preferred
                  </h3>
                  <ul className="space-y-2 text-small">
                    {d.preferredSkills.map((s) => (
                      <li key={s} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {s}
                      </li>
                    ))}
                    <li className="flex gap-2">
                      <Circle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden /> {LEVELS.find((l) => l.id === d.experienceLevel)?.label} level ({LEVELS.find((l) => l.id === d.experienceLevel)?.hint})
                    </li>
                    {d.industry && (
                      <li className="flex gap-2">
                        <Circle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden /> {d.industry} experience
                      </li>
                    )}
                  </ul>
                </section>
              </div>

              {reviewNotes.length > 0 && (
                <Alert tone="warning" title="Review notes">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {reviewNotes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </div>
          )}

          </div>
          <div className="mt-8 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center">
            {step > 0 && (
              <Button variant="quiet" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
              <Button variant="secondary" onClick={saveDraft}>
                Save draft
              </Button>
              {step < 3 ? (
                <Button onClick={next} iconRight={<ArrowRight className="size-4" aria-hidden />}>
                  Next
                </Button>
              ) : (
                <Button onClick={findMatches} icon={<Sparkles className="size-4" aria-hidden />}>
                  Find matching freelancers
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside key={step === 3 ? 'review' : step} className="stagger space-y-4">
          {step === 3 ? (
            <>
              <div className="card divide-y divide-line">
                <div className="flex items-center gap-3 p-4">
                  <Wallet className="size-5 text-brand" aria-hidden />
                  <div>
                    <p className="text-caption text-ink-muted">Project budget</p>
                    <p className="tabular text-h3">{formatIdr(budgetNum)}</p>
                    {d.budgetFlexible && <p className="text-caption text-ink-muted">Flexible</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4">
                  <CalendarDays className="size-5 text-brand" aria-hidden />
                  <div>
                    <p className="text-caption text-ink-muted">Timeline</p>
                    <p className="text-h3">{daysBetween(d.startDate, d.endDate)} days</p>
                    <p className="text-caption text-ink-muted">
                      {formatDate(d.startDate)} – {formatDate(d.endDate)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-line bg-surface p-4">
                <p className="mb-1.5 flex items-center gap-2 text-small font-semibold">
                  <EyeOff className="size-4 text-brand" aria-hidden /> Blind shortlist
                </p>
                <p className="text-small text-ink-muted">You will see skills, evidence and estimates — no names, photos or locations. A freelancer's identity appears only after they accept your invitation.</p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border border-line bg-surface p-4">
                <p className="mb-1.5 flex items-center gap-2 text-small font-semibold">
                  <Info className="size-4 text-brand" aria-hidden /> How matching reads this
                </p>
                <p className="text-small text-ink-muted">
                  {step === 0 && 'The description and deliverables become the requirement summary you confirm in step 4. Nothing is added that you did not write.'}
                  {step === 1 && (matchingApiEnabled
                    ? 'Skills, experience, portfolio and profile are scored against your description; only budget (+20%) and current workload filter candidates. Weights: skills 26%, experience 18%, portfolio 18%, profile 18%, budget 10%, availability 10%.'
                    : 'Required skills filter; preferred skills and industry only change the order. Weights: skills 30%, experience 25%, portfolio 20%, budget 10%, availability 10%, reliability 5%.')}
                  {step === 2 && 'Estimates above your budget lower a candidate’s score but keep them visible, with the gap stated.'}
                </p>
              </div>
              <div className="rounded-md border border-accent/30 bg-accent-soft p-4">
                <p className="mb-1.5 flex items-center gap-2 text-small font-semibold">
                  <AlertTriangle className="size-4 text-accent-strong" aria-hidden /> Milestones come later
                </p>
                <p className="text-small text-ink-muted">You agree milestones with the freelancer you choose, in the contract.</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
