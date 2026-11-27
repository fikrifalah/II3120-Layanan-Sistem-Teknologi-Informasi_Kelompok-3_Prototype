import { useEffect, useRef, useState } from 'react'
import { BriefcaseBusiness, Check, Coins, FolderClosed, Info, Layers, Pencil, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader, Tabs } from '../components/ui/Display'
import { Alert } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Field'
import { PersonAvatar } from '../components/ui/Identity'
import { initialsOf } from '../layouts/AppShell'
import { cn } from '../lib/cn'
import { formatIdr } from '../lib/format'
import { catalog, profileError, requestProfile, skillGroups, type FreelancerProfile, type ProfileFields } from '../services/freelancerProfile'

type Tab = keyof ProfileFields
const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: <FolderClosed /> },
  { id: 'experience', label: 'Experience', icon: <BriefcaseBusiness /> },
  { id: 'skills', label: 'Skills', icon: <Layers /> },
  { id: 'estimated_project_rate', label: 'Estimated Project Rate', icon: <Coins /> },
]
const hints = {
  portfolio: 'Describe your previous projects, contributions, and outcomes.',
  experience: 'Describe your work experience and professional background.',
  skills: 'Select all technologies you are proficient in. These skills will be used for project matching.',
  estimated_project_rate: 'Set your estimated service fee for a single project.',
}
const titles = { portfolio: 'Portfolio', experience: 'Professional Experience', skills: 'Select Your Skills', estimated_project_rate: 'Estimated Project Rate' }
type Draft = Omit<ProfileFields, 'estimated_project_rate'> & { estimated_project_rate: string }
function draftFrom(p: FreelancerProfile): Draft {
  return { portfolio: p.portfolio, experience: p.experience, skills: p.skills, estimated_project_rate: String(p.estimated_project_rate) }
}

