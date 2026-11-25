/** Client-side route helpers. Keeps URL building in one place for the Client views. */
export const CLIENT_BASE = '/client'

export const DEMO_JOB_ID = 'JOB-2026-089'
export const DEMO_PROJECT_ID = 'PRJ-2026-104'

export const paths = {
  dashboard: CLIENT_BASE,
  postJob: `${CLIENT_BASE}/jobs/new`,
  recommendations: (jobId = DEMO_JOB_ID) => `${CLIENT_BASE}/jobs/${jobId}/recommendations`,
  contract: (projectId = DEMO_PROJECT_ID) => `${CLIENT_BASE}/contracts/${projectId}`,
  review: (projectId = DEMO_PROJECT_ID, milestoneId = 2) =>
    `${CLIENT_BASE}/contracts/${projectId}/milestones/${milestoneId}`,
  contractDraft: (jobId = DEMO_JOB_ID) => `${CLIENT_BASE}/jobs/${jobId}/contract`,
}
