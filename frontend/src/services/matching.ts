import { catalog, profileSignature, type FreelancerProfile } from './freelancerProfile'
import type { Candidate, ExperienceLevel, PortfolioEvidence, Project, ScoreBreakdown } from '../types/domain'

/**
 * Local stand-in for POST /api/v1/matching/recommend.
 * The real service strips identity attributes before ranking and adds them back afterwards;
 * here the pool already keeps identity in a separate field that the scorer never reads.
 */

interface TalentProfile {
  estimatedProjectRate?: number
  handle: string
  headline: string
  skills: string[]
  industries: string[]
  experienceYears: number
  availability: string
  availabilityScore: number
  availableNow: boolean
  dailyRateIdr: number
  about: string
  portfolio: PortfolioEvidence[]
  completedProjects: number
  onTimeRate: number | null
  identity: Candidate['identity']
}

const POOL: TalentProfile[] = [
  {
    handle: 'TL-3158',
    headline: 'Backend & cloud developer',
    skills: ['FastAPI', 'Python', 'PostgreSQL', 'Docker', 'Redis', 'Linux', 'CI/CD', 'OpenAPI'],
    industries: ['fintech', 'logistics'],
    experienceYears: 4,
    availability: 'Within 1 week',
    availabilityScore: 80,
    availableNow: false,
    dailyRateIdr: 450_000,
    about:
      'Builds REST and event-driven services in Python. Most recent work: payment microservices with FastAPI, PostgreSQL and Redis, deployed with Docker on a managed cloud.',
    portfolio: [
      { title: 'Payment service platform', summary: 'Four FastAPI services behind a gateway, PostgreSQL per service, Redis queues.', stack: ['FastAPI', 'PostgreSQL', 'Redis', 'Docker'], verified: true },
      { title: 'Inventory API', summary: 'Stock and warehouse API with automated CI/CD deployment.', stack: ['FastAPI', 'PostgreSQL', 'CI/CD'], verified: true },
    ],
    completedProjects: 32,
    onTimeRate: 0.97,
    identity: { name: 'Rafi Pratama', role: 'Backend & Cloud Developer', location: 'Jakarta', initials: 'RP' },
  },
  {
    handle: 'TL-4069',
    headline: 'Backend developer',
    skills: ['FastAPI', 'Python', 'PostgreSQL', 'Docker', 'React'],
    industries: ['health'],
    experienceYears: 3,
    availability: 'Available now',
    availabilityScore: 100,
    availableNow: true,
    dailyRateIdr: 380_000,
    about: 'Backend developer working mainly in FastAPI. Built a health-claims verification platform as a set of small services with a React admin.',
    portfolio: [{ title: 'Order management API', summary: 'Order and invoice API, containerised for staging.', stack: ['FastAPI', 'PostgreSQL', 'Docker'], verified: true }],
    completedProjects: 14,
    onTimeRate: 0.93,
    identity: { name: 'Nadia Putri', role: 'Backend Developer', location: 'Bandung', initials: 'NP' },
  },
  {
    handle: 'TL-2207',
    headline: 'Full-stack web developer',
    skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Stripe', 'Midtrans'],
    industries: ['e-commerce', 'retail', 'fashion'],
    experienceYears: 5,
    availability: 'Within 1 week',
    availabilityScore: 80,
    availableNow: false,
    dailyRateIdr: 520_000,
    about: 'Ships storefronts end to end: catalogue, cart, checkout and the admin behind them. Five years on React and Node, two of them on Next.js commerce builds.',
    portfolio: [
      { title: 'Fashion storefront', summary: 'Next.js storefront with Midtrans checkout and a product admin.', stack: ['Next.js', 'PostgreSQL', 'Midtrans'], verified: true },
      { title: 'Grocery ordering app', summary: 'Web ordering with slot booking and courier status.', stack: ['React', 'Node.js'], verified: false },
    ],
    completedProjects: 41,
    onTimeRate: 0.95,
    identity: { name: 'Arif Wijaya', role: 'Full-stack Developer', location: 'Surabaya', initials: 'AW' },
  },
  {
    handle: 'TL-5521',
    headline: 'Web developer',
    skills: ['React', 'Node.js', 'JavaScript', 'MySQL', 'Express'],
    industries: ['retail'],
    experienceYears: 3,
    availability: 'Available now',
    availabilityScore: 100,
    availableNow: true,
    dailyRateIdr: 300_000,
    about: 'Builds web apps for small retailers: product catalogues, order forms and simple dashboards.',
    portfolio: [{ title: 'Retail catalogue site', summary: 'Product catalogue with WhatsApp ordering for a chain of shops.', stack: ['React', 'Node.js', 'MySQL'], verified: true }],
    completedProjects: 19,
    onTimeRate: 0.9,
    identity: { name: 'Jordan Halim', role: 'Web Developer', location: 'Yogyakarta', initials: 'JH' },
  },
  {
    handle: 'TL-6630',
    headline: 'Frontend developer',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'Figma', 'Vite'],
    industries: ['saas'],
    experienceYears: 2,
    availability: 'Within 2 weeks',
    availabilityScore: 55,
    availableNow: false,
    dailyRateIdr: 280_000,
    about: 'Turns Figma files into accessible React interfaces. Recent work on SaaS dashboards and design-system components.',
    portfolio: [{ title: 'SaaS billing dashboard', summary: 'Usage charts, invoices and plan switching in React.', stack: ['React', 'TypeScript', 'Tailwind CSS'], verified: true }],
    completedProjects: 9,
    onTimeRate: null,
    identity: { name: 'Taylor Santoso', role: 'Frontend Developer', location: 'Denpasar', initials: 'TS' },
  },
  {
    handle: 'TL-1873',
    headline: 'Junior backend developer',
    skills: ['FastAPI', 'Python', 'Docker', 'SQLite'],
    industries: ['retail'],
    experienceYears: 1,
    availability: 'Available now',
    availabilityScore: 100,
    availableNow: true,
    dailyRateIdr: 200_000,
    about: 'Writes REST APIs in Python. Built an inventory API for a small business and set up its Docker containers.',
    portfolio: [{ title: 'SME inventory API', summary: 'CRUD API with SQLite and a Docker setup.', stack: ['FastAPI', 'Docker'], verified: false }],
    completedProjects: 4,
    onTimeRate: null,
    identity: { name: 'Dimas Arya', role: 'Backend Developer', location: 'Malang', initials: 'DA' },
  },
  {
    handle: 'TL-7742',
    headline: 'Data engineer & dashboard developer',
    skills: ['Python', 'PostgreSQL', 'dbt', 'Metabase', 'React', 'Pandas', 'Airflow'],
    industries: ['retail', 'saas'],
    experienceYears: 4,
    availability: 'Within 1 week',
    availabilityScore: 80,
    availableNow: false,
    dailyRateIdr: 480_000,
    about: 'Builds the pipeline and the dashboard on top: Airflow and dbt into PostgreSQL, then Metabase or a custom React view for sales teams.',
    portfolio: [{ title: 'Sales analytics stack', summary: 'Daily sales pipeline and a React dashboard with regional drill-down.', stack: ['Airflow', 'dbt', 'PostgreSQL', 'React'], verified: true }],
    completedProjects: 22,
    onTimeRate: 0.96,
    identity: { name: 'Sekar Ayu', role: 'Data Engineer', location: 'Jakarta', initials: 'SA' },
  },
  {
    handle: 'TL-8015',
    headline: 'Mobile developer',
    skills: ['Flutter', 'Dart', 'Firebase', 'REST APIs', 'Kotlin'],
    industries: ['logistics', 'e-commerce'],
    experienceYears: 4,
    availability: 'Available now',
    availabilityScore: 100,
    availableNow: true,
    dailyRateIdr: 420_000,
    about: 'Flutter apps for delivery and commerce: courier tracking, push notifications and offline-first order lists.',
    portfolio: [{ title: 'Courier tracking app', summary: 'Flutter driver app with live location and proof of delivery.', stack: ['Flutter', 'Firebase'], verified: true }],
    completedProjects: 27,
    onTimeRate: 0.94,
    identity: { name: 'Bima Saputra', role: 'Mobile Developer', location: 'Medan', initials: 'BS' },
  },
  {
    handle: 'TL-9302',
    headline: 'Full-stack developer',
    skills: ['Node.js', 'Express', 'MongoDB', 'React', 'Docker', 'PostgreSQL'],
    industries: ['fintech'],
    experienceYears: 3,
    availability: 'Within 1 week',
    availabilityScore: 80,
    availableNow: false,
    dailyRateIdr: 350_000,
    about: 'Node and React developer. Built internal tools for a lending startup, including a loan review queue and audit log.',
    portfolio: [{ title: 'Loan review tool', summary: 'Queue, document viewer and audit log for credit analysts.', stack: ['Node.js', 'React', 'PostgreSQL'], verified: true }],
    completedProjects: 16,
    onTimeRate: 0.91,
    identity: { name: 'Kirana Dewi', role: 'Full-stack Developer', location: 'Semarang', initials: 'KD' },
  },
]

