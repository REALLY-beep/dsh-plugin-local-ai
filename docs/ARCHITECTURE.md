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

The search endpoint is fixed to `https://huggingface.co/api/models`. Downloads are constrained to `https://huggingface.co/<validated-owner>/<validated-repo>/resolve/main/<validated-gguf-file>`. Repo ID and file path validators reject URL injection and traversal. Files download into a temporary `.part` file and are renamed only after a completed transfer.
