import type { ActivityItem, Candidate, Contract, Invitation, Notification, Project, Transaction, Wallet } from '../types/domain'
import { isoDaysFromNow } from '../lib/format'
import { rankCandidates } from './matching'

/** Demo state for a fresh session. Mirrors the examples in the Master Plan (§6.1, §7.1, §8.4, §12.1). */

export interface ClientState {
  user: { firstName: string; company: string; initials: string }
  projects: Project[]
  candidates: Record<string, Candidate[]>
  invitations: Invitation[]
  contracts: Contract[]
  wallet: Wallet
  transactions: Transaction[]
  activity: ActivityItem[]
  notifications: Notification[]
}

const ago = (d: number) => isoDaysFromNow(-d)

const backend: Project = {
  id: 'PRJ-104',
  title: 'Backend Microservices & API Integration',
  category: 'Backend & API',
  description:
    'Develop and integrate backend microservices and APIs for our ordering platform, including core services, database integration and secure API endpoints.',
  deliverables: ['2 backend microservices (user & order)', 'RESTful APIs with OpenAPI documentation', 'Integration with the existing database', 'Deployment guide and basic monitoring'],
  links: [],
  requiredSkills: ['FastAPI', 'PostgreSQL', 'Docker'],
  preferredSkills: ['Redis', 'CI/CD'],
  experienceLevel: 'mid',
  industry: 'logistics',
  budgetIdr: 15_000_000,
  budgetFlexible: false,
  startDate: ago(16),
  endDate: isoDaysFromNow(14),
  status: 'active',
  createdAt: ago(24),
  hiredCandidateId: 'TL-3158',
  contractId: 'CT-104',
}

const ecommerce: Project = {
  id: 'PRJ-112',
  title: 'E-commerce Website Development',
  category: 'Web Development',
  description:
    'A storefront for our home-goods brand: product catalogue, cart, checkout with local payment methods and a simple admin to manage stock and orders.',
  deliverables: ['Responsive storefront (catalogue, product page, cart)', 'Checkout with Midtrans', 'Admin for products, stock and orders', 'Deployment and handover notes'],
  links: [],
  requiredSkills: ['React', 'Next.js', 'PostgreSQL'],
  preferredSkills: ['Midtrans', 'Tailwind CSS'],
  experienceLevel: 'mid',
  industry: 'e-commerce',
  budgetIdr: 15_000_000,
  budgetFlexible: true,
  startDate: isoDaysFromNow(5),
  endDate: isoDaysFromNow(35),
  status: 'matching',
  createdAt: ago(1),
}

const analytics: Project = {
  id: 'PRJ-118',
  title: 'Sales Analytics Dashboard',
  category: 'Data & Analytics',
  description: 'A daily sales dashboard for regional managers, fed from our PostgreSQL order database, with drill-down by region and product line.',
  deliverables: ['Daily data pipeline from the order database', 'Dashboard with regional drill-down', 'Access for 12 managers'],
  links: [],
  requiredSkills: ['Python', 'PostgreSQL', 'React'],
  preferredSkills: ['dbt'],
  experienceLevel: 'mid',
  industry: 'retail',
  budgetIdr: 12_000_000,
  budgetFlexible: false,
  startDate: isoDaysFromNow(3),
  endDate: isoDaysFromNow(28),
  status: 'contracting',
  createdAt: ago(6),
  hiredCandidateId: 'TL-7742',
}

const profileSite: Project = {
  id: 'PRJ-090',
  title: 'Company Profile Website',
  category: 'Web Development',
  description: 'Five-page company profile with a careers page and contact form.',
  deliverables: ['Five pages', 'Careers page', 'Contact form'],
  links: [],
  requiredSkills: ['React', 'Tailwind CSS'],
  preferredSkills: [],
  experienceLevel: 'junior',
  industry: '',
  budgetIdr: 6_000_000,
  budgetFlexible: false,
  startDate: ago(70),
  endDate: ago(45),
  status: 'completed',
  createdAt: ago(75),
  hiredCandidateId: 'TL-6630',
}

