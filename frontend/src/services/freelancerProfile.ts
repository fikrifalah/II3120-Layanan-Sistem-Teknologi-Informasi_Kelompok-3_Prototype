export const skillGroups = {
  'Programming Languages': ['Python', 'JavaScript', 'TypeScript', 'Java', 'PHP'],
  'Frontend Development': ['HTML', 'CSS', 'React', 'Next.js'],
  'Backend Development': ['Node.js', 'FastAPI', 'Django', 'Laravel'],
  Database: ['SQL', 'PostgreSQL', 'MySQL'],
  'DevOps & Infrastructure': ['Docker', 'Git'],
  'Data Analytics & AI': ['Pandas', 'Scikit-learn'],
}
export const catalog = Object.values(skillGroups).flat()

export interface ProfileFields {
  portfolio: string
  experience: string
  skills: string[]
  estimated_project_rate: number
}
export interface FreelancerProfile extends ProfileFields { id: number; name: string }

const seed: FreelancerProfile = {
  id: 21, name: 'Rafi Pratama',
  portfolio: 'Developed a REST API for an inventory management system using FastAPI, PostgreSQL, and Docker.',
  experience: '3 years of experience in backend development, database design, and API integration.',
  skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'], estimated_project_rate: 13500000,
}
export function profileSignature(profile: ProfileFields = seed) {
  return JSON.stringify([profile.portfolio, profile.experience, [...profile.skills].sort(), profile.estimated_project_rate])
}
const storageKey = 'gigly.demo.freelancer.profile.21'
export const mockProfileEnabled = import.meta.env.VITE_USE_MOCK === 'true'
const endpoint = (import.meta.env.VITE_API_BASE_URL || '/api/v1') + '/freelancer/profile'

function readShape(value: FreelancerProfile): FreelancerProfile {
  if (!value || !Number.isSafeInteger(value.id) || typeof value.name !== 'string' ||
      typeof value.portfolio !== 'string' || typeof value.experience !== 'string' ||
      !Array.isArray(value.skills) || !value.skills.every(s => typeof s === 'string') ||
      typeof value.estimated_project_rate !== 'number') throw new Error('Invalid profile response.')
  return value
}

export function readDemoProfile(): FreelancerProfile {
  const raw = localStorage.getItem(storageKey)
  return raw === null ? seed : readShape(JSON.parse(raw))
}

export function profileError(profile: ProfileFields): string {
  if (!profile.portfolio.trim() || profile.portfolio.length > 5000) return 'Enter a portfolio description of up to 5,000 characters.'
  if (!profile.experience.trim() || profile.experience.length > 5000) return 'Enter an experience description of up to 5,000 characters.'
  if (!profile.skills.length || !profile.skills.every(s => catalog.includes(s)) || new Set(profile.skills).size !== profile.skills.length) return 'Select at least one skill from the catalog.'
  if (!Number.isSafeInteger(profile.estimated_project_rate) || profile.estimated_project_rate <= 0) return 'Enter a positive whole number in IDR.'
  return ''
}

export async function requestProfile(token: string, signal: AbortSignal, patch?: Partial<ProfileFields>): Promise<FreelancerProfile> {
  if (mockProfileEnabled) {
    const current = readDemoProfile()
    if (!patch) return current
    const updated = { ...current, ...patch }
    const error = profileError(updated)
    if (error) throw new Error(error)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    return updated
  }
  const response = await fetch(endpoint, {
    method: patch ? 'PATCH' : 'GET', signal,
    headers: { Authorization: 'Bearer ' + token, ...(patch && { 'Content-Type': 'application/json' }) },
    body: patch ? JSON.stringify(patch) : undefined,
  })
  if (!response.ok) throw new Error(response.status === 401 ? 'Session expired. Please log in again.' : 'Profile request failed. Please retry.')
  return readShape((await response.json()).data)
}
