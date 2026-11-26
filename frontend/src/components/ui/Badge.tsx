import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { ContractStatus, InvitationStatus, MilestoneStatus, ProjectStatus } from '../../types/domain'

export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const tones: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-accent-soft text-accent-strong',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-canvas text-ink-muted ring-1 ring-inset ring-line',
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

const PROJECT: Record<ProjectStatus, [string, Tone]> = {
  draft: ['Draft', 'neutral'],
  matching: ['Choosing talent', 'brand'],
  inviting: ['Invitation sent', 'info'],
  contracting: ['Contracting', 'info'],
  funding: ['Awaiting funding', 'warning'],
  active: ['In progress', 'success'],
  completed: ['Completed', 'neutral'],
  cancelled: ['Cancelled', 'neutral'],
}

const MILESTONE: Record<MilestoneStatus, [string, Tone]> = {
  pending: ['Pending', 'neutral'],
  in_progress: ['In progress', 'info'],
  under_review: ['Under review', 'warning'],
  revision_required: ['Revision required', 'brand'],
  disputed: ['Disputed', 'danger'],
  released: ['Paid', 'success'],
  refunded: ['Refunded', 'neutral'],
  split: ['Split by arbiter', 'neutral'],
}

const CONTRACT: Record<ContractStatus, [string, Tone]> = {
  draft: ['Draft', 'neutral'],
  pending_approval: ['Waiting for freelancer', 'info'],
  awaiting_funding: ['Awaiting funding', 'warning'],
  active: ['Active', 'success'],
  closed: ['Closed', 'neutral'],
}

const INVITATION: Record<InvitationStatus, [string, Tone]> = {
  pending: ['Pending', 'warning'],
  accepted: ['Accepted', 'success'],
  declined: ['Declined', 'neutral'],
  cancelled: ['Cancelled', 'neutral'],
}

export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => <Badge tone={PROJECT[status][1]}>{PROJECT[status][0]}</Badge>
export const MilestoneStatusBadge = ({ status }: { status: MilestoneStatus }) => <Badge tone={MILESTONE[status][1]}>{MILESTONE[status][0]}</Badge>
export const ContractStatusBadge = ({ status }: { status: ContractStatus }) => <Badge tone={CONTRACT[status][1]}>{CONTRACT[status][0]}</Badge>
export const InvitationStatusBadge = ({ status }: { status: InvitationStatus }) => <Badge tone={INVITATION[status][1]}>{INVITATION[status][0]}</Badge>

export function SkillChip({ children, tone = 'brand', missing }: { children: ReactNode; tone?: 'brand' | 'neutral'; missing?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-3 text-caption font-medium',
        missing ? 'border border-dashed border-line-control/50 text-ink-muted line-through decoration-ink-muted/40' : tone === 'brand' ? 'bg-brand-soft text-brand' : 'bg-canvas text-ink ring-1 ring-inset ring-line',
      )}
    >
      {children}
    </span>
  )
}
