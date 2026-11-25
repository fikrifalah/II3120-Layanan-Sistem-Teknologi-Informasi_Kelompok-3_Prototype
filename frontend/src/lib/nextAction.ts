import type { Contract, Invitation, Project } from '../types/domain'

export interface NextAction {
  label: string
  to: string
  urgent: boolean
}

/** The one thing the client should do next on a project (Master Plan §6.1 "next action"). */
export function nextAction(p: Project, contracts: Contract[], invitations: Invitation[]): NextAction | null {
  const base = `/client/projects/${p.id}`
  const contract = contracts.find((c) => c.id === p.contractId)
  const invs = invitations.filter((i) => i.projectId === p.id)
  switch (p.status) {
    case 'draft':
      return { label: 'Run AI matching', to: `${base}/matches`, urgent: false }
    case 'matching':
      return { label: 'Choose candidates', to: `${base}/matches`, urgent: false }
    case 'inviting':
      return invs.some((i) => i.status === 'accepted')
        ? { label: 'Create contract', to: `${base}/invitations`, urgent: true }
        : { label: 'View invitations', to: `${base}/invitations`, urgent: false }
    case 'contracting':
      if (!contract) return { label: 'Create contract', to: `${base}/invitations`, urgent: true }
      return contract.status === 'draft'
        ? { label: 'Finish contract', to: `${base}/contract`, urgent: true }
        : { label: 'View contract', to: `${base}/contract`, urgent: false }
    case 'funding':
      return { label: 'Fund escrow', to: `${base}/fund`, urgent: true }
    case 'active': {
      const review = contract?.milestones.find((m) => m.status === 'under_review')
      if (review) return { label: `Review Milestone ${review.seq}`, to: `${base}/milestones/${review.id}/review`, urgent: true }
      return { label: 'Open workspace', to: base, urgent: false }
    }
    default:
      return { label: 'View project', to: base, urgent: false }
  }
}
