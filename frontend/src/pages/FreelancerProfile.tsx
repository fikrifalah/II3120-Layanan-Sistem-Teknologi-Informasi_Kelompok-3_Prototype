import { useEffect, useRef, useState } from 'react'
import { BriefcaseBusiness, Check, Coins, FolderClosed, Info, Layers, Pencil, Plus } from 'lucide-react'
import { Tabs } from '../components/ui/Display'
import { formatIdr } from '../lib/format'
import { catalog, profileError, requestProfile, skillGroups, type FreelancerProfile, type ProfileFields } from '../services/freelancerProfile'
import './profile.css'

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

  if (!draft || !saved) return <section className="profile-card" role="status">{error || 'Loading profile…'}
    {error && <button className="outline-action ml-4" onClick={() => retry(attempt + 1)}>Retry</button>}</section>

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
  return <div className="my-profile">
    <header className="profile-heading"><img src="/brand/rafi.png" alt="" /><div><h1>{saved.name}</h1><p>Freelancer · My Profile</p></div>
      <button className="outline-action" disabled={saving} onClick={() => editor.current?.querySelector<HTMLElement>('textarea, input, button.skill-option')?.focus()}><Pencil />Edit Profile</button></header>
    <Tabs<Tab> tabs={tabs} label="Profile sections" value={tab} onChange={setTab} />
    <form className="profile-card" onSubmit={e => { e.preventDefault(); void save() }}>
      <section ref={editor} role="tabpanel" aria-label={titles[tab]}>
        <div className="profile-section-head"><h2>{titles[tab]}</h2>{tab === 'skills' && <span>{draft.skills.length} / {catalog.length} selected</span>}</div>
        <p className="profile-help">{hints[tab]}</p>
        {tab === 'portfolio' || tab === 'experience' ? <label className="profile-field">{tab === 'portfolio' ? 'Portfolio description' : 'Experience description'}
          <textarea required disabled={saving} maxLength={5000} value={draft[tab]} onChange={e => change({ [tab]: e.target.value })} /></label> :
        tab === 'skills' ? <div className="profile-skills">{Object.entries(skillGroups).map(([group, options]) =>
          <fieldset key={group} disabled={saving} aria-label={group}><strong>{group} ({options.length})</strong><div>{options.map(skill => {
            const selected = draft.skills.includes(skill)
            return <button key={skill} type="button" className="skill-option" aria-pressed={selected} onClick={() => change({
              skills: selected ? draft.skills.filter(s => s !== skill) : [...draft.skills, skill],
            })}>{selected ? <Check /> : <Plus />}{skill}</button>
          })}</div></fieldset>)}<button type="button" className="link" disabled={saving || !draft.skills.length} onClick={() => change({ skills: [] })}>Clear selection</button></div> :
          <><label className="profile-field">Estimated project rate (IDR)<span className="profile-rate"><b>Rp</b>
            <input required disabled={saving} inputMode="numeric" value={draft.estimated_project_rate} onChange={e => change({ estimated_project_rate: e.target.value })} /></span></label>
            <div className="rate-preview"><Coins /><div>Your estimated project rate<strong>{Number.isSafeInteger(rate) && rate > 0 ? formatIdr(rate) : '—'}</strong>Per project</div></div>
            <p className="rate-info"><Info />This rate helps clients find freelancers within their project budget. The final payment will be agreed upon during contract negotiation.</p></>}
      </section>
      <footer><div aria-live="polite">{error || validation || (saving ? 'Saving…' : dirty ? 'Unsaved changes' : notice)}</div>
        <button type="button" className="outline-action" disabled={saving} onClick={() => { setDraft(draftFrom(saved)); setError(''); setNotice('') }}>Cancel</button>
        <button className="primary-action" disabled={saving || !dirty || !!validation}>{saving ? 'Saving…' : 'Save Changes'}</button>
      </footer>
    </form>
  </div>
}
