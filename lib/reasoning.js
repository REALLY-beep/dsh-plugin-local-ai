const KNOWN_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max'])

/**
 * Convert llama-server GET /props metadata into DSH's `reasoningEfforts` map.
 * Only levels that llama.cpp's chat-template capability probe reported are
 * exposed. `none` is llama.cpp's documented per-request switch to disable
 * thinking; it is deliberately not inferred from a model name.
 */
export function readLlamaReasoningCapabilities(props) {
  const caps = props && typeof props === 'object' && props.chat_template_caps && typeof props.chat_template_caps === 'object'
    ? props.chat_template_caps
    : null

  if (!caps) {
    return { status: 'unknown', levels: [], reasoningEfforts: null, detail: 'llama-server /props did not return chat_template_caps.' }
  }

  const raw = Array.isArray(caps.reasoning_effort_levels) ? caps.reasoning_effort_levels : []
  const levels = [...new Set(raw
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => KNOWN_EFFORTS.has(value)))]

  if (levels.length === 0) {
    return {
      status: caps.supports_reasoning_effort === false ? 'unsupported' : 'no-template-levels',
      levels: [],
      reasoningEfforts: null,
      detail: 'The loaded GGUF chat template did not advertise selectable reasoning_effort levels. Reasoning may be intrinsic/default, but DSH cannot expose a verified effort menu for this template.',
    }
  }

  const reasoningEfforts = { off: 'none' }
  for (const level of levels) reasoningEfforts[level] = level

  return {
    status: 'supported',
    levels,
    reasoningEfforts,
    detail: 'Levels were read from llama-server GET /props → chat_template_caps.reasoning_effort_levels.',
  }
}
