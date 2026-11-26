import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, CalendarDays, Coins, Info, Layers, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import { useStore } from '../../services/store'
import { contractsApiEnabled } from '../../services/clientContracts'
import { formatSim } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import type { Contract, Milestone } from '../../types/domain'
import { Button, IconButton, LinkButton } from '../../components/ui/Button'
import { ContractStatusBadge } from '../../components/ui/Badge'
import { Breadcrumb, CardTitle, PageHeader } from '../../components/ui/Display'
import { Alert, useToast } from '../../components/ui/Feedback'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import { PersonAvatar } from '../../components/ui/Identity'
import { ProjectIcon } from '../../components/ProjectRow'

const toLines = (xs: string[]) => xs.join('\n')
const fromLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

interface MilestoneDraft extends Omit<Milestone, 'deliverables' | 'criteria'> {
  deliverablesText: string
  criteriaText: string
}

const toDraft = (m: Milestone): MilestoneDraft => ({ ...m, deliverablesText: toLines(m.deliverables), criteriaText: toLines(m.criteria.map((c) => c.text)) })
const fromDraft = (m: MilestoneDraft, i: number): Milestone => {
  const { deliverablesText, criteriaText, ...rest } = m
  return { ...rest, seq: i + 1, id: `M${i + 1}`, deliverables: fromLines(deliverablesText), criteria: fromLines(criteriaText).map((t, j) => ({ id: `c${j}`, text: t })) }
}

function validate(scope: string, duration: number, ms: MilestoneDraft[]): string[] {
  const e: string[] = []
  if (scope.trim().length < 30) e.push('Describe the scope of work in at least 30 characters.')
  if (!ms.length) e.push('Add at least one milestone.')
  ms.forEach((m, i) => {
    const n = i + 1
    if (!m.title.trim()) e.push(`Milestone ${n} needs a title.`)
    if (!(m.amount > 0)) e.push(`Milestone ${n} needs an amount above zero.`)
    if (!fromLines(m.criteriaText).length) e.push(`Milestone ${n} needs at least one acceptance criterion.`)
    if (m.dueDay < 1 || m.dueDay > duration) e.push(`Milestone ${n} must be due between day 1 and day ${duration}.`)
    if (i > 0 && m.dueDay <= ms[i - 1].dueDay) e.push(`Milestone ${n} must be due after milestone ${i}.`)
  })
  return e
}

