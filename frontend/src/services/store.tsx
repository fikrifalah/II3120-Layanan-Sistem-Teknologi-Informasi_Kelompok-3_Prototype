import { mockProfileEnabled, profileSignature, readDemoProfile } from './freelancerProfile'
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import type { ActivityItem, Candidate, Contract, Milestone, Project, Transaction } from '../types/domain'
import { fakeHash, formatSim, uid } from '../lib/format'
import { rankCandidates } from './matching'
import { demoRecipient, demoWorkspace, decideDemo, updateDemo, useDemoWorkspace } from './demoWorkspace'
import { addInboxFixtures, createSeed, type ClientState } from './seed'

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
  sendContractForApproval: (contractId: string) => void
  fundContract: (contractId: string) => Promise<Transaction>
  addDemoTokens: () => void
  approveMilestone: (contractId: string, milestoneId: string) => Promise<Transaction>
  raiseDispute: (contractId: string, milestoneId: string, reason: string) => void
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

  /** Simulated freelancer: submits work on an in-progress milestone after a short delay. */
  const simulateSubmission = useCallback(
    (contractId: string, milestoneId: string, delay = 9000) => {
      setTimeout(() => {
        const c = stateRef.current.contracts.find((x) => x.id === contractId)
        const m = c?.milestones.find((x) => x.id === milestoneId)
        if (!c || c.candidateId === demoRecipient || !m || m.status !== 'in_progress' || m.submissions.length) return
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
        await wait(2600)
        const project = stateRef.current.projects.find((p) => p.id === projectId)
        if (!project) throw new Error('Project not found')
        const ranked = rankCandidates(project, 6, mockProfileEnabled ? readDemoProfile() : undefined)
        update((s) => ({ ...s, candidates: { ...s.candidates, [projectId]: ranked } }))
        if (project.status === 'draft' || project.status === 'matching') patchProject(projectId, { status: 'matching' })
        log(`AI matching ranked ${ranked.length} candidates for ${project.title}`, 'brand', projectId)
        return ranked
      },

      sendInvitation(projectId, candidateId, message) {
        return navigator.locks.request('gigly-invitations', () => {
          const latest = demoWorkspace()
          const candidate = latest.candidates[projectId]?.find(c => c.id === candidateId)
          if (!candidate?.eligible || !['matching', 'inviting'].includes(latest.projects.find(p => p.id === projectId)?.status ?? '')) throw new Error('An eligible match on an open project is required.')
          if (latest.invitations.some(i => i.projectId === projectId && i.candidateId === candidateId && i.status === 'pending')) throw new Error('Invitation already pending.')
          const profile = candidateId === demoRecipient && mockProfileEnabled ? readDemoProfile() : null
          if (profile && (profileSignature(profile) !== (candidate.profileSignature ?? profileSignature()) || !latest.projects.find(p => p.id === projectId)!.requiredSkills.every(s => profile.skills.includes(s)))) throw new Error('Profile changed. Run matching again.')
          const inv = { id: uid('INV'), candidateSnapshot: candidate, portfolioExcerpt: profile?.portfolio, projectId, candidateId, status: 'pending' as const, sentAt: new Date().toISOString(), message }
          update((s) => ({ ...s, invitations: [inv, ...s.invitations] }))
          const p = stateRef.current.projects.find((x) => x.id === projectId)
          if (p && (p.status === 'matching' || p.status === 'draft')) patchProject(projectId, { status: 'inviting' })
          log(`Invitation sent to ${candidateId}`, 'brand', projectId)

          if (candidateId === demoRecipient) return
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

      cancelInvitation(invitationId) {
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

      sendContractForApproval(contractId) {
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

      addDemoTokens() {
        const tx: Transaction = { id: uid('TX'), type: 'faucet', amount: 20000, status: 'confirmed', hash: fakeHash(), label: 'Demo tokens received', at: new Date().toISOString() }
        update((s) => ({ ...s, wallet: { ...s.wallet, balance: s.wallet.balance + 20000 }, transactions: [tx, ...s.transactions] }))
      },

      async approveMilestone(contractId, milestoneId) {
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

      raiseDispute(contractId, milestoneId, reason) {
        if (demoWorkspace().contracts.find(c=>c.id===contractId)?.milestones.find(m=>m.id===milestoneId)?.status !== 'under_review') throw new Error('This milestone is no longer awaiting review.')
        patchMilestone(contractId, milestoneId, { status: 'disputed', disputeReason: reason })
        const c = stateRef.current.contracts.find((x) => x.id === contractId)!
        const m = c.milestones.find((x) => x.id === milestoneId)!
        log(`Dispute raised on Milestone ${m.seq}; ${formatSim(m.amount)} frozen`, 'danger', c.projectId)
      },

      markAllRead() {
        update((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
      },

      resetDemo() {
        update(() => addInboxFixtures(createSeed()))
      },
    }),
    [log, patchContract, patchMilestone, patchProject, simulateSubmission, update],
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
