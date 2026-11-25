import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InvitationStatus } from '../types/domain'
import { mockProfileEnabled } from './freelancerProfile'
import { decideDemo, demoRecipient, useDemoWorkspace } from './demoWorkspace'

export interface ReceivedInvitation {
  id: string | number
  status: InvitationStatus
  created_at: string
  client: { name: string }
  project: { title: string; category: string; description: string; required_skills: string[]; preferred_skills: string[];
    budget_idr: number | null; expected_start_at: string | null; expected_end_at: string | null }
  match_score: number | null
  match_explanation: string | null
  message: string | null
  allowed_actions: string[]
  evidence?: string
  milestones?: number
}
type Decision = 'accepted' | 'declined'
const endpoint = (import.meta.env.VITE_API_BASE_URL || '/api/v1') + '/invitations'
/** true = kotak undangan memakai data demo; false = undangan asli dari backend (VITE_INVITATIONS_API=true). */
export const demoInbox = mockProfileEnabled && import.meta.env.VITE_INVITATIONS_API !== 'true'
async function request(path: string, token: string, signal: AbortSignal, decision?: Decision) {
  const response = await fetch(endpoint + path, { signal, method: decision ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + token, ...(decision && { 'Content-Type': 'application/json' }) },
    body: decision ? JSON.stringify({ decision }) : undefined })
  if (!response.ok) throw new Error(response.status === 409 ? 'Invitation status changed. Review the latest status.' :
    response.status === 404 || response.status === 403 ? 'This invitation is unavailable.' : 'Unable to reach invitations. Please retry.')
  return response.json()
}

async function listAll(token: string, signal: AbortSignal) {
  const result: ReceivedInvitation[] = []
  for (let page = 1; ; page++) {
    const { data, meta } = await request('?page=' + page + '&page_size=50', token, signal)
    if (!Array.isArray(data) || !Number.isInteger(meta?.total)) throw new Error('Invalid invitation list.')
    result.push(...data)
    if (result.length >= meta.total || !data.length) return result
  }
}

export function useReceivedInvitations(token: string, id?: string) {
  const workspace = useDemoWorkspace(demoInbox)
  const demo = useMemo(() => workspace?.invitations.filter(i => i.candidateId === demoRecipient).flatMap(i => {
    const p = workspace.projects.find(p => p.id === i.projectId)
    if (!p) return []
    const c = i.candidateSnapshot ?? workspace.candidates[p.id]?.find(c => c.id === demoRecipient)
    const contract = workspace.contracts.find(c => c.projectId === p.id && c.candidateId === i.candidateId)
    return [{ id: i.id, status: i.status, created_at: i.sentAt, client: { name: workspace.user.company },
      project: { title: p.title, category: p.category, description: p.description, budget_idr: p.budgetIdr,
        expected_start_at: p.startDate, expected_end_at: p.endDate, required_skills: p.requiredSkills, preferred_skills: p.preferredSkills },
      match_score: c?.score ?? null, match_explanation: c?.reasons.join(' ') || null, message: i.message,
      evidence: i.portfolioExcerpt ?? c?.portfolio[0]?.summary, milestones: contract?.milestones.length,
      allowed_actions: i.status === 'pending' ? ['accept', 'decline', 'message'] : i.status === 'accepted' ? ['message'] : [],
    } satisfies ReceivedInvitation]
  }).sort((a,b) => b.created_at.localeCompare(a.created_at)), [workspace])
  const [rows, setRows] = useState<ReceivedInvitation[]>()
  const [detail, setDetail] = useState<ReceivedInvitation>()
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const retry = useCallback(() => setVersion(v => v + 1), [])
  useEffect(() => {
    if (demoInbox) return
    const controller = new AbortController()
    setError(''); setDetail(undefined)
    const pending = id ? request('/' + encodeURIComponent(id), token, controller.signal).then(({ data }) => {
      if (String(data?.id) !== id) throw new Error('This invitation is unavailable.')
      if (!controller.signal.aborted) setDetail(data)
    }) : listAll(token, controller.signal).then(data => { if (!controller.signal.aborted) setRows(data) })
    pending.catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [id, token, version])
  async function respond(decision: Decision, signal: AbortSignal) {
    if (!id) return
    if (demoInbox) return decideDemo(id, decision, demoRecipient)
    try {
      const { data } = await request('/' + encodeURIComponent(id) + '/respond', token, signal, decision)
      if (String(data?.id) !== id || data.status !== decision) throw new Error('Could not confirm the response.')
      if (!signal.aborted) { setDetail(data); setRows(prev => prev?.map(i => String(i.id) === id ? data : i)) }
    } catch (e) { if (!signal.aborted) retry(); throw e }
  }
  const list = demo ?? rows
  const item = demo ? demo.find(i => i.id === id) : String(detail?.id) === id ? detail : undefined
  return { list, item, error: demo && id && !item ? 'This invitation is unavailable.' : error, respond, retry }
}
