import { DEMO_CONTRACT, DEMO_RECOMMENDATIONS } from './mock.js'

/**
 * Thin API layer for the Client views.
 * Mock mode is on by default so the UI works without the backend.
 * Set VITE_USE_MOCK=false in frontend/.env to call the real FastAPI service at VITE_API_BASE_URL.
 */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

async function post(path, body, signal) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}

/**
 * POST /matching/recommend
 * The backend builds the anonymised candidate pool itself, so the client only sends the job.
 * Returns the `recommendations` array from the response.
 */
export async function fetchRecommendations(job, { signal } = {}) {
  if (USE_MOCK) {
    await wait(1400, signal)
    return DEMO_RECOMMENDATIONS
  }
  const data = await post(
    '/matching/recommend',
    {
      job_id: job.job_id,
      job_title: typeof job.job_title === 'string' ? job.job_title : (job.job_title?.id ?? ''),
      required_skills: job.required_skills,
      budget_idr: job.budget, // TODO: convert SIM-IDR to the IDR equivalent once the team confirms the ratio
    },
    signal,
  )
  return data.recommendations
}

export async function fetchContract(projectId, { signal } = {}) {
  if (USE_MOCK) {
    await wait(250, signal)
    return { ...DEMO_CONTRACT, project_id: projectId ?? DEMO_CONTRACT.project_id }
  }
  // No GET endpoint is specified in the API spec yet; wire this once the backend exposes one.
  throw new Error('GET /contracts/{id} is not available yet')
}
