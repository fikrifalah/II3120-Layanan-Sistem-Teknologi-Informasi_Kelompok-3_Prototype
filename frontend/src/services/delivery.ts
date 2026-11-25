import { demoRecipient, updateDemo } from './demoWorkspace'
import { DAY_MS, uid } from '../lib/format'
import type { SubmissionFile } from '../types/domain'

export interface DeliveryDraft {
  title: string
  notes: string
  repository: string
  revision: string
  demo: string
  criteria: string[]
  files: File[]
}
export const emptyDraft: DeliveryDraft = {
  title: '',
  notes: '',
  repository: '',
  revision: '',
  demo: '',
  criteria: [],
  files: [],
}
export function httpUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
export function deliveryError(d: DeliveryDraft, required: string[]) {
  if (!d.title.trim()) return 'Enter a deliverable title.'
  if (!d.files.length && !d.repository.trim() && !d.demo.trim()) return 'Attach a file or add a repository or demo URL.'
  if ([d.repository, d.demo].some((s) => s.trim() && !httpUrl(s.trim()))) return 'Use a full HTTP or HTTPS URL.'
  if (d.revision.trim() && !d.repository.trim()) return 'Add a repository URL for the commit or tag.'
  if (d.notes.length > 4000) return 'Keep submission notes within 4,000 characters.'
  if (required.some((id) => !d.criteria.includes(id))) return 'Confirm every mandatory acceptance criterion.'
  return fileError(d.files)
}
export const acceptedFiles = '.zip,.pdf,.png,.jpg,.jpeg,.txt'
export function fileError(files: File[]) {
  if (files.length > 5) return 'Attach up to five files.'
  if (files.some((f) => !f.size || f.size > 20 * 1024 ** 2))
    return 'Each file must contain data and be 20 MiB or smaller.'
  if (files.some((f) => !/\.(zip|pdf|png|jpe?g|txt)$/i.test(f.name) || /[\\/]/.test(f.name)))
    return 'Choose ZIP, PDF, PNG, JPEG, or text files.'
  return ''
}
export async function checkFileContents(files: File[]) {
  const signatures: Record<string, number[][]> = {
    pdf: [[37, 80, 68, 70, 45]],
    png: [[137, 80, 78, 71, 13, 10, 26, 10]],
    jpg: [[255, 216, 255]],
    jpeg: [[255, 216, 255]],
    zip: [
      [80, 75, 3, 4],
      [80, 75, 5, 6],
      [80, 75, 7, 8],
    ],
  }
  for (const f of files) {
    const bytes = new Uint8Array(await f.slice(0, 512).arrayBuffer())
    const sig = signatures[f.name.split('.').pop()!.toLowerCase()]
    if (
      sig
        ? !sig.some((prefix) => prefix.every((n, i) => bytes[i] === n))
        : bytes.includes(0) || /^\s*<(?:!doctype html|html|script|svg)\b/i.test(new TextDecoder().decode(bytes))
    ) {
      throw new Error('File content does not match the permitted format: ' + f.name)
    }
  }
}

let database: Promise<IDBDatabase> | undefined
async function db() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('gigly.delivery', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('records')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      database = undefined
      reject(req.error)
    }
  })
  return database
}
export async function readRecord<T>(key: string): Promise<T | undefined> {
  const database = await db()
  return new Promise((resolve, reject) => {
    const r = database.transaction('records').objectStore('records').get(key)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
export async function writeRecords(entries: [string, unknown][]) {
  if (!entries.length) return
  const database = await db()
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction('records', 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error || new Error('Browser storage unavailable.'))
    for (const [key, value] of entries) {
      if (value === undefined) tx.objectStore('records').delete(key)
      else tx.objectStore('records').put(value, key)
    }
  })
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export async function openDemoFile(f: SubmissionFile) {
  if (f.url && httpUrl(f.url)) {
    window.open(f.url, '_blank', 'noopener,noreferrer')
    return
  }
  const blob = f.blobId && (await readRecord<Blob>(f.blobId))
  if (!blob) throw new Error('This seeded attachment has no downloadable file.')
  downloadBlob(blob, f.name)
}

export async function submitDemo(projectId: string, milestoneId: string, d: DeliveryDraft) {
  await navigator.locks.request('gigly-delivery:' + projectId + ':' + milestoneId, async () => {
    const blobs: [string, File][] = d.files.map((f) => ['file:' + crypto.randomUUID(), f])
    const files: SubmissionFile[] = blobs.map(([blobId, f]) => ({
      blobId,
      name: f.name,
      description: f.type || 'Deliverable file',
      size: Math.ceil(f.size / 1024) + ' KB',
      kind: f.name.endsWith('.zip') ? 'archive' : f.name.endsWith('.pdf') ? 'pdf' : 'report',
    }))
    for (const [kind, url] of [
      ['repo', d.repository],
      ['link', d.demo],
    ] as const) {
      if (url.trim())
        files.push({
          kind,
          url: url.trim(),
          name: kind === 'repo' ? 'Repository' : 'Live demo',
          description: url.trim(),
        })
    }
    await writeRecords(blobs)
    try {
      updateDemo((state) => {
        const c = state.contracts.find((x) => x.projectId === projectId && x.candidateId === demoRecipient)
        const m = c?.milestones.find((x) => x.id === milestoneId)
        if (!c || !m || c.status !== 'active' || !c.fundingTxHash || m.status !== 'in_progress' || m.submissions.length)
          throw new Error('This milestone is no longer open for submission.')
        const error = deliveryError(
          d,
          m.criteria.map((k) => k.id)
        )
        if (error) throw new Error(error)
        const at = new Date().toISOString()
        const submission = {
          title: d.title.trim(),
          notes: d.notes.trim(),
          version: 'Final',
          submittedAt: at,
          files,
          repositoryRevision: d.revision.trim(),
          declaredCriteria: d.criteria,
        }
        const title = 'Milestone ' + m.seq + ' is ready for review'
        return {
          ...state,
          contracts: state.contracts.map((contract) =>
            contract !== c
              ? contract
              : {
                  ...c,
                  milestones: c.milestones.map((row) =>
                    row !== m
                      ? row
                      : {
                          ...m,
                          status: 'under_review',
                          submissions: [submission],
                          reviewDeadline: new Date(Date.parse(at) + c.reviewDays * DAY_MS).toISOString(),
                        }
                  ),
                }
          ),
          activity: [{ id: uid('A'), at, projectId, text: title, tone: 'warning' }, ...state.activity],
          notifications: [
            {
              id: uid('N'),
              at,
              read: false,
              title,
              body: d.title.trim(),
              href: '/client/projects/' + projectId + '/milestones/' + milestoneId + '/review',
            },
            ...state.notifications,
          ],
        }
      })
    } catch (e) {
      await writeRecords(blobs.map(([key]) => [key, undefined]))
      throw e
    }
  })
}
