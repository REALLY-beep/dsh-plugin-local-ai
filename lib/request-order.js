/**
 * Keep the actual human request last when DSH appends injected context messages.
 *
 * DSH distinguishes genuine user messages from runtime/skill/time snapshots by
 * source.kind, but OpenAI-compatible adapters flatten all of them to role=user.
 * Small local models commonly answer the final user-role message. We therefore
 * move injected context before source.kind=user at agent/pre-step. No message is
 * removed, rewritten, or synthesized.
 */
export function planHumanRequestLast(messages, humanKinds = ['user']) {
  if (!Array.isArray(messages) || messages.length < 2) {
    return { messages, changed: false, moved: 0, humanCount: 0 }
  }

  const kinds = new Set(Array.isArray(humanKinds) ? humanKinds : ['user'])
  const context = []
  const humans = []

  for (const message of messages) {
    const kind = message && message.source && typeof message.source.kind === 'string'
      ? message.source.kind
      : undefined
    if (kind !== undefined && kinds.has(kind)) humans.push(message)
    else context.push(message)
  }

  // Wake/continuation steps have no human request; do not move their input.
  // A batch without injected context is already in the desired shape.
  if (humans.length === 0 || context.length === 0) {
    return { messages, changed: false, moved: 0, humanCount: humans.length }
  }

  const ordered = [...context, ...humans]
  const changed = ordered.some((message, index) => message !== messages[index])
  return {
    messages: changed ? ordered : messages,
    changed,
    moved: changed ? context.length : 0,
    humanCount: humans.length,
  }
}

/**
 * Register the reorder at the only DSH waterfall before request derivation.
 * `prepend` wraps downstream contributors so the after-next phase sees the
 * fully composed batch. Cordis disposes the listener with the owning context.
 */
export function installHumanRequestLast(ctx, providerKey, onReordered = () => {}) {
  if (!ctx || typeof ctx.on !== 'function') return false

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (!decision || decision.kind !== 'enter' || !Array.isArray(decision.messages)) return decision

    // Do not alter cloud providers or other model routes.
    if (!payload || !payload.modelSelection || payload.modelSelection.provider !== providerKey) return decision

    const plan = planHumanRequestLast(decision.messages)
    if (!plan.changed) return decision

    try { onReordered({ moved: plan.moved, humanCount: plan.humanCount, turn: payload.turn, step: payload.step }) } catch { /* diagnostics must never break a model step */ }
    return { ...decision, messages: [...plan.messages] }
  }, { prepend: true })

  return true
}
