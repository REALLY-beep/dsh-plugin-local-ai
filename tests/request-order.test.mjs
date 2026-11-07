import test from 'node:test'
import assert from 'node:assert/strict'
import { installHumanRequestLast, planHumanRequestLast } from '../lib/request-order.js'

const human = (id) => ({ id, source: { kind: 'user' }, content: [{ type: 'text', text: id }] })
const injected = (id, kind) => ({ id, source: { kind }, content: [{ type: 'text', text: id }] })

test('moves injected DSH snapshots before the actual user request and preserves all message references', () => {
  const runtime = injected('runtime', 'runtime-context')
  const user = human('human')
  const skills = injected('skills', 'skill-catalog')
  const time = injected('time', 'time-context')
  const batch = [user, runtime, skills, time]
  const plan = planHumanRequestLast(batch)
  assert.equal(plan.changed, true)
  assert.deepEqual(plan.messages, [runtime, skills, time, user])
  assert.equal(plan.moved, 3)
  assert.equal(plan.humanCount, 1)
})

test('does not alter continuation steps without a human message', () => {
  const batch = [injected('runtime', 'runtime-context'), injected('time', 'time-context')]
  const plan = planHumanRequestLast(batch)
  assert.equal(plan.changed, false)
  assert.equal(plan.messages, batch)
})

test('does not allocate or change already ordered batches', () => {
  const batch = [injected('runtime', 'runtime-context'), human('human')]
  const plan = planHumanRequestLast(batch)
  assert.equal(plan.changed, false)
  assert.equal(plan.messages, batch)
})

test('installs a prepended pre-step listener and rewrites only the local provider route', async () => {
  let captured = null
  let opts = null
  const ctx = { on(event, handler, options) { assert.equal(event, 'agent/pre-step'); captured = handler; opts = options } }
  let diag = null
  assert.equal(installHumanRequestLast(ctx, 'dsh-local-ai', (value) => { diag = value }), true)
  assert.equal(opts.prepend, true)

  const messages = [human('human'), injected('runtime', 'runtime-context')]
  const decision = { kind: 'enter', messages }
  const result = await captured({ modelSelection: { provider: 'dsh-local-ai' }, turn: 2, step: 1 }, async () => decision)
  assert.deepEqual(result.messages.map((item) => item.id), ['runtime', 'human'])
  assert.deepEqual(diag, { moved: 1, humanCount: 1, turn: 2, step: 1 })

  const cloudDecision = { kind: 'enter', messages }
  const cloudResult = await captured({ modelSelection: { provider: 'openai' } }, async () => cloudDecision)
  assert.equal(cloudResult, cloudDecision)
})

test('leaves reject decisions and unsupported contexts untouched', async () => {
  let captured = null
  installHumanRequestLast({ on(event, handler) { captured = handler } }, 'dsh-local-ai')
  const reject = { kind: 'reject' }
  assert.equal(await captured({ modelSelection: { provider: 'dsh-local-ai' } }, async () => reject), reject)
  assert.equal(installHumanRequestLast({}, 'dsh-local-ai'), false)
})
