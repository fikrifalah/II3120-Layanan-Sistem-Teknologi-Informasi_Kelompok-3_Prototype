/**
 * Client-side domain types. Status unions follow the lifecycles in the Web App Master Plan §15.
 * Amounts: project budgets are in IDR (Rupiah); contract and escrow amounts are in SIM-IDR tokens.
 */

export type ProjectStatus =
  | 'draft'
  | 'matching' // AI has ranked candidates; client is choosing
  | 'inviting' // at least one invitation is pending
  | 'contracting' // invitation accepted, contract being drafted or approved
  | 'funding' // both parties agreed, waiting for escrow funding
  | 'active'
  | 'completed'
  | 'cancelled'

export type ExperienceLevel = 'junior' | 'mid' | 'senior'

export interface Project {
  id: string
  title: string
  category: string
  description: string
  deliverables: string[]
  links: string[]
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: ExperienceLevel
  industry: string
  budgetIdr: number
  budgetFlexible: boolean
  startDate: string // ISO date
  endDate: string // ISO date
  status: ProjectStatus
  createdAt: string
  /** Candidate selected for the contract, once an invitation is accepted. */
  hiredCandidateId?: string
  contractId?: string
  /** id baris `job` di backend AI matching; dibuat sekali agar alias kandidat tetap stabil. */
  backendJobId?: number
}

/** Score components; weights from Master Plan §6.3 (skill 30, experience 25, portfolio 20, budget 10, availability 10, reliability 5). */
export interface ScoreBreakdown {
  skills: number
  experience: number
  portfolio: number
  budget: number
  availability: number
  reliability: number
  /** Kecocokan Ringkasan/Keahlian CV (backend AI matching, keputusan #16). Mock selalu 0. */
  profile: number
}

export interface PortfolioEvidence {
  title: string
  summary: string
  stack: string[]
  verified: boolean
}

/**
 * A ranked candidate. Everything here is anonymous: no name, photo, location or contact.
 * `identity` stays hidden in the UI until the freelancer accepts the client's invitation.
 */
export interface Candidate {
  id: string // anonymous handle, e.g. "TL-3158"
  projectId: string
  rank: number
  score: number // 0–100, project-specific
  breakdown: ScoreBreakdown
  headline: string
  experienceYears: number
  availability: string
  availableNow: boolean
  estimateIdr: number
  profileSignature?: string
  matchedSkills: string[]
  missingSkills: string[]
  /** All confirmed mandatory requirements are met. Near-matches are shown separately. */
  eligible: boolean
  reasons: string[]
  gaps: string[]
  about: string
  portfolio: PortfolioEvidence[]
  completedProjects: number
  onTimeRate: number | null // null = new freelancer, no history (not evidence of poor reliability)
  identity: { name: string; role: string; location: string; initials: string }
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface Invitation {
  id: string
  projectId: string
  candidateId: string
  status: InvitationStatus
  sentAt: string
  respondedAt?: string
  candidateSnapshot?: Candidate
  portfolioExcerpt?: string
  conversation?: { sender: 'client' | 'freelancer'; text: string; at: string }[]
  message: string
  /** id baris `invitation` di backend (mode VITE_INVITATIONS_API); kosong = undangan demo. */
  backendId?: number
}

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'under_review'
  | 'revision_required'
  | 'disputed'
  | 'released'
  | 'refunded'
  | 'split' // putusan arbiter: dana dibagi freelancer & client

export interface Criterion {
  id: string
  text: string
  hint?: string
}

export interface SubmissionFile {
  blobId?: string
  /** id berkas di backend (mode VITE_CONTRACTS_API). */
  apiId?: number
  name: string
  description: string
  size?: string
  kind: 'archive' | 'code' | 'pdf' | 'report' | 'link' | 'repo'
  url?: string
}

export interface Submission {
  title?: string
  declaredCriteria?: string[]
  repositoryRevision?: string
  version: string
  submittedAt: string
  notes: string
  files: SubmissionFile[]
}

export interface Milestone {
  id: string
  /** id baris `milestone` di backend (mode VITE_CONTRACTS_API). */
  backendId?: number
  seq: number
  title: string
  description: string
  deliverables: string[]
  criteria: Criterion[]
  amount: number // SIM-IDR
  dueDay: number // day N from contract start
  status: MilestoneStatus
  submissions: Submission[]
  reviewDeadline?: string
  revisionNote?: string
  disputeReason?: string
  releasedAt?: string
  /** Pembagian dana saat milestone selesai (backend): ke freelancer dan kembali ke client. */
  settlement?: { freelancer: number; client: number }
}

export type ContractStatus = 'draft' | 'pending_approval' | 'awaiting_funding' | 'active' | 'closed'

export interface Contract {
  id: string
  /** id baris `contract` di backend; ada setelah kontrak dikirim (mode VITE_CONTRACTS_API). */
  backendId?: number
  projectId: string
  candidateId: string
  status: ContractStatus
  version: number
  scope: string
  durationDays: number
  reviewDays: number
  arbiter: string
  milestones: Milestone[]
  startedAt?: string
  documentHash?: string
  escrowAddress?: string
  fundingTxHash?: string
}

export type TxType = 'fund' | 'release' | 'refund' | 'faucet'
export type TxStatus = 'pending' | 'confirmed' | 'failed'

export interface Transaction {
  id: string
  type: TxType
  amount: number
  status: TxStatus
  hash: string
  projectId?: string
  milestoneId?: string
  label: string
  at: string
}

export interface Wallet {
  address: string
  network: string
  balance: number
  locked: number
  spent: number
  refunded: number
}

export interface ActivityItem {
  id: string
  at: string
  text: string
  projectId?: string
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'
}

export interface Notification {
  id: string
  at: string
  title: string
  body: string
  href: string
  read: boolean
}
