import { useSyncExternalStore } from 'react'
import { accountUser, addInboxFixtures, createEmptyWorkspace, createSeed, type ClientState } from './seed'
import { currentAccount } from './auth'
import type { Invitation, InvitationStatus } from '../types/domain'
import { uid } from '../lib/format'

const baseKey = 'gigly.client.v2'
const event = 'gigly:workspace'
export const demoRecipient = 'TL-3158'
let cachedRaw: string | null | undefined
let cachedKey: string | undefined
let cached: ClientState

/** Satu workspace per akun: akun asli -> 'gigly.client.v2.u<id>', login demo (tanpa id) -> kunci lama. */
function storageKey(): string {
  const id = currentAccount()?.id
  return id ? `${baseKey}.u${id}` : baseKey
}

/** Isi awal workspace: akun asli mulai kosong; login demo memakai data contoh. */
export function freshWorkspace(): ClientState {
  const account = currentAccount()
  return account?.id ? createEmptyWorkspace(account) : addInboxFixtures(createSeed())
}

export function demoWorkspace(): ClientState {
  const key = storageKey()
  const raw = localStorage.getItem(key)
  if (cached && raw === cachedRaw && key === cachedKey) return cached
  cachedKey = key
  let state: ClientState
  try { state = raw ? JSON.parse(raw) : freshWorkspace() } catch { state = freshWorkspace() }
  const account = currentAccount()
  let migrated = state
  if (account?.id) {
    // Akun asli: header selalu mengikuti akun yang login; data demo tidak ditambahkan.
    const user = accountUser(account)
    if (JSON.stringify(user) !== JSON.stringify(state.user)) migrated = { ...state, user }
  } else migrated = addInboxFixtures(state)
  // Legacy revision requests already have a final submission and an original review deadline.
  if (migrated.contracts.some(c=>c.milestones.some(m=>m.status==='revision_required' && m.submissions.length))) {
    migrated={...migrated,contracts:migrated.contracts.map(c=>({...c,milestones:c.milestones.map(m=>
      m.status==='revision_required' && m.submissions.length ? {...m,status:'under_review'} : m)}))}
  }
  cached = migrated
  if (!raw || migrated !== state) {
    cached = { ...migrated, invitations: migrated.invitations.map(i => ({ ...i,
      candidateSnapshot: i.candidateSnapshot ?? migrated.candidates[i.projectId]?.find(c => c.id === i.candidateId) })) }
    cachedRaw = JSON.stringify(cached)
    localStorage.setItem(key, cachedRaw)
  } else cachedRaw = raw
  return cached
}

export function updateDemo(fn: (state: ClientState) => ClientState) {
  const state = demoWorkspace()
  const next = fn(state)
  if (next === state) return
  const raw = JSON.stringify(next)
  localStorage.setItem(storageKey(), raw)
  cachedRaw = raw
  cached = next
  window.dispatchEvent(new Event(event))
}

function subscribe(fn: () => void) {
  const storage = (e: StorageEvent) => { if (e.key === storageKey() || e.key === null) fn() }
  window.addEventListener('storage', storage)
  window.addEventListener(event, fn)
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(event, fn) }
}
export function useDemoWorkspace(enabled = true) {
  return useSyncExternalStore(subscribe, enabled ? demoWorkspace : () => null)
}

export async function decideDemo(id: string, status: Exclude<InvitationStatus, 'pending'>, recipient?: string) {
  await navigator.locks.request('gigly-invitations', () => updateDemo(state => {
    const inv = state.invitations.find(i => i.id === id && (!recipient || i.candidateId === recipient))
    if (!inv) throw new Error('Invitation unavailable.')
    if (inv.status === status) return state
    if (inv.status !== 'pending') throw new Error('This invitation is already ' + inv.status + '.')
    const at = new Date().toISOString()
    const title = 'Invitation ' + status
    return { ...state, invitations: state.invitations.map(i => i !== inv ? i : { ...i, status, respondedAt: status === 'cancelled' ? undefined : at }),
      notifications: status === 'cancelled' ? state.notifications : [{ id: uid('N'), title,
        body: state.projects.find(p => p.id === inv.projectId)?.title ?? '', href: '/client/projects/' + inv.projectId + '/invitations',
        at, read: false }, ...state.notifications],
    }
  }))
}

export function sendDemoMessage(id: string, sender: 'client' | 'freelancer', text: string) {
  return navigator.locks.request('gigly-invitations', () => updateDemo(state => {
    const inv = state.invitations.find(i => i.id === id && i.candidateId === demoRecipient)
    if (!inv || !['accepted', 'pending'].includes(inv.status) || !text.trim() || text.trim().length > 2000) throw new Error('Message could not be sent.')
    const message = { at: new Date().toISOString(), sender, text: text.trim() }
    const updated: Invitation = { ...inv, conversation: [...(inv.conversation ?? []), message] }
    return { ...state, invitations: state.invitations.map(i => i.id === id ? updated : i) }
  }))
}
