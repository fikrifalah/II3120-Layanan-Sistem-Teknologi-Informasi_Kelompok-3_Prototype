import { mockProfileEnabled, readDemoProfile } from '../../services/freelancerProfile'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Bookmark, BookmarkCheck, Briefcase, CalendarClock, CheckCircle2, Coins, EyeOff, FolderOpen, Info, MapPin, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { useStore } from '../../services/store'
import { formatIdr } from '../../lib/format'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/cn'
import type { ScoreBreakdown } from '../../types/domain'
import { Button, LinkButton } from '../../components/ui/Button'
import { Badge, InvitationStatusBadge, SkillChip } from '../../components/ui/Badge'
import { Breadcrumb, CardTitle, Tabs } from '../../components/ui/Display'
import { AnonAvatar, PersonAvatar, ScoreRing } from '../../components/ui/Identity'
import { InviteDialog } from '../../components/CandidateCard'

const FACTORS: Array<{ key: keyof ScoreBreakdown; label: string; weight: number }> = [
  { key: 'skills', label: 'Skills', weight: 30 },
  { key: 'experience', label: 'Experience relevance', weight: 25 },
  { key: 'portfolio', label: 'Portfolio relevance', weight: 20 },
  { key: 'budget', label: 'Budget fit', weight: 10 },
  { key: 'availability', label: 'Availability', weight: 10 },
  { key: 'reliability', label: 'Delivery record', weight: 5 },
]

type Tab = 'portfolio' | 'skills'