const backendContract: Contract = {
  id: 'CT-104',
  projectId: 'PRJ-104',
  candidateId: 'TL-3158',
  status: 'active',
  version: 2,
  scope:
    'Design the system architecture and database, build the user and order services in FastAPI, document every endpoint with OpenAPI, containerise with Docker Compose, write automated tests and deliver deployment documentation.',
  durationDays: 30,
  reviewDays: 5,
  arbiter: 'Gigly Arbitration Panel',
  startedAt: ago(16),
  documentHash: '0x9c1d4e7a20b55f3e8a61c0d2b7f49e18a3c6d5e2f1b0a9c8d7e6f5a4b3c2d1e0',
  escrowAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  fundingTxHash: '0x7f3d4e9c2b1a0f8e7d6c5b4a3928170f6e5d4c3b2a19087f6e5d4c3b2a1e8d9',
  milestones: [
    {
      id: 'M1',
      seq: 1,
      title: 'Architecture & Database Design',
      description: 'System architecture, ERD and API contract for both services.',
      deliverables: ['ERD covering User, Escrow and Milestone', 'PostgreSQL schema in 3NF', 'OpenAPI document'],
      criteria: [
        { id: 'c1', text: 'ERD includes User, Escrow and Milestone' },
        { id: 'c2', text: 'PostgreSQL schema meets 3NF' },
        { id: 'c3', text: 'OpenAPI documents at least 5 endpoints' },
      ],
      amount: 6000,
      dueDay: 10,
      status: 'released',
      submissions: [
        {
          version: 'v1.0',
          submittedAt: ago(7),
          notes: 'ERD, schema migration and OpenAPI file attached.',
          files: [
            { name: 'erd-v1.pdf', description: 'Entity relationship diagram', size: '640 KB', kind: 'pdf' },
            { name: 'openapi.yaml', description: 'OpenAPI 3.1 specification', size: '38 KB', kind: 'code' },
          ],
        },
      ],
      releasedAt: ago(5),
    },
    {
      id: 'M2',
      seq: 2,
      title: 'Implementation & Deployment',
      description: 'Both services implemented, tested and runnable with Docker Compose.',
      deliverables: ['FastAPI source code', 'Docker Compose setup', 'pytest report', 'Deployment documentation'],
      criteria: [
        { id: 'c1', text: 'FastAPI source code', hint: 'Source code is provided and runs correctly.' },
        { id: 'c2', text: 'Docker Compose runs', hint: 'The application starts with docker compose up.' },
        { id: 'c3', text: 'pytest coverage ≥ 80%', hint: 'Test report shows the coverage figure.' },
        { id: 'c4', text: 'Agreed deployment documentation', hint: 'Environment, setup steps, base URL and troubleshooting.' },
      ],
      amount: 9000,
      dueDay: 30,
      status: 'under_review',
      reviewDeadline: new Date(Date.now() + (3 * 24 + 14) * 3_600_000).toISOString(),
      submissions: [
        {
          version: 'v1.0',
          submittedAt: new Date(Date.now() - (1 * 24 + 10) * 3_600_000).toISOString(),
          notes: 'Both services are in the repository. Coverage is 82%. Deployment guide covers local setup; cloud section is short.',
          files: [
            { name: 'fastapi-source-code.zip', description: 'FastAPI source code (v1.0)', size: '24.8 MB', kind: 'archive' },
            { name: 'docker-compose.yml', description: 'Docker Compose configuration', size: '5.2 KB', kind: 'code' },
            { name: 'deployment-guide.pdf', description: 'Deployment guide and setup steps', size: '1.4 MB', kind: 'pdf' },
            { name: 'pytest-report.html', description: 'Test results and coverage report', size: '486 KB', kind: 'report' },
            { name: 'Live demo', description: 'api-demo.gigly.test', kind: 'link', url: '#' },
            { name: 'Repository', description: 'git.gigly.test/tl-3158/backend-microservices', kind: 'repo', url: '#' },
          ],
        },
      ],
    },
  ],
}

