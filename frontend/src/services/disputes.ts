const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export interface DisputePerson {
  id: number
  name: string
  role: string
}

export interface DisputeEvidence {
  id: number
  filename: string
  url: string
  sha256: string
  size_bytes: number
  uploaded_by: DisputePerson | null
  uploaded_at: string
}

export interface DisputeCase {
  id: number
  status: 'open' | 'resolved'
  reason: string
  created_at: string
  raise_transaction_hash: string | null
  raised_by: DisputePerson | null
  assigned_arbiter: DisputePerson | null
  client: DisputePerson | null
  freelancer: DisputePerson | null
  contract: { id: number; onchain_contract_id: number | null; job_id: number; job_title: string | null }
  milestone: {
    id: number
    index: number
    title: string
    amount: number
    status: string
    deliverable_url: string | null
    deliverable_hash: string | null
  }
  evidence: DisputeEvidence[]
  verdict: null | {
    action: 'RELEASE' | 'REFUND' | 'SPLIT'
    freelancer_share_percentage: number
    client_refund_percentage: number
    reasoning: string
    freelancer_payout: number
    client_refund: number
    /** REFUND mengakhiri proyek: milestone lain yang ikut hangus beserta dana yang kembali ke client. */
    voided_milestones?: { sequence: number; title: string; amount: number }[]
    voided_refund?: number
    transaction_hash: string | null
    resolved_at: string | null
  }
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiBase + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    let detail = `Request failed (${response.status}). Please retry.`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // Keep the HTTP error visible when the server does not return JSON.
    }
    if (response.status === 401) detail = 'Your session expired. Please sign in again.'
    throw new Error(detail)
  }
  try {
    return await response.json() as T
  } catch {
    throw new Error('The dispute service returned an invalid response. Check VITE_API_BASE_URL and backend availability.')
  }
}

export async function listDisputes(token: string): Promise<DisputeCase[]> {
  const result = await request<{ data: DisputeCase[] }>('/disputes', token)
  return result.data
}

export async function submitVerdict(
  token: string,
  disputeId: number,
  verdictAction: 'RELEASE' | 'REFUND' | 'SPLIT',
  freelancerSharePercentage: number,
  verdictReasoning: string,
): Promise<DisputeCase> {
  const body = {
    verdict_action: verdictAction,
    freelancer_share_percentage: verdictAction === 'SPLIT' ? freelancerSharePercentage : undefined,
    verdict_reasoning: verdictReasoning,
  }
  const result = await request<{ data: DisputeCase }>(`/disputes/${disputeId}/verdict`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return result.data
}

export function evidenceHref(path: string): string {
  const base = new URL(apiBase, window.location.origin)
  return new URL(path, base.origin).toString()
}
