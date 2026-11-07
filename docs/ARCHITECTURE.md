# Architecture notes

## Package split

- `lib/index.js`: DSH Host service. Owns filesystem access, model catalog, child process lifecycle, local health probes, settings mutation, and Hugging Face transfers.
- `lib/client.js`: DSH browser module. Registers the Local AI main panel and sidebar metadata, mounts the Typert Remote contribution, and renders the UI with the shared React runtime.
- `lib/logic.js`: pure argument/config/validation helpers, separately testable without DSH.

## DSH panel integration

`sidebar.panellist.id` and `main.key` both use `local-ai-workbench`. `ctx.slots.inject()` defers registration until DSH declares the slot, rather than registering against an undeclared slot. The sidebar placement/pinning is controlled by DSH's own panel customization; the plugin does not replace the More menu or sidebar owner.

## Inference lifecycle

The Host resolves `llama-server`, builds a safe argv array and spawns it through `ctx.subprocess.spawn()`. The server is bound to `127.0.0.1`. A health loop polls `/health`, then marks the service ready. The model provider record is added to DSH's `llm-pi-ai` settings namespace only when the user presses **В DSH**.

Only one server is managed at a time. Stopping the process is part of plugin disposal, so disabling/unloading the package does not intentionally leave an orphan child process.

## Hub transfers

The search endpoint is fixed to `https://huggingface.co/api/models`. The recursive tree endpoint is pinned to the model hit's exact revision and followed through same-host, same-repository `Link: rel=next` pages. Repo ID, revision and file path validators reject URL injection and traversal. The selected primary GGUF, every part of a complete numbered shard group, and an optional `mmproj` are downloaded from the same repository revision. Files are written to a temporary bundle directory as `.part`, checked against Hub byte sizes, renamed after individual completion, and the whole directory is moved into the model library only after all components succeed. Cancellation and failures remove the temporary bundle; the recursive library scanner deliberately ignores `.download-*` staging folders, so incomplete components never appear as usable models. Post-commit catalog failures roll back the directory and catalog references.

## Vision lifecycle

A model is not declared image-capable from Hub tags alone. The local catalog stores a primary GGUF path and optional `mmproj` path. A single projector next to a local model can be paired automatically; multiple candidates require user choice. `buildServerArgs()` passes the selected projector via `--mmproj`. Once `/health` is ready, Hub-independent runtime modality metadata is recorded as a hint. The user then runs a synthetic PNG through the real OpenAI-compatible `/v1/chat/completions` image path. Only an accepted completion registers the DSH model with per-model `input: ['text', 'image']`. The probe's fingerprint covers the primary GGUF, projector and llama-server executable (path, size and modification time); if any changes, Vision verification is cleared and DSH registration is downgraded to text. The probe confirms transport/runtime acceptance, not semantic image-understanding quality.

## Runtime orientation prompt

The Host service injects the shared `systemPrompt` service and registers a unique global system section (`local-ai-workbench:runtime-orientation`, order 100). DSH's dynamic `Current runtime context` is a separate sourced user-role snapshot; this section explicitly frames that snapshot as machine-generated environment metadata rather than a task. It distinguishes the workspace root, file-policy constraints, Harness installation checkout, Web GUI endpoint and skill catalogue, and tells the agent to act only on the latest user-authored request. The section is additive: it does not set `complete: true`, replace the built-in Harness identity, shadow the Agent Preset persona, or disable runtime context and tools. Cordis owns disposal of the section when the plugin unloads.


## DSH local-model request ordering

The local provider installs a listener on the `agent/pre-step` waterfall with `{ prepend: true }`. The listener waits for `next()` so it sees the fully composed message batch, then partitions messages by `source.kind`: real human input is `user`; all other messages in this user-message batch are Harness context. It moves context first and human messages last, preserving original order and object identity. It only applies when `payload.modelSelection.provider === 'dsh-local-ai'`. It never drops context and does not modify other providers or continuation steps with no human message. This mirrors the workaround described in DSH discussion #10080 and the standalone `dsh-human-request-last` plugin.

## Reasoning effort discovery

After the local server becomes healthy, the Host reads `GET /props` and inspects `chat_template_caps.reasoning_effort_levels`. Only those real levels are written to the model's DSH `reasoningEfforts`; the `off` entry maps to llama.cpp's documented `reasoning_effort: none`. If the template exposes no effort levels or `/props` is unavailable, the plugin removes any stale effort declaration and shows the reason in the model card instead of guessing from a model name.
