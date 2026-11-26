import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Briefcase, CheckCircle2, ChevronRight, FolderOpen, Send, Sparkles } from 'lucide-react'
import type { Candidate, Invitation } from '../types/domain'
import { formatIdr } from '../lib/format'
import { cn } from '../lib/cn'
import { useStore } from '../services/store'
import { Button, LinkButton } from './ui/Button'
import { InvitationStatusBadge, SkillChip } from './ui/Badge'
import { Dialog, useToast } from './ui/Feedback'
import { Field, Textarea } from './ui/Field'
import { AnonAvatar, PersonAvatar, ScoreRing } from './ui/Identity'

/** Board 03B candidate card — anonymous until the freelancer accepts an invitation. */
export function CandidateCard({ c, invitation, projectTitle }: { c: Candidate; invitation?: Invitation; projectTitle: string }) {
  const { isRevealed } = useStore()
  const revealed = isRevealed(c.projectId, c.id)
  const [inviting, setInviting] = useState(false)
  const profile = `/client/projects/${c.projectId}/candidates/${c.id}`

  return (
    <article className="card overflow-hidden transition-[box-shadow,border-color] duration-200 hover:border-line-control/50">
      <div className="grid gap-5 p-4 md:grid-cols-2 md:p-5">
        {/* Who (anonymous) */}
        <div className="min-w-0">
          <div className="flex items-start gap-3.5">
            {revealed ? <PersonAvatar initials={c.identity.initials} size={52} /> : <AnonAvatar seed={c.id} size={52} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-h3 text-ink">
                  <Link to={profile} className="hover:text-brand">
                    {revealed ? c.identity.name : `Candidate ${c.id}`}
                  </Link>
                </h3>
                <span className="tabular rounded-full bg-canvas px-2 py-0.5 text-caption font-semibold text-ink-muted ring-1 ring-inset ring-line">#{c.rank}</span>
              </div>
              <p className="text-small text-ink-muted">{c.headline}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="size-3.5" aria-hidden /> {c.experienceYears} {c.experienceYears === 1 ? 'year' : 'years'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', c.availableNow ? 'bg-success' : 'bg-accent')} aria-hidden /> {c.availability}
                </span>
                <span>{c.completedProjects} projects</span>
              </p>
            </div>
            <ScoreRing score={c.score} size={56} />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
            {c.matchedSkills.map((s) => (
              <SkillChip key={s}>{s}</SkillChip>
            ))}
            {c.missingSkills.map((s) => (
              <SkillChip key={s} missing>
                <span className="sr-only">Missing: </span>
                {s}
              </SkillChip>
            ))}
          </div>

          {c.portfolio[0] && (
            <Link to={profile} className="group mt-4 flex items-center gap-3 rounded-md border border-line px-3 py-2.5 transition-colors hover:border-brand/40 hover:bg-brand-soft/40">
              <FolderOpen className="size-5 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-small font-semibold text-ink">Portfolio evidence ({c.portfolio.length})</span>
                <span className="block truncate text-caption text-ink-muted">{c.portfolio.map((p) => p.title).join(' · ')}</span>
              </span>
              <ChevronRight className="size-4 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
        </div>

        {/* Why */}
        <div className="min-w-0 border-line md:border-l md:pl-5">
          <p className="mb-2 flex items-center gap-1.5 text-small font-semibold text-ink">
            <Sparkles className="size-4 text-accent" aria-hidden /> Why this match
          </p>
          <ul className="space-y-1.5 text-small">
            {c.reasons.slice(0, 3).map((r) => (
              <li key={r} className="flex gap-2 text-ink">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> <span>{r}</span>
              </li>
            ))}
            {c.gaps.slice(0, 2).map((g) => (
              <li key={g} className="flex gap-2 text-ink">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden />
                <span>
                  <span className="font-semibold text-accent-strong">Evidence gap: </span>
                  {g}
                </span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Decide */}
      <div className="flex flex-col gap-3 border-t border-line bg-canvas/50 px-4 py-3 sm:flex-row sm:items-center md:px-5">
        <p className="text-small text-ink-muted">
          Estimate <span className="tabular ml-1 text-h3 text-ink">{formatIdr(c.estimateIdr)}</span>
        </p>
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
          <LinkButton to={profile} variant="secondary">
            View profile
          </LinkButton>
          {invitation && invitation.status !== 'cancelled' ? (
            <div className="flex h-11 items-center justify-center gap-2 rounded-sm bg-surface px-4 text-small text-ink-muted ring-1 ring-inset ring-line">
              Invitation <InvitationStatusBadge status={invitation.status} />
            </div>
          ) : (
            <Button disabled={!c.eligible} icon={<Send className="size-4" aria-hidden />} onClick={() => setInviting(true)}>
              Invite to project
            </Button>
          )}
        </div>
      </div>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} candidate={c} projectTitle={projectTitle} />
    </article>
  )
}

export function InviteDialog({ open, onClose, candidate, projectTitle }: { open: boolean; onClose: () => void; candidate: Candidate; projectTitle: string }) {
  const { sendInvitation } = useStore()
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState(`Hi — your profile matches what we need for "${projectTitle}". Would you like to discuss scope, timeline and rate?`)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Invite Candidate ${candidate.id}`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={<Send className="size-4" aria-hidden />}
            disabled={sending}
            onClick={async () => {
              setSending(true)
              try { await sendInvitation(candidate.projectId, candidate.id, msg) }
              catch (e) { toast({ tone: 'danger', title: e instanceof Error ? e.message : 'Could not send invitation.' }); return }
              finally { setSending(false) }
              onClose()
              toast({ tone: 'success', title: 'Invitation sent', body: `Candidate ${candidate.id} usually replies within a day.` })
            }}
          >
            Send invitation
          </Button>
        </>
      }
    >
      <p className="mb-4">
        This is an invitation to talk, not a contract. No money moves. If they accept, you will see who they are and can draft the contract together.
      </p>
      <Field label="Message">{(p) => <Textarea id={p.id} rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} />}</Field>
    </Dialog>
  )
}