export default function CandidateDetail() {
  const { projectId = '', candidateId = '' } = useParams()
  const store = useStore()
  const project = store.getProject(projectId)
  const c = store.getCandidate(projectId, candidateId)
  const [tab, setTab] = useState<Tab>('portfolio')
  const [saved, setSaved] = useState(false)
  const [inviting, setInviting] = useState(false)
  usePageTitle(c ? `Candidate ${c.id}` : 'Candidate')
  if (!project || !c) return <Navigate to={`/client/projects/${projectId}/matches`} replace />

  const revealed = store.isRevealed(projectId, c.id)
  const invitation = store.invitations.find((i) => i.projectId === projectId && i.candidateId === c.id && i.status !== 'cancelled')
  const profile = revealed && mockProfileEnabled && c.id === 'TL-3158' ? readDemoProfile() : null
  const name = revealed ? c.identity.name : `Candidate ${c.id}`

  const inviteAction = invitation ? (
    <div className="flex h-11 items-center justify-center gap-2 rounded-sm bg-canvas px-4 text-small text-ink-muted">
      Invitation <InvitationStatusBadge status={invitation.status} />
    </div>
  ) : (
    <Button icon={<Send className="size-4" aria-hidden />} onClick={() => setInviting(true)}>
      Invite to project
    </Button>
  )

  return (
    <div>
      <Breadcrumb items={[{ label: project.title, to: `/client/projects/${projectId}` }, { label: 'AI matches', to: `/client/projects/${projectId}/matches` }, { label: name }]} />
      <LinkButton to={`/client/projects/${projectId}/matches`} variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} className="-ml-3 mb-4 md:hidden">
        All matches
      </LinkButton>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 md:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {revealed ? <PersonAvatar initials={c.identity.initials} size={88} /> : <AnonAvatar seed={c.id} size={88} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-h1 md:text-h1-lg">{name}</h1>
                  <Badge tone={c.availableNow ? 'success' : 'warning'} dot>
                    {c.availability}
                  </Badge>
                </div>
                <p className="mt-0.5 text-body text-ink-muted">{revealed ? c.identity.role : c.headline}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden /> {revealed ? c.identity.location : 'Location hidden'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="size-4" aria-hidden /> {c.experienceYears} years experience
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-4" aria-hidden /> {c.onTimeRate === null ? 'New on Gigly' : `${Math.round(c.onTimeRate * 100)}% on time · ${c.completedProjects} projects`}
                  </span>
                </p>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <Button variant="quiet" icon={saved ? <BookmarkCheck className="size-4 text-brand" aria-hidden /> : <Bookmark className="size-4" aria-hidden />} onClick={() => setSaved((s) => !s)} aria-pressed={saved}>
                  {saved ? 'Saved' : 'Save'}
                </Button>
              </div>
            </div>

            {!revealed && (
              <div className="mt-5 flex items-start gap-3 rounded-md bg-canvas px-4 py-3 text-small text-ink-muted">
                <EyeOff className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                Name, photo, location and contact details are hidden. They appear if this freelancer accepts your invitation.
              </div>
            )}

            <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                <h2 className="mb-2 text-h3">{profile ? 'Experience' : 'About'}</h2>
                <p className="text-small leading-6 text-ink">{profile?.experience ?? c.about}</p>
              </div>
              <div>
                <h2 className="mb-2 text-h3">{profile ? 'Skills' : 'Skills for this project'}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {(profile?.skills ?? c.matchedSkills).map((s) => (
                    <SkillChip key={s}>{s}</SkillChip>
                  ))}
                  {!profile && c.missingSkills.map((s) => (
                    <SkillChip key={s} missing>
                      <span className="sr-only">Missing: </span>
                      {s}
                    </SkillChip>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="card p-5 md:p-6">
            <Tabs<Tab>
              label="Profile sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'portfolio', label: profile ? 'Portfolio' : 'Portfolio evidence', icon: <FolderOpen className="size-4" aria-hidden />, count: profile ? undefined : c.portfolio.length },
                { id: 'skills', label: 'Score breakdown', icon: <Sparkles className="size-4" aria-hidden /> },
              ]}
            />
            <div key={tab} className="animate-fade pt-5">
              {tab === 'portfolio' && profile ? <p className="whitespace-pre-wrap break-words">{profile.portfolio}</p> : tab === 'portfolio' ? (
                <ul className="stagger space-y-3">
                  {c.portfolio.map((w) => (
                    <li key={w.title} className="grid gap-4 rounded-md border border-line p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                      <PortfolioThumb seed={w.title} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-body font-semibold">{w.title}</h3>
                          {w.verified ? (
                            <Badge tone="success">
                              <CheckCircle2 className="size-3" aria-hidden /> Verified
                            </Badge>
                          ) : (
                            <Badge tone="warning">Not verified</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-small text-ink-muted">{w.summary}</p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {w.stack.map((s) => (
                            <SkillChip key={s} tone={project.requiredSkills.includes(s) || project.preferredSkills.includes(s) ? 'brand' : 'neutral'}>
                              {s}
                            </SkillChip>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-4">
                  {FACTORS.map((f) => (
                    <li key={f.key}>
                      <div className="mb-1.5 flex items-center justify-between text-small">
                        <span className="text-ink">
                          {f.label} <span className="text-caption text-ink-muted">· weight {f.weight}%</span>
                        </span>
                        <span className="tabular font-semibold">{c.breakdown[f.key]}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
                        <div className={cn('h-full rounded-full', c.breakdown[f.key] >= 80 ? 'bg-success' : c.breakdown[f.key] >= 60 ? 'bg-brand' : 'bg-accent')} style={{ width: `${c.breakdown[f.key]}%` }} />
                      </div>
                    </li>
                  ))}
                  <li className="rounded-md bg-canvas p-3 text-caption text-ink-muted">A freelancer with no history scores a neutral 70 on delivery record — being new is not counted as a bad record.</li>
                </ul>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5 xl:sticky xl:top-24">
            <CardTitle icon={<Sparkles className="size-5 text-accent" aria-hidden />}>Project match analysis</CardTitle>
            <div className="flex items-center gap-4 rounded-md bg-brand-soft/60 p-4">
              <ScoreRing score={c.score} size={72} />
              <div>
                <p className="tabular text-h2">{c.score} / 100</p>
                <p className="text-small text-ink-muted">Rank #{c.rank} for {project.title}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5 text-small">
              {c.reasons.map((r) => (
                <li key={r} className="flex gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {r}
                </li>
              ))}
              {c.gaps.map((g) => (
                <li key={g} className="flex gap-2.5">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden /> <span>{g}</span>
                </li>
              ))}
            </ul>
            <div className="my-5 grid grid-cols-2 divide-x divide-line rounded-md border border-line">
              <div className="flex items-center gap-2.5 p-3">
                <Coins className="size-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="text-caption text-ink-muted">Estimated rate</p>
                  <p className="tabular text-small font-semibold">{formatIdr(profile?.estimated_project_rate ?? c.estimateIdr)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3">
                <CalendarClock className="size-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <p className="text-caption text-ink-muted">Availability</p>
                  <p className="text-small font-semibold">{c.availability}</p>
                </div>
              </div>
            </div>
            <div className="[&>*]:w-full">{inviteAction}</div>
            <p className="mt-3 flex gap-2 text-caption text-ink-muted">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              An invitation is not a contract. Scope, milestones and payment are agreed later if they accept.
            </p>
          </section>
        </aside>
      </div>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} candidate={c} projectTitle={project.title} />
    </div>
  )
}

/** A small UI-like thumbnail for a portfolio project (no screenshots exist for anonymous work). */
function PortfolioThumb({ seed }: { seed: string }) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const bars = [40 + (h % 40), 30 + ((h >> 3) % 50), 50 + ((h >> 6) % 40), 25 + ((h >> 9) % 55)]
  return (
    <div className="flex aspect-[4/3] flex-col gap-1.5 rounded-sm border border-line bg-canvas p-2.5 sm:aspect-auto sm:h-full" aria-hidden>
      <div className="flex gap-1">
        <span className="size-1.5 rounded-full bg-line-control/40" />
        <span className="size-1.5 rounded-full bg-line-control/40" />
        <span className="size-1.5 rounded-full bg-line-control/40" />
      </div>
      <div className="h-2 w-1/2 rounded-full bg-brand/70" />
      <div className="flex flex-1 items-end gap-1">
        {bars.map((b, i) => (
          <span key={i} className={cn('flex-1 rounded-t-[3px]', i === 2 ? 'bg-accent' : 'bg-brand/25')} style={{ height: `${b}%` }} />
        ))}
      </div>
    </div>
  )
}
