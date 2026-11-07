import test from 'node:test'
import assert from 'node:assert/strict'
import { readLlamaReasoningCapabilities } from '../lib/reasoning.js'

test('maps only actual llama.cpp template effort levels into the DSH picker', () => {
  const result = readLlamaReasoningCapabilities({
    chat_template_caps: {
      supports_reasoning_effort: true,
      reasoning_effort_levels: ['low', 'medium', 'high', 'xhigh', 'high', 'unknown'],
    },
  })
  assert.equal(result.status, 'supported')
  assert.deepEqual(result.levels, ['low', 'medium', 'high', 'xhigh'])
  assert.deepEqual(result.reasoningEfforts, {
    off: 'none', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh',
  })
})

test('does not invent levels when the GGUF chat template has none', () => {
  const result = readLlamaReasoningCapabilities({ chat_template_caps: { supports_reasoning_effort: false } })
  assert.equal(result.status, 'unsupported')
  assert.equal(result.reasoningEfforts, null)
})

test('distinguishes missing capability metadata from an explicit unsupported result', () => {
  assert.equal(readLlamaReasoningCapabilities({}).status, 'unknown')
  assert.equal(readLlamaReasoningCapabilities({ chat_template_caps: {} }).status, 'no-template-levels')
})