export default function ContractBuilder() {
  const { projectId = '' } = useParams()
  const store = useStore()
  const toast = useToast()
  const project = store.getProject(projectId)
  const contract = store.contracts.find((c) => c.projectId === projectId)
  usePageTitle('Contract')

  const [scope, setScope] = useState(contract?.scope ?? '')
  const [duration, setDuration] = useState(contract?.durationDays ?? 30)
  const [reviewDays, setReviewDays] = useState(contract?.reviewDays ?? 5)
  const [arbiter, setArbiter] = useState(contract?.arbiter ?? 'Gigly Arbitration Panel')
  const [ms, setMs] = useState<MilestoneDraft[]>(contract?.milestones.map(toDraft) ?? [])
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (contract) setMs(contract.milestones.map(toDraft))
    // reload when the contract version changes (e.g. after approval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id, contract?.status])

  if (!project) return <Navigate to="/client/projects" replace />
  if (!contract) return <Navigate to={`/client/projects/${projectId}/invitations`} replace />

  const c = store.getCandidate(projectId, contract.candidateId)
  const editable = contract.status === 'draft'
  const total = ms.reduce((n, m) => n + (Number(m.amount) || 0), 0)

  const build = (): Contract => ({ ...contract, scope, durationDays: duration, reviewDays, arbiter, milestones: ms.map(fromDraft) })
  const patch = (i: number, p: Partial<MilestoneDraft>) => setMs((xs) => xs.map((m, j) => (j === i ? { ...m, ...p } : m)))
  const move = (i: number, d: -1 | 1) =>
    setMs((xs) => {
      const ys = [...xs]
      ;[ys[i], ys[i + d]] = [ys[i + d], ys[i]]
      return ys
    })
  const add = () =>
    setMs((xs) => [
      ...xs,
      { id: `M${xs.length + 1}`, seq: xs.length + 1, title: '', description: '', deliverablesText: '', criteriaText: '', amount: 0, dueDay: Math.min(duration, (xs.at(-1)?.dueDay ?? 0) + 7), status: 'pending', submissions: [] },
    ])

  const save = () => {
    store.saveContract(build())
    toast({ tone: 'success', title: 'Draft saved' })
  }

  const send = async () => {
    const e = validate(scope, duration, ms)
    setErrors(e)
    if (e.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    store.saveContract(build())
    try {
      await store.sendContractForApproval(contract.id)
    } catch (err) {
      toast({ tone: 'danger', title: err instanceof Error ? err.message : 'Unable to send the contract.' })
      return
    }
    toast(contractsApiEnabled
      ? { tone: 'success', title: 'Contract recorded', body: 'Fund the escrow to start the work.' }
      : { tone: 'info', title: 'Sent for approval', body: `${c?.identity.name ?? 'The freelancer'} will review version ${contract.version}.` })
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Contracts', to: '/client/contracts' }, { label: project.title, to: `/client/projects/${projectId}` }, { label: editable ? 'Create contract' : 'Contract' }]} />
      <PageHeader
        title={editable ? 'Create contract' : 'Contract'}
        subtitle={`Set the scope, milestones and terms for ${project.title}${c ? ` with ${c.identity.name}` : ''}.`}
        actions={<ContractStatusBadge status={contract.status} />}
      />

      {contract.status === 'pending_approval' && (
        <Alert tone="info" title={`Waiting for ${c?.identity.name ?? 'the freelancer'} to approve version ${contract.version}`} className="mb-5" action={<Loader2 className="size-5 animate-spin text-info" aria-hidden />}>
          The contract is locked while they review it. If they request changes you can edit and send a new version.
        </Alert>
      )}
      {contract.status === 'awaiting_funding' && (
        <Alert tone="success" title="Both parties approved this version" className="mb-5" action={<LinkButton to={`/client/projects/${projectId}/fund`} size="sm">Fund escrow</LinkButton>}>
          Lock the full contract value in escrow to start the work.
        </Alert>
      )}
      {errors.length > 0 && (
        <Alert tone="danger" title="Fix these before sending" className="mb-5">
          <ul className="list-disc space-y-0.5 pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="card mb-6 grid gap-4 p-4 sm:grid-cols-2 sm:divide-x sm:divide-line">
        <div className="flex items-center gap-3">
          <ProjectIcon category={project.category} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{project.title}</p>
            <p className="text-caption text-ink-muted">Project {project.id}</p>
          </div>
        </div>
        {c && (
          <div className="flex items-center gap-3 sm:pl-4">
            <PersonAvatar initials={c.identity.initials} size={48} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{c.identity.name}</p>
              <p className="text-caption text-ink-muted">{c.identity.role} · match {c.score}/100</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 md:p-6">
            <CardTitle>General agreement</CardTitle>
            <fieldset disabled={!editable} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Project duration" required>
                  {(p) => <Input id={p.id} type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} suffix="days" />}
                </Field>
                <Field label="Review period" required hint="Payment releases automatically if you take no action.">
                  {(p) => (
                    <Select id={p.id} aria-describedby={p.describedBy} value={reviewDays} onChange={(e) => setReviewDays(Number(e.target.value))}>
                      {[3, 5, 7].map((d) => (
                        <option key={d} value={d}>
                          {d} days
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Designated arbiter" required>
                  {(p) => (
                    <Select id={p.id} value={arbiter} onChange={(e) => setArbiter(e.target.value)}>
                      <option>Gigly Arbitration Panel</option>
                      <option>Independent arbiter (assigned)</option>
                    </Select>
                  )}
                </Field>
              </div>
              <Field label="Scope of work" required hint="What is in — and what is not.">
                {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} rows={4} value={scope} onChange={(e) => setScope(e.target.value)} />}
              </Field>
            </fieldset>
          </section>

          <section className="card p-5 md:p-6">
            <CardTitle
              action={
                editable && (
                  <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={add}>
                    Add milestone
                  </Button>
                )
              }
            >
              Milestones ({ms.length})
            </CardTitle>
            <ol className="space-y-4">
              {ms.map((m, i) => (
                <li key={i} className="rounded-md border border-line p-4">
                  <fieldset disabled={!editable}>
                    <legend className="sr-only">Milestone {i + 1}</legend>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="inline-flex h-6 items-center rounded-full bg-brand-soft px-2.5 text-caption font-semibold text-brand">Milestone {i + 1}</span>
                      {editable && (
                        <div className="ml-auto flex">
                          <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30">
                            <ArrowUp className="size-4" aria-hidden />
                          </IconButton>
                          <IconButton label="Move down" disabled={i === ms.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30">
                            <ArrowDown className="size-4" aria-hidden />
                          </IconButton>
                          <IconButton label={`Remove milestone ${i + 1}`} onClick={() => setMs((xs) => xs.filter((_, j) => j !== i))} className="hover:bg-danger-soft hover:text-danger">
                            <Trash2 className="size-4" aria-hidden />
                          </IconButton>
                        </div>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_170px_130px]">
                      <Field label="Title" required>
                        {(p) => <Input id={p.id} value={m.title} onChange={(e) => patch(i, { title: e.target.value })} placeholder="Architecture & database design" />}
                      </Field>
                      <Field label="Amount" required>
                        {(p) => <Input id={p.id} type="number" min={0} step={500} value={m.amount || ''} onChange={(e) => patch(i, { amount: Number(e.target.value) })} suffix="SIM" />}
                      </Field>
                      <Field label="Due" required>
                        {(p) => <Input id={p.id} type="number" min={1} value={m.dueDay} onChange={(e) => patch(i, { dueDay: Number(e.target.value) })} suffix="day" />}
                      </Field>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Deliverables" hint="One per line.">
                        {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} rows={4} value={m.deliverablesText} onChange={(e) => patch(i, { deliverablesText: e.target.value })} />}
                      </Field>
                      <Field label="Acceptance criteria" required hint="Checkable statements — you will tick these when reviewing.">
                        {(p) => <Textarea id={p.id} aria-describedby={p.describedBy} rows={4} value={m.criteriaText} onChange={(e) => patch(i, { criteriaText: e.target.value })} placeholder="OpenAPI documents every agreed endpoint" />}
                      </Field>
                    </div>
                  </fieldset>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside>
          <section className="card p-5 xl:sticky xl:top-24">
            <CardTitle>Contract summary</CardTitle>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 rounded-md bg-accent-soft p-3.5">
                <Coins className="size-6 text-accent-strong" aria-hidden />
                <div>
                  <p className="text-caption text-ink-muted">Total contract value</p>
                  <p className="tabular text-h2">{formatSim(total)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md bg-brand-soft/60 p-3.5">
                <Layers className="size-5 text-brand" aria-hidden />
                <div>
                  <p className="text-caption text-ink-muted">Milestones</p>
                  <p className="font-semibold">{ms.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md bg-brand-soft/60 p-3.5">
                <CalendarDays className="size-5 text-brand" aria-hidden />
                <div>
                  <p className="text-caption text-ink-muted">Review period</p>
                  <p className="font-semibold">{reviewDays} days</p>
                </div>
              </div>
            </div>
            <p className="mt-4 flex gap-2 text-small text-ink-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              Funds are locked only after both of you approve the same version. Version {contract.version}.
            </p>
            {editable && (
              <div className="mt-5 flex flex-col gap-2">
                <Button variant="secondary" block onClick={save}>
                  Save draft
                </Button>
                <Button block icon={<Send className="size-4" aria-hidden />} onClick={send}>
                  Send for approval
                </Button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
