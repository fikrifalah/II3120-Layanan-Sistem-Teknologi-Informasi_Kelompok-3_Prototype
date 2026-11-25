import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('one final package starts one review and leaves the funds locked', async (t) => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  t.after(() => server.close())
  const storage = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  })
  globalThis.window = new EventTarget()
  const { emptyDraft, deliveryError, submitDemo } = await server.ssrLoadModule('/src/services/delivery.ts')
  const { demoWorkspace } = await server.ssrLoadModule('/src/services/demoWorkspace.ts')
  const before = demoWorkspace()
  const m = before.contracts[0].milestones[1]
  const criteria = m.criteria.map((c) => c.id)
  const draft = {
    ...emptyDraft,
    title: 'Final backend handoff',
    repository: 'https://example.com/repository',
    criteria,
  }
  assert.match(deliveryError({ ...draft, repository: 'javascript:void(0)' }, criteria), /HTTPS/)
  assert.match(deliveryError({ ...draft, criteria: [] }, criteria), /criterion/)
  const results = await Promise.allSettled([submitDemo('PRJ-104', 'M2', draft), submitDemo('PRJ-104', 'M2', draft)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const saved = demoWorkspace()
  const final = saved.contracts[0].milestones[1]
  assert.equal(final.status, 'under_review')
  assert.equal(final.submissions.length, 1)
  assert.equal(final.submissions[0].files[0].url, draft.repository)
  assert.equal(saved.wallet.locked, before.wallet.locked)
  assert.equal(saved.notifications.length, before.notifications.length + 1)
  await assert.rejects(submitDemo('PRJ-104', 'M2', draft))
  assert.equal(demoWorkspace().contracts[0].milestones[1].reviewDeadline, final.reviewDeadline)
})
