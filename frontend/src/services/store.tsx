import { mockProfileEnabled, profileSignature, readDemoProfile } from './freelancerProfile'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import type { ActivityItem, Candidate, Contract, ContractStatus, Milestone, Project, ProjectStatus, Transaction } from '../types/domain'
import { fakeHash, formatSim, uid } from '../lib/format'
import {
  cancelInvitationApi,
  fetchCandidates,
  fetchSentInvitations,
  invitationsApiEnabled,
  matchingApiEnabled,
  rankCandidates,
  revealedIdentity,
  sendInvitationApi,
} from './matching'
import { demoRecipient, demoWorkspace, decideDemo, freshWorkspace, updateDemo, useDemoWorkspace } from './demoWorkspace'
import { type ClientState } from './seed'
import {
  applyRemote,
  approveMilestoneApi,
  closeContractApi,
  contractsApiEnabled,
  createContractApi,
  faucetApi,
  fetchContractApi,
  fetchVerdictApi,
  fetchWalletApi,
  lockEscrowApi,
  raiseDisputeApi,
  requestRevisionApi,
  walletFrom,
} from './clientContracts'

/**
 * Client workspace state for the prototype. Every action here stands in for a backend call
 * (Master Plan §16.1); the delays imitate network and chain confirmation time.
 * Counterpart behaviour (a freelancer accepting, approving or submitting) is simulated with timers.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))


export type NewProjectInput = Omit<Project, 'id' | 'status' | 'createdAt'>

interface Actions {
  createProject: (input: NewProjectInput) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  runMatching: (projectId: string) => Promise<Candidate[]>
  sendInvitation: (projectId: string, candidateId: string, message: string) => Promise<void>
  cancelInvitation: (invitationId: string) => Promise<void>
  createContract: (projectId: string, candidateId: string) => string
  saveContract: (contract: Contract) => void
  sendContractForApproval: (contractId: string) => Promise<void>
  fundContract: (contractId: string) => Promise<Transaction>
  addDemoTokens: () => Promise<void>
  approveMilestone: (contractId: string, milestoneId: string) => Promise<Transaction>
  /** Client menolak hasil dan meminta perbaikan; dana tetap terkunci dan timer review berhenti. */
  requestRevision: (contractId: string, milestoneId: string, note: string) => Promise<void>
  raiseDispute: (contractId: string, milestoneId: string, reason: string) => Promise<void>
  markAllRead: () => void
  resetDemo: () => void
}

interface Store extends ClientState, Actions {
  getProject: (id?: string) => Project | undefined
  getContract: (id?: string) => Contract | undefined
  getCandidate: (projectId: string, candidateId?: string) => Candidate | undefined
  /** True once this candidate accepted an invitation for the project. Identity is shown only then. */
  isRevealed: (projectId: string, candidateId: string) => boolean
  displayName: (projectId: string, candidateId: string) => string
}

const StoreContext = createContext<Store | null>(null)

/** Status proyek client yang mengikuti status kontrak di backend. */
const PROJECT_STATUS: Partial<Record<ContractStatus, ProjectStatus>> = { awaiting_funding: 'funding', active: 'active', closed: 'completed' }

