import test from 'node:test'
import assert from 'node:assert/strict'
import { installRuntimeOrientation, RUNTIME_ORIENTATION_PROMPT, RUNTIME_ORIENTATION_SECTION } from '../lib/runtime-orientation.js'

test('runtime orientation registers one scoped-safe system prompt section at the intended order', () => {
  let registration
  let disposed = false
  const dispose = installRuntimeOrientation({
    section(value) {
      registration = value
      return () => { disposed = true }
    },
  })

  assert.equal(registration.name, RUNTIME_ORIENTATION_SECTION)
  assert.equal(registration.order, 100)
  assert.equal(registration.interpolate, false)
  assert.match(registration.text, /machine-generated environment metadata/)
  assert.match(registration.text, /NOT a new user request, task, command/)
  assert.match(registration.text, /latest user-authored chat message/)
  assert.match(registration.text, /Available skills.*catalogue/s)
  assert.match(registration.text, /Do not invoke a skill merely because it is mentioned/)
  assert.equal(disposed, false)
  dispose()
  assert.equal(disposed, true)
})

test('runtime orientation helper fails clearly when DSH system prompt API is unavailable', () => {
  assert.throws(() => installRuntimeOrientation(undefined), /systemPrompt\.section\(\) is unavailable/)
  assert.throws(() => installRuntimeOrientation({}), /systemPrompt\.section\(\) is unavailable/)
  assert.ok(RUNTIME_ORIENTATION_PROMPT.length > 1000)
})


test('Local AI Host service installs the orientation through DSH systemPrompt injection', async () => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const host = await fs.readFile(path.join(root, 'lib/index.js'), 'utf8')
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))

  assert.match(host, /static inject = \['subprocess', 'settings', 'systemPrompt'\]/)
  assert.match(host, /installRuntimeOrientation\(ctx\.systemPrompt\)/)
  assert.match(host, /local-ai-workbench\.runtime-orientation/)
  assert.equal(manifest.version, '0.1.9')
  assert.equal(manifest.exports['./runtime-orientation'], './lib/runtime-orientation.js')
})
