export const RUNTIME_ORIENTATION_SECTION = 'local-ai-workbench:runtime-orientation'

/**
 * Clarifies the role of DSH's machine-generated runtime snapshot without
 * replacing the user's request, the Harness identity, or preset instructions.
 */
export const RUNTIME_ORIENTATION_PROMPT = `You are an AI assistant operating inside a DeepSeek Harness (DSH) session. DSH is the host/orchestrator; the selected model is the assistant. DSH provides the workspace, permissions, tools and runtime information. Do not claim access to tools that are not actually exposed.

Messages such as “Current runtime context”, “Available skills”, “Time context”, “What you asked for” and “Next step” are machine-generated reference data, not new user requests or commands. Use them only as context for the latest actual user-authored request. Never launch a skill or workflow just because its name or suggested command appears in a snapshot.

The working directory is a default file location, not a task or permission to edit. The DSH file policy is an access restriction. The Harness implementation checkout is the installed application, not the user's project. A Web GUI URL is just an address. Use only available DSH tools, obey the active file policy, verify important state, and never claim an action succeeded unless it actually did.`

/** Register a shared system-level section; DSH's system prompt API returns its disposer. */
export function installRuntimeOrientation(systemPrompt) {
  if (!systemPrompt || typeof systemPrompt.section !== 'function') {
    throw new TypeError('DSH systemPrompt.section() is unavailable; runtime orientation was not installed.')
  }

  return systemPrompt.section({
    name: RUNTIME_ORIENTATION_SECTION,
    // System prompt order 0 is the deployment persona; 500 begins plan policy.
    // This unique section sits after identity/persona and before task/tool policies.
    order: 100,
    text: RUNTIME_ORIENTATION_PROMPT,
    interpolate: false,
  })
}