export function ClientStoreProvider({ children }: { children: ReactNode }) {
  const state = useDemoWorkspace()!
  const stateRef = useRef(state)
  stateRef.current = state

  const update = updateDemo

  const log = useCallback(
    (text: string, tone: ActivityItem['tone'], projectId?: string, notify?: { title: string; href: string; body?: string }) =>
      update((s) => ({
        ...s,
        activity: [{ id: uid('A'), at: new Date().toISOString(), text, projectId, tone }, ...s.activity].slice(0, 40),
        notifications: notify
          ? [{ id: uid('N'), at: new Date().toISOString(), title: notify.title, body: notify.body ?? '', href: notify.href, read: false }, ...s.notifications]
          : s.notifications,
      })),
    [update],
  )

  // Mode backend: tiap 5 detik cek undangan yang masih pending. Bila freelancer menerima,
  // backend mengirim identitasnya -> nama ditampilkan (kandidat "terbuka"), sama seperti alur demo.
  useEffect(() => {
    if (!invitationsApiEnabled) return
    const timer = window.setInterval(async () => {
      const s = stateRef.current
      const jobs = new Map<number, string>() // backendJobId -> projectId
      for (const inv of s.invitations) {
        const jobId = s.projects.find((p) => p.id === inv.projectId)?.backendJobId
        if (inv.backendId && inv.status === 'pending' && jobId) jobs.set(jobId, inv.projectId)
      }
      for (const [jobId, projectId] of jobs) {
        const rows = await fetchSentInvitations(jobId).catch(() => [])
        for (const row of rows) {
          const inv = stateRef.current.invitations.find((i) => i.backendId === row.id)
          if (!inv || inv.status === row.status) continue
          const identity = row.identity ? revealedIdentity(row.identity) : undefined
          update((st) => ({
            ...st,
            invitations: st.invitations.map((i) => i.id !== inv.id ? i : {
              ...i,
              status: row.status,
              respondedAt: row.responded_at ?? undefined,
              candidateSnapshot: identity && i.candidateSnapshot ? { ...i.candidateSnapshot, identity } : i.candidateSnapshot,
            }),
            candidates: identity
              ? { ...st.candidates, [projectId]: (st.candidates[projectId] ?? []).map((c) => (c.id === inv.candidateId ? { ...c, identity } : c)) }
              : st.candidates,
          }))
          const title = stateRef.current.projects.find((p) => p.id === projectId)?.title
          const href = `/client/projects/${projectId}/invitations`
          if (row.status === 'accepted' && identity) {
            log(`${inv.candidateId} accepted your invitation — this is ${identity.name}`, 'success', projectId, { title: `${identity.name} accepted your invitation`, body: title, href })
          } else if (row.status === 'declined') {
            log(`${inv.candidateId} declined your invitation`, 'warning', projectId, { title: 'Invitation declined', body: title, href })
          }
        }
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [log, update])

  const patchProject = useCallback(
    (id: string, patch: Partial<Project>) => update((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    [update],
  )

  const patchContract = useCallback(
    (id: string, fn: (c: Contract) => Contract) => update((s) => ({ ...s, contracts: s.contracts.map((c) => (c.id === id ? fn(c) : c)) })),
    [update],
  )

  const patchMilestone = useCallback(
    (contractId: string, milestoneId: string, patch: Partial<Milestone>) =>
      patchContract(contractId, (c) => ({ ...c, milestones: c.milestones.map((m) => (m.id === milestoneId ? { ...m, ...patch } : m)) })),
    [patchContract],
  )

  /** Mode backend: tarik status kontrak dari backend; beri notifikasi saat freelancer submit atau arbiter memutus. */
  const syncContract = useCallback(
    async (contractId: string) => {
      const local = demoWorkspace().contracts.find((c) => c.id === contractId)
      if (!local?.backendId) return
      let remote = await fetchContractApi(local.backendId)
      // Semua milestone selesai: tutup kontrak on-chain, sama seperti alur demo yang menutup otomatis.
      if (remote.status === 'active' && remote.milestones.every((m) => ['released', 'refunded', 'split'].includes(m.status))) {
        await closeContractApi(local.backendId)
        remote = await fetchContractApi(local.backendId)
      }
      let next = applyRemote(local, remote)
      const verdictTxs: Transaction[] = []
      for (const r of remote.milestones) {
        const m = next.milestones.find((x) => x.seq === r.sequence)
        const decided = m && r.dispute_id && ['released', 'refunded', 'split'].includes(r.status) && local.milestones.find((x) => x.seq === m.seq)?.status === 'disputed'
        if (!m || !r.dispute_id || !(decided || (m.status === 'split' && !m.settlement))) continue
        const verdict = await fetchVerdictApi(r.dispute_id)
        if (!verdict) continue
        const split = { freelancer: verdict.freelancer_payout, client: verdict.client_refund }
        next = { ...next, milestones: next.milestones.map((x) => (x.seq === m.seq ? { ...x, settlement: split } : x)) }
        const at = new Date().toISOString()
        if (split.freelancer) verdictTxs.push({ id: uid('TX'), type: 'release', amount: split.freelancer, status: 'confirmed', hash: verdict.transaction_hash, projectId: next.projectId, milestoneId: m.id, label: `Milestone ${m.seq} paid by arbiter verdict`, at })
        if (split.client) verdictTxs.push({ id: uid('TX'), type: 'refund', amount: split.client, status: 'confirmed', hash: verdict.transaction_hash, projectId: next.projectId, milestoneId: m.id, label: `Milestone ${m.seq} refunded by arbiter verdict`, at })
      }
      const latest = demoWorkspace().contracts.find((c) => c.id === contractId)
      if (!latest || JSON.stringify(next) === JSON.stringify(latest)) return
      update((s) => ({
        ...s,
        contracts: s.contracts.map((c) => (c.id === contractId ? next : c)),
        transactions: [...verdictTxs, ...s.transactions],
        projects: s.projects.map((p) =>
          p.id !== next.projectId
            ? p
            : { ...p, status: PROJECT_STATUS[next.status] ?? p.status }),
      }))
      const title = demoWorkspace().projects.find((p) => p.id === next.projectId)?.title
      const who = demoWorkspace().candidates[next.projectId]?.find((c) => c.id === next.candidateId)?.identity.name ?? next.candidateId
      if (latest.status === 'pending_approval' && next.status === 'awaiting_funding')
        log(`${who} approved contract v${next.version}`, 'success', next.projectId, {
          title: 'Contract approved - fund escrow to start', body: title, href: `/client/projects/${next.projectId}/fund`,
        })
      if (latest.status !== 'closed' && next.status === 'closed') log('All milestones settled. Contract closed on-chain.', 'success', next.projectId)
      for (const m of next.milestones) {
        const before = latest.milestones.find((x) => x.seq === m.seq)?.status
        if (before === m.status) continue
        if (m.status === 'under_review') {
          const again = before === 'revision_required'
          log(`${who} ${again ? 'resubmitted' : 'submitted'} Milestone ${m.seq}`, 'warning', next.projectId, {
            title: again ? `Revised Milestone ${m.seq} is ready for review` : `Milestone ${m.seq} is ready for review`, body: title, href: `/client/projects/${next.projectId}/milestones/${m.id}/review`,
          })
        } else if (before === 'revision_required' && m.status === 'disputed') {
          log(`${who} disputed your revision request on Milestone ${m.seq}; funds frozen`, 'danger', next.projectId, {
            title: `Milestone ${m.seq} is in dispute`, body: title, href: '/client/disputes',
          })
        } else if (before === 'disputed') {
          log(`Arbiter resolved the dispute on Milestone ${m.seq} (${m.status})`, 'brand', next.projectId, {
            title: `Dispute on Milestone ${m.seq} resolved`, body: title, href: `/client/projects/${next.projectId}`,
          })
        }
      }
    },
    [log, update],
  )

  const syncWallet = useCallback(async () => {
    const remote = await fetchWalletApi()
    update((s) => {
      const ms = s.contracts.filter((c) => c.backendId).flatMap((c) => c.milestones)
      const sum = (side: 'freelancer' | 'client') => ms.reduce((n, m) => n + (m.settlement?.[side] ?? 0), 0)
      const wallet = { ...walletFrom(remote, s.wallet), spent: sum('freelancer'), refunded: sum('client') }
      return JSON.stringify(wallet) === JSON.stringify(s.wallet) ? s : { ...s, wallet }
    })
  }, [update])

  useEffect(() => {
    if (!contractsApiEnabled) return
    const tick = () => {
      syncWallet().catch(() => undefined)
      for (const c of stateRef.current.contracts) if (c.backendId && c.status !== 'closed') syncContract(c.id).catch(() => undefined)
    }
    tick()
    const timer = window.setInterval(tick, 5000)
    return () => window.clearInterval(timer)
  }, [syncContract, syncWallet])

  /** Simulated freelancer: submits work on an in-progress milestone after a short delay. */
  const simulateSubmission = useCallback(
    (contractId: string, milestoneId: string, delay = 9000) => {
      setTimeout(() => {
        const c = stateRef.current.contracts.find((x) => x.id === contractId)
        const m = c?.milestones.find((x) => x.id === milestoneId)
        const due = m && ((m.status === 'in_progress' && !m.submissions.length) || m.status === 'revision_required')
        if (!c || c.candidateId === demoRecipient || !m || !due) return
        const version = `v${m.submissions.length + 1}.0`
        patchMilestone(contractId, milestoneId, {
          status: 'under_review',
          reviewDeadline: new Date(Date.now() + c.reviewDays * 86_400_000).toISOString(),
          submissions: [
            ...m.submissions,
            {
              version,
              submittedAt: new Date().toISOString(),
              notes: m.revisionNote ? 'Updated per your revision notes.' : 'First submission for this milestone.',
              files: [
                { name: `milestone-${m.seq}-${version}.zip`, description: `${m.title} — source and assets`, size: '12.4 MB', kind: 'archive' },
                { name: 'handover-notes.pdf', description: 'What changed and how to run it', size: '420 KB', kind: 'pdf' },
              ],
            },
          ],
        })
        const p = stateRef.current.projects.find((x) => x.id === c.projectId)
        log(`${c.candidateId} submitted Milestone ${m.seq} (${version})`, 'warning', c.projectId, {
          title: `Milestone ${m.seq} is ready for review`,
          body: p?.title,
          href: `/client/projects/${c.projectId}/milestones/${m.id}/review`,
        })
      }, delay)
    },
    [log, patchMilestone],
  )

  const actions = useMemo<Actions>(
    () => ({
      createProject(input) {
        const id = `PRJ-${Math.floor(200 + Math.random() * 700)}`
        update((s) => ({ ...s, projects: [{ ...input, id, status: 'draft', createdAt: new Date().toISOString() }, ...s.projects] }))
        return id
      },

      updateProject: patchProject,

      async runMatching(projectId) {
        const project = stateRef.current.projects.find((p) => p.id === projectId)
        if (!project) throw new Error('Project not found')
        let ranked: Candidate[]
        if (matchingApiEnabled) {
          // Backend AI matching asli; id job disimpan di proyek agar alias stabil saat diulang.
          ranked = await fetchCandidates(project, (jobId) => patchProject(projectId, { backendJobId: jobId }))
        } else {
          await wait(2600) // mock: meniru waktu tunggu jaringan
          ranked = rankCandidates(project, 6, mockProfileEnabled ? readDemoProfile() : undefined)
        }
        update((s) => ({ ...s, candidates: { ...s.candidates, [projectId]: ranked } }))
        if (project.status === 'draft' || project.status === 'matching') patchProject(projectId, { status: 'matching' })
        log(`AI matching ranked ${ranked.length} candidates for ${project.title}`, 'brand', projectId)
        return ranked
      },

      async sendInvitation(projectId, candidateId, message) {
        await navigator.locks.request('gigly-invitations', async () => {
          const latest = demoWorkspace()
          const candidate = latest.candidates[projectId]?.find(c => c.id === candidateId)
          if (!candidate?.eligible || !['matching', 'inviting'].includes(latest.projects.find(p => p.id === projectId)?.status ?? '')) throw new Error('An eligible match on an open project is required.')
          if (latest.invitations.some(i => i.projectId === projectId && i.candidateId === candidateId && i.status === 'pending')) throw new Error('Invitation already pending.')
          const profile = candidateId === demoRecipient && mockProfileEnabled ? readDemoProfile() : null
          if (profile && (profileSignature(profile) !== (candidate.profileSignature ?? profileSignature()) || !latest.projects.find(p => p.id === projectId)!.requiredSkills.every(s => profile.skills.includes(s)))) throw new Error('Profile changed. Run matching again.')
          // Mode backend: undangan dikirim ke freelancer asli lewat alias; balasannya diambil oleh sinkronisasi di bawah.
          const jobId = latest.projects.find(p => p.id === projectId)?.backendJobId
          const sent = invitationsApiEnabled && jobId ? await sendInvitationApi(jobId, candidate, message) : null
          const inv = { id: uid('INV'), backendId: sent?.id, candidateSnapshot: candidate, portfolioExcerpt: profile?.portfolio, projectId, candidateId, status: 'pending' as const, sentAt: new Date().toISOString(), message }
          update((s) => ({ ...s, invitations: [inv, ...s.invitations] }))
          const p = stateRef.current.projects.find((x) => x.id === projectId)
          if (p && (p.status === 'matching' || p.status === 'draft')) patchProject(projectId, { status: 'inviting' })
          log(`Invitation sent to ${candidateId}`, 'brand', projectId)

          if (candidateId === demoRecipient || sent) return // undangan asli dibalas freelancer sungguhan, bukan simulasi
          // Other candidates have no playable demo account.
          setTimeout(() => {
            const current = demoWorkspace().invitations.find((i) => i.id === inv.id)
            if (current?.status !== 'pending') return
            update((s) => ({
              ...s,
              invitations: s.invitations.map((i) => (i.id === inv.id ? { ...i, status: 'accepted', respondedAt: new Date().toISOString() } : i)),
            }))
            const name = stateRef.current.candidates[projectId]?.find((c) => c.id === candidateId)?.identity.name ?? candidateId
            log(`${candidateId} accepted your invitation — this is ${name}`, 'success', projectId, {
              title: `${name} accepted your invitation`,
              body: p?.title,
              href: `/client/projects/${projectId}/invitations`,
            })
          }, 6000)
        })
      },

      async cancelInvitation(invitationId) {
        const inv = stateRef.current.invitations.find((i) => i.id === invitationId)
        if (inv?.backendId) await cancelInvitationApi(inv.backendId) // batalkan juga di backend
        return decideDemo(invitationId, 'cancelled')
      },

      createContract(projectId, candidateId) {
        const existing = stateRef.current.contracts.find((c) => c.projectId === projectId && c.candidateId === candidateId)
        if (existing) return existing.id
        const p = stateRef.current.projects.find((x) => x.id === projectId)!
        const days = Math.max(7, Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86_400_000))
        const total = Math.round(p.budgetIdr / 1000 / 500) * 500 // demo conversion: Rp1,000 = 1 SIM-IDR
        const first = Math.round((total * 0.4) / 500) * 500
        const half = Math.ceil(p.deliverables.length / 2)
        const id = `CT-${projectId.split('-')[1]}`
        const contract: Contract = {
          id,
          projectId,
          candidateId,
          status: 'draft',
          version: 1,
          scope: p.description,
          durationDays: days,
          reviewDays: 5,
          arbiter: 'Gigly Arbitration Panel',
          milestones: [
            { id: 'M1', seq: 1, title: 'Foundation & first delivery', description: '', deliverables: p.deliverables.slice(0, half), criteria: p.deliverables.slice(0, half).map((d, i) => ({ id: `c${i}`, text: `${d} delivered and working` })), amount: first, dueDay: Math.round(days * 0.4), status: 'pending', submissions: [] },
            { id: 'M2', seq: 2, title: 'Completion & handover', description: '', deliverables: p.deliverables.slice(half), criteria: p.deliverables.slice(half).map((d, i) => ({ id: `c${i}`, text: `${d} delivered and working` })), amount: total - first, dueDay: days, status: 'pending', submissions: [] },
          ],
        }
        update((s) => ({ ...s, contracts: [contract, ...s.contracts] }))
        patchProject(projectId, { status: 'contracting', hiredCandidateId: candidateId, contractId: id })
        return id
      },

      saveContract(contract) {
        update((s) => ({ ...s, contracts: s.contracts.map((c) => (c.id === contract.id ? contract : c)) }))
      },

      async sendContractForApproval(contractId) {
        if (contractsApiEnabled) {
          const state = demoWorkspace()
          const c = state.contracts.find((x) => x.id === contractId)!
          const p = state.projects.find((x) => x.id === c.projectId)!
          const inv = state.invitations.find((i) => i.projectId === c.projectId && i.candidateId === c.candidateId && i.status === 'accepted' && i.backendId)
          if (!inv?.backendId) throw new Error('This freelancer accepted a demo invitation. Invite them again so the contract can be recorded.')
          const next = applyRemote(c, await createContractApi(inv.backendId, p, c))
          update((s) => ({ ...s, contracts: s.contracts.map((x) => (x.id === contractId ? next : x)) }))
          // Dana baru bisa dikunci setelah freelancer menyetujui; syncContract memberi tahu saat itu terjadi.
          const name = state.candidates[c.projectId]?.find((x) => x.id === c.candidateId)?.identity.name ?? c.candidateId
          log(`Contract v${c.version} sent to ${name} for approval · SHA-256 ${next.documentHash?.slice(0, 12)}…`, 'brand', c.projectId)
          return
        }
        patchContract(contractId, (c) => ({ ...c, status: 'pending_approval' }))
        const c = stateRef.current.contracts.find((x) => x.id === contractId)!
        log(`Contract v${c.version} sent to ${c.candidateId} for approval`, 'brand', c.projectId)
        setTimeout(() => {
          const now = stateRef.current.contracts.find((x) => x.id === contractId)
          if (now?.status !== 'pending_approval') return
          patchContract(contractId, (x) => ({ ...x, status: 'awaiting_funding', documentHash: fakeHash() }))
          patchProject(c.projectId, { status: 'funding' })
          log(`Both parties approved contract v${c.version}`, 'success', c.projectId, {
            title: 'Contract approved — fund escrow to start',
            href: `/client/projects/${c.projectId}/fund`,
          })
        }, 4000)
      },

      async fundContract(contractId) {
        const s0 = stateRef.current
        const c = s0.contracts.find((x) => x.id === contractId)!
        const total = c.milestones.reduce((n, m) => n + m.amount, 0)
        if (s0.wallet.balance < total) throw new Error('Insufficient balance')
        if (contractsApiEnabled) {
          if (!c.backendId) throw new Error('Contract is not recorded yet.')
          const r = await lockEscrowApi(c.backendId)
          const tx: Transaction = { id: uid('TX'), type: 'fund', amount: total, status: 'confirmed', hash: r.transaction_hash, projectId: c.projectId, label: `Escrow funded · ${formatSim(total)}`, at: new Date().toISOString() }
          update((s) => ({ ...s, transactions: [tx, ...s.transactions] }))
          await Promise.all([syncContract(contractId), syncWallet()])
          log(`Escrow locked: ${formatSim(total)}. Work has started.`, 'success', c.projectId)
          return tx
        }
        await wait(2400)
        const tx: Transaction = { id: uid('TX'), type: 'fund', amount: total, status: 'confirmed', hash: fakeHash(), projectId: c.projectId, label: `Escrow funded · ${formatSim(total)}`, at: new Date().toISOString() }
        update((s) => ({ ...s, wallet: { ...s.wallet, balance: s.wallet.balance - total, locked: s.wallet.locked + total }, transactions: [tx, ...s.transactions] }))
        patchContract(contractId, (x) => ({
          ...x,
          status: 'active',
          startedAt: new Date().toISOString(),
          fundingTxHash: tx.hash,
          escrowAddress: x.escrowAddress ?? fakeHash(20),
          milestones: x.milestones.map((m, i) => (i === 0 ? { ...m, status: 'in_progress' } : m)),
        }))
        patchProject(c.projectId, { status: 'active' })
        log(`Escrow locked: ${formatSim(total)}. Work has started.`, 'success', c.projectId)
        simulateSubmission(contractId, c.milestones[0].id, 12000)
        return tx
      },

      async addDemoTokens() {
        if (contractsApiEnabled) {
          const r = await faucetApi()
          const tx: Transaction = { id: uid('TX'), type: 'faucet', amount: Number(r.minted), status: 'confirmed', hash: r.transaction_hash, label: 'Demo tokens received', at: new Date().toISOString() }
          update((s) => ({ ...s, wallet: walletFrom(r, s.wallet), transactions: [tx, ...s.transactions] }))
          return
        }
        const tx: Transaction = { id: uid('TX'), type: 'faucet', amount: 20000, status: 'confirmed', hash: fakeHash(), label: 'Demo tokens received', at: new Date().toISOString() }
        update((s) => ({ ...s, wallet: { ...s.wallet, balance: s.wallet.balance + 20000 }, transactions: [tx, ...s.transactions] }))
      },

      async approveMilestone(contractId, milestoneId) {
        if (contractsApiEnabled) {
          const c = demoWorkspace().contracts.find((x) => x.id === contractId)
          const m = c?.milestones.find((x) => x.id === milestoneId)
          if (!c || !m?.backendId || m.status !== 'under_review') throw new Error('This milestone is no longer awaiting review.')
          const r = await approveMilestoneApi(m.backendId)
          const tx: Transaction = { id: uid('TX'), type: 'release', amount: m.amount, status: 'confirmed', hash: r.transaction_hash, projectId: c.projectId, milestoneId, label: 'Milestone ' + m.seq + ' released', at: new Date().toISOString() }
          update((s) => ({ ...s, transactions: [tx, ...s.transactions] }))
          await Promise.all([syncContract(contractId), syncWallet()])
          log('Released ' + formatSim(m.amount) + ' for Milestone ' + m.seq, 'success', c.projectId)
          return tx
        }
        await wait(2000)
        return navigator.locks.request('gigly-review:'+contractId+':'+milestoneId, () => {
          const state = demoWorkspace()
          const c = state.contracts.find(x => x.id === contractId)
          const m = c?.milestones.find(x => x.id === milestoneId)
          if (!c || !m || c.status !== 'active' || m.status !== 'under_review' || !m.submissions.length) throw new Error('This milestone is no longer awaiting review.')
          const tx: Transaction = { id: uid('TX'), type:'release', amount:m.amount, status:'confirmed', hash:fakeHash(), projectId:c.projectId,
            milestoneId, label:'Milestone '+m.seq+' released', at:new Date().toISOString() }
          const next=c.milestones.find(x=>x.seq===m.seq+1 && x.status==='pending')
          const closed=c.milestones.every(x=>x===m || x.status==='released' || x.status==='refunded')
          update(s=>({...s, wallet:{...s.wallet,locked:s.wallet.locked-m.amount,spent:s.wallet.spent+m.amount},transactions:[tx,...s.transactions],
            projects:s.projects.map(p=>closed && p.id===c.projectId ? {...p,status:'completed'} : p),
            contracts:s.contracts.map(row=>row!==c ? row : {...c,status:closed?'closed':c.status,milestones:c.milestones.map(x=>
              x===m ? {...x,status:'released',releasedAt:tx.at} : x===next ? {...x,status:'in_progress'} : x)}),
            activity:[{id:uid('A'),at:tx.at,text:'Released '+formatSim(m.amount)+' for Milestone '+m.seq,projectId:c.projectId,tone:'success'},...s.activity]}))
          if(next) simulateSubmission(contractId,next.id)
          return tx
        })
      },

      async requestRevision(contractId, milestoneId, note) {
        const c = demoWorkspace().contracts.find((x) => x.id === contractId)
        const m = c?.milestones.find((x) => x.id === milestoneId)
        if (!c || !m || m.status !== 'under_review') throw new Error('This milestone is no longer awaiting review.')
        if (contractsApiEnabled) {
          if (!m.backendId) throw new Error('This milestone is not recorded yet.')
          await requestRevisionApi(m.backendId, note)
          await syncContract(contractId)
        } else {
          await wait(1200)
          patchMilestone(contractId, milestoneId, { status: 'revision_required', revisionNote: note, revisionCount: (m.revisionCount ?? 0) + 1, reviewDeadline: undefined })
          simulateSubmission(contractId, milestoneId)
        }
        log(`Revision requested on Milestone ${m.seq}; funds stay in escrow`, 'brand', c.projectId)
      },

      async raiseDispute(contractId, milestoneId, reason) {
        if (contractsApiEnabled) {
          const m = demoWorkspace().contracts.find((c) => c.id === contractId)?.milestones.find((x) => x.id === milestoneId)
          if (!m?.backendId || m.status !== 'under_review') throw new Error('This milestone is no longer awaiting review.')
          await raiseDisputeApi(m.backendId, reason)
          patchMilestone(contractId, milestoneId, { disputeReason: reason })
          await syncContract(contractId)
          const c = demoWorkspace().contracts.find((x) => x.id === contractId)!
          log(`Dispute raised on Milestone ${m.seq}; ${formatSim(m.amount)} frozen`, 'danger', c.projectId)
          return
        }
        const current = demoWorkspace().contracts.find(c=>c.id===contractId)?.milestones.find(m=>m.id===milestoneId)
        if (current?.status !== 'under_review') throw new Error('This milestone is no longer awaiting review.')
        if (!current.revisionCount) throw new Error('Request a revision first; disputes are for revised work that is still rejected.')
        patchMilestone(contractId, milestoneId, { status: 'disputed', disputeReason: reason })
        const c = stateRef.current.contracts.find((x) => x.id === contractId)!
        const m = c.milestones.find((x) => x.id === milestoneId)!
        log(`Dispute raised on Milestone ${m.seq}; ${formatSim(m.amount)} frozen`, 'danger', c.projectId)
      },

      markAllRead() {
        update((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
      },

      resetDemo() {
        update(() => freshWorkspace()) // akun asli: kosong lagi; login demo: data contoh
      },
    }),
    [log, patchContract, patchMilestone, patchProject, simulateSubmission, syncContract, syncWallet, update],
  )

  const value = useMemo<Store>(() => {
    const isRevealed = (projectId: string, candidateId: string) =>
      state.invitations.some((i) => i.projectId === projectId && i.candidateId === candidateId && i.status === 'accepted')
    return {
      ...state,
      ...actions,
      getProject: (id) => state.projects.find((p) => p.id === id),
      getContract: (id) => state.contracts.find((c) => c.id === id),
      getCandidate: (projectId, candidateId) => state.candidates[projectId]?.find((c) => c.id === candidateId),
      isRevealed,
      displayName: (projectId, candidateId) => {
        const c = state.candidates[projectId]?.find((x) => x.id === candidateId)
        return c && isRevealed(projectId, candidateId) ? c.identity.name : `Candidate ${candidateId}`
      },
    }
  }, [state, actions])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore must be used inside ClientStoreProvider')
  return s
}