const WEIGHTS: ScoreBreakdown = { skills: 0.3, experience: 0.25, portfolio: 0.2, budget: 0.1, availability: 0.1, reliability: 0.05 }
const LEVEL_YEARS: Record<ExperienceLevel, number> = { junior: 1, mid: 3, senior: 5 }

const norm = (s: string) => s.trim().toLowerCase()
const has = (list: string[], skill: string) => list.some((x) => norm(x) === norm(skill))

function durationDays(p: Pick<Project, 'startDate' | 'endDate'>) {
  return Math.max(7, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86_400_000))
}

function scoreProfile(t: TalentProfile, p: Project, rank: number): Candidate {
  const required = p.requiredSkills
  const matched = required.filter((s) => has(t.skills, s))
  const missing = required.filter((s) => !has(t.skills, s))
  const preferredMet = p.preferredSkills.filter((s) => has(t.skills, s))

  const skills = required.length ? (matched.length / required.length) * 100 : 70
  const industryHit = p.industry ? t.industries.some((i) => norm(p.industry).includes(norm(i)) || norm(i).includes(norm(p.industry))) : false
  const experience = Math.min(85, (t.experienceYears / LEVEL_YEARS[p.experienceLevel]) * 85) + (industryHit ? 15 : 0)
  const relevantWork = t.portfolio.filter((w) => w.stack.some((s) => has(required, s) || has(p.preferredSkills, s)))
  const portfolio = t.portfolio.length ? (relevantWork.length / t.portfolio.length) * 85 + (relevantWork.some((w) => w.verified) ? 15 : 0) : 30

  const days = durationDays(p)
  const estimate = t.estimatedProjectRate ?? Math.round((t.dailyRateIdr * days * 0.7) / 500_000) * 500_000
  const overBy = (estimate - p.budgetIdr) / p.budgetIdr
  const budget = overBy <= 0 ? 100 : Math.max(0, 100 - overBy * (p.budgetFlexible ? 100 : 200)) // flexible budgets halve the penalty
  const reliability = t.onTimeRate === null ? 70 : t.onTimeRate * 100 // no history is neutral, not a penalty

  const breakdown: ScoreBreakdown = {
    skills: Math.round(skills),
    experience: Math.round(experience),
    portfolio: Math.round(portfolio),
    budget: Math.round(budget),
    availability: t.availabilityScore,
    reliability: Math.round(reliability),
  }
  const score = Math.round(
    (Object.keys(WEIGHTS) as Array<keyof ScoreBreakdown>).reduce((sum, k) => sum + breakdown[k] * WEIGHTS[k], 0),
  )

  const reasons: string[] = []
  if (missing.length === 0 && required.length) reasons.push(`Has every required skill (${matched.join(', ')}).`)
  else if (matched.length) reasons.push(`Has ${matched.length} of ${required.length} required skills (${matched.join(', ')}).`)
  if (relevantWork.length) reasons.push(`${relevantWork.length} portfolio project${relevantWork.length > 1 ? 's' : ''} using the same stack: ${relevantWork.map((w) => w.title).join(', ')}.`)
  if (industryHit) reasons.push(`Previous work in ${p.industry}.`)
  if (preferredMet.length) reasons.push(`Also covers preferred: ${preferredMet.join(', ')}.`)
  if (estimate <= p.budgetIdr) reasons.push('Estimated rate fits your budget.')

  const gaps: string[] = []
  if (missing.length) gaps.push(`No evidence of ${missing.join(', ')} in profile or portfolio.`)
  if (p.industry && !industryHit) gaps.push(`${capitalise(p.industry)} experience not recorded.`)
  if (relevantWork.length && !relevantWork.some((w) => w.verified)) gaps.push('Portfolio evidence not yet verified.')
  if (estimate > p.budgetIdr) gaps.push(`Estimate is ${Math.round(((estimate - p.budgetIdr) / p.budgetIdr) * 100)}% over your budget.`)
  if (t.onTimeRate === null) gaps.push('New on Gigly — no delivery history yet.')

  return {
    id: t.handle,
    projectId: p.id,
    rank,
    score,
    breakdown,
    headline: t.headline,
    experienceYears: t.experienceYears,
    availability: t.availability,
    availableNow: t.availableNow,
    estimateIdr: estimate,
    matchedSkills: matched,
    missingSkills: missing,
    eligible: missing.length === 0,
    reasons,
    gaps,
    about: t.about,
    portfolio: t.portfolio,
    completedProjects: t.completedProjects,
    onTimeRate: t.onTimeRate,
    identity: t.identity,
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Rank the pool for a project; keep those with at least one required skill and score ≥ 50. */
export function rankCandidates(project: Project, limit = 6, profile?: FreelancerProfile): Candidate[] {
  return POOL.map(t => {
    if (!profile || t.handle !== 'TL-3158') return scoreProfile(t, project, 0)
    const current = {
      ...t, skills: profile.skills, about: profile.experience, estimatedProjectRate: profile.estimated_project_rate,
      portfolio: [{ title: 'Portfolio', summary: profile.portfolio, verified: false,
        stack: catalog.filter(skill => profile.portfolio.toLowerCase().includes(skill.toLowerCase())) }],
    }
    return { ...scoreProfile(current, project, 0), profileSignature: profileSignature(profile) }
  })
    .filter((c) => c.matchedSkills.length > 0 && c.score >= 50)
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)
    .slice(0, limit)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

export const SKILL_SUGGESTIONS = Array.from(new Set(POOL.flatMap((t) => t.skills))).sort()

export const CATEGORIES = ['Web Development', 'Backend & API', 'Mobile App', 'Data & Analytics', 'UI/UX Design', 'DevOps & Cloud']

const CATEGORY_SKILLS: Record<string, string[]> = {
  'Web Development': ['React', 'Next.js', 'TypeScript', 'Node.js', 'Tailwind CSS', 'PostgreSQL', 'Midtrans'],
  'Backend & API': ['FastAPI', 'Python', 'PostgreSQL', 'Docker', 'Redis', 'Node.js', 'OpenAPI'],
  'Mobile App': ['Flutter', 'Dart', 'Firebase', 'Kotlin', 'REST APIs'],
  'Data & Analytics': ['Python', 'PostgreSQL', 'dbt', 'Airflow', 'Pandas', 'Metabase'],
  'UI/UX Design': ['Figma', 'React', 'Tailwind CSS'],
  'DevOps & Cloud': ['Docker', 'CI/CD', 'Linux'],
}

/** Skill suggestions with the category's usual stack first. */
export function suggestSkills(category: string): string[] {
  const first = CATEGORY_SKILLS[category] ?? []
  return [...first, ...SKILL_SUGGESTIONS.filter((s) => !first.includes(s))]
}