export default function ProfilePage({ token, onSaved }: { token: string; onSaved: (p: FreelancerProfile) => void }) {
  const [saved, setSaved] = useState<FreelancerProfile>()
  const [draft, setDraft] = useState<Draft>()
  const [tab, setTab] = useState<Tab>('portfolio')
  const [attempt, retry] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const lifetime = useRef<AbortController>()
  const editor = useRef<HTMLElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    setError('')
    requestProfile(token, controller.signal).then(p => {
      if (controller.signal.aborted) return
      setSaved(p)
      setDraft(draftFrom(p))
    }).catch(() => { if (!controller.signal.aborted) setError('Your profile could not be loaded.') })
    return () => controller.abort()
  }, [token, attempt])

  if (!draft || !saved) return error
    ? <Alert tone="danger" title={error} action={<button type="button" className="link text-small" onClick={() => retry(attempt + 1)}>Retry</button>} />
    : <p role="status" className="card px-5 py-4 text-small text-ink-muted">Loading profile…</p>

  const rate = /^\d+$/.test(draft.estimated_project_rate) ? Number(draft.estimated_project_rate) : NaN
  const fields: ProfileFields = { ...draft, portfolio: draft.portfolio.trim(), experience: draft.experience.trim(), estimated_project_rate: rate }
  const patch: Partial<ProfileFields> = {}
  if (fields.portfolio !== saved.portfolio) patch.portfolio = fields.portfolio
  if (fields.experience !== saved.experience) patch.experience = fields.experience
  if (fields.estimated_project_rate !== saved.estimated_project_rate) patch.estimated_project_rate = rate
  if (fields.skills.length !== saved.skills.length || fields.skills.some(s => !saved.skills.includes(s))) patch.skills = fields.skills
  const dirty = Object.keys(patch).length > 0
  const validation = profileError(fields)
  function change(update: Partial<Draft>) {
    setDraft(current => current && { ...current, ...update }); setError(''); setNotice('')
  }
  async function save() {
    const signal = lifetime.current?.signal
    if (!signal || saving || !dirty || validation) return
    setSaving(true); setError(''); setNotice('')
    try {
      const updated = await requestProfile(token, signal, patch)
      if (signal.aborted) return
      setSaved(updated); setDraft(draftFrom(updated)); onSaved(updated); setNotice('Changes saved.')
    } catch {
      if (!signal.aborted) setError('Could not save your profile. Your changes are still here. Try Save Changes again.')
    } finally {
      if (!signal.aborted) setSaving(false)
    }
  }
  return <div>
    <PageHeader title={saved.name} subtitle="Freelancer · My Profile" back={<PersonAvatar initials={initialsOf(saved.name)} size={56} />}
      actions={<Button variant="secondary" disabled={saving} icon={<Pencil className="size-4" aria-hidden />} onClick={() => editor.current?.querySelector<HTMLElement>('textarea, input, button.skill-option')?.focus()}>Edit Profile</Button>} />
    <Tabs<Tab> tabs={tabs} label="Profile sections" value={tab} onChange={setTab} />
    <form className="card mt-4 p-5 md:p-6" onSubmit={e => { e.preventDefault(); void save() }}>
      <section ref={editor} role="tabpanel" aria-label={titles[tab]}>
        <div className="flex items-center justify-between gap-3"><h2 className="text-h2">{titles[tab]}</h2>{tab === 'skills' && <span className="tabular whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-1 text-caption font-semibold text-brand">{draft.skills.length} / {catalog.length} selected</span>}</div>
        <p className="mb-4 mt-1 text-small text-ink-muted">{hints[tab]}</p>
        {tab === 'portfolio' || tab === 'experience' ? <Field label={tab === 'portfolio' ? 'Portfolio description' : 'Experience description'}>
          {({ id }) => <Textarea id={id} rows={10} required disabled={saving} maxLength={5000} value={draft[tab]} onChange={e => change({ [tab]: e.target.value })} />}
        </Field> :
        tab === 'skills' ? <div>{Object.entries(skillGroups).map(([group, options]) =>
          <fieldset key={group} disabled={saving} aria-label={group} className="grid min-w-0 gap-2 border-b border-line py-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <p className="text-small font-semibold">{group} ({options.length})</p><div className="flex flex-wrap gap-2">{options.map(skill => {
              const selected = draft.skills.includes(skill)
              return <button key={skill} type="button" aria-pressed={selected}
                className={cn('skill-option inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-small font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-60 [&>svg]:size-4',
                  selected ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink hover:border-brand/50')}
                onClick={() => change({
                  skills: selected ? draft.skills.filter(s => s !== skill) : [...draft.skills, skill],
                })}>{selected ? <Check aria-hidden /> : <Plus aria-hidden />}{skill}</button>
            })}</div></fieldset>)}<button type="button" className="link mt-3 text-small disabled:text-disabled-text" disabled={saving || !draft.skills.length} onClick={() => change({ skills: [] })}>Clear selection</button></div> :
          <><Field label="Estimated project rate (IDR)" className="max-w-xl">
            {({ id }) => <Input id={id} required disabled={saving} inputMode="numeric" prefixIcon={<span className="text-small font-semibold">Rp</span>} value={draft.estimated_project_rate} onChange={e => change({ estimated_project_rate: e.target.value })} />}
          </Field>
            <div className="my-4 flex items-center gap-4 rounded-md bg-canvas p-4"><Coins className="size-6 shrink-0 text-accent-strong" aria-hidden /><p className="text-caption text-ink-muted">Your estimated project rate<span className="tabular block text-h1 text-ink">{Number.isSafeInteger(rate) && rate > 0 ? formatIdr(rate) : '—'}</span>Per project</p></div>
            <p className="flex items-start gap-2 text-small text-ink-muted"><Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />This rate helps clients find freelancers within their project budget. The final payment will be agreed upon during contract negotiation.</p></>}
      </section>
      <footer className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4"><div className="min-w-0 flex-1 basis-full text-small text-ink-muted sm:basis-0" aria-live="polite">{error || validation || (saving ? 'Saving…' : dirty ? 'Unsaved changes' : notice)}</div>
        <Button variant="quiet" disabled={saving} onClick={() => { setDraft(draftFrom(saved)); setError(''); setNotice('') }}>Cancel</Button>
        <Button type="submit" disabled={saving || !dirty || !!validation}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </footer>
    </form>
  </div>
}