export function createSeed(): ClientState {
  const candidates: Record<string, Candidate[]> = {
    'PRJ-104': rankCandidates(backend),
    'PRJ-112': rankCandidates(ecommerce),
    'PRJ-118': rankCandidates(analytics),
    'PRJ-090': rankCandidates(profileSite),
  }

  const invitations: Invitation[] = [
    { id: 'INV-201', projectId: 'PRJ-104', candidateId: 'TL-3158', status: 'accepted', sentAt: ago(22), respondedAt: ago(21), message: '' },
    { id: 'INV-301', projectId: 'PRJ-118', candidateId: 'TL-7742', status: 'accepted', sentAt: ago(4), respondedAt: ago(3), message: '' },
    { id: 'INV-302', projectId: 'PRJ-118', candidateId: 'TL-9302', status: 'declined', sentAt: ago(4), respondedAt: ago(3.5), message: '' },
    { id: 'INV-101', projectId: 'PRJ-090', candidateId: 'TL-6630', status: 'accepted', sentAt: ago(73), respondedAt: ago(72), message: '' },
  ]

  return {
    user: { firstName: 'Alex', company: 'Rumah Rapi', initials: 'AL' },
    projects: [ecommerce, backend, analytics, profileSite],
    candidates,
    invitations,
    contracts: [backendContract],
    wallet: {
      address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      network: 'Hardhat Local Network',
      balance: 25_000,
      locked: 9_000,
      spent: 6_000,
      refunded: 0,
    },
    transactions: [
      { id: 'TX-3', type: 'release', amount: 6000, status: 'confirmed', hash: '0x44a91b228910c079f3b2f6ad39fa052532c56795b733da78a91ebe6a7139912a', projectId: 'PRJ-104', milestoneId: 'M1', label: 'Milestone 1 released', at: ago(5) },
      { id: 'TX-2', type: 'fund', amount: 15000, status: 'confirmed', hash: backendContract.fundingTxHash!, projectId: 'PRJ-104', label: 'Escrow funded · Backend Microservices', at: ago(16) },
      { id: 'TX-1', type: 'faucet', amount: 40000, status: 'confirmed', hash: '0x1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809', label: 'Demo tokens received', at: ago(30) },
    ],
    activity: [
      { id: 'A6', at: new Date(Date.now() - 34 * 3_600_000).toISOString(), text: 'TL-3158 submitted Milestone 2 for review', projectId: 'PRJ-104', tone: 'warning' },
      { id: 'A5', at: ago(1), text: `AI matching found ${candidates['PRJ-112'].length} candidates for E-commerce Website Development`, projectId: 'PRJ-112', tone: 'brand' },
      { id: 'A4', at: ago(3), text: 'TL-7742 accepted your invitation — identity revealed', projectId: 'PRJ-118', tone: 'success' },
      { id: 'A3', at: ago(5), text: 'You released 6,000 SIM-IDR for Milestone 1', projectId: 'PRJ-104', tone: 'success' },
      { id: 'A2', at: ago(16), text: 'Escrow locked: 15,000 SIM-IDR', projectId: 'PRJ-104', tone: 'neutral' },
    ],
    notifications: [
      { id: 'N3', at: new Date(Date.now() - 34 * 3_600_000).toISOString(), title: 'Milestone 2 is ready for review', body: 'Backend Microservices & API Integration', href: '/client/projects/PRJ-104/milestones/M2/review', read: false },
      { id: 'N2', at: ago(1), title: 'Your matches are ready', body: 'E-commerce Website Development', href: '/client/projects/PRJ-112/matches', read: false },
      { id: 'N1', at: ago(3), title: 'Invitation accepted', body: 'Sales Analytics Dashboard — create the contract', href: '/client/projects/PRJ-118/invitations', read: false },
    ],
  }
}
