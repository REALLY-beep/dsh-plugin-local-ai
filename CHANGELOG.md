# Changelog

## 0.1.8 — context policy and memory estimate

- Added bounded GGUF metadata reader for transformer dimensions used to estimate F16 KV-cache memory at the currently selected context length.
- Context slider now updates a live GiB estimate and clearly distinguishes KV-cache from model weights/total system memory. Hybrid/state-space metadata is marked as partial instead of claiming a complete estimate.
- Added a guarded Windows context-patch installer (`APPLY-CONTEXT-FIX.cmd`) that extracts the exact shipped `preset-standard` from `dsh --dump-default-config`, changes only nested `compaction-basic.headroomTokens` and `maxTokens` to 1024, backs up the existing profile patch, and verifies the effective nested preset with `dsh --dump-config`; it restores the original profile file if verification fails.
- The installer replaces the complete shipped `preset-standard` row because DSH does not let a profile patch reach `compaction-basic` nested inside the preset. It preserves the whole current standard preset and all of its tools; rerunning it is idempotent.
- Fixed GGUF metadata scanning so it continues through the bounded metadata table and detects SSM/Mamba metadata even when it appears after attention dimensions.
- Context slider shows a live approximate F16 KV-cache size in GiB from GGUF geometry and lists the GGUF file size separately. It does not claim the estimate is total RAM/VRAM.
- No model files, model catalog, or engine settings are modified by the context patch script.


## 0.1.7 — 2026-11-07

- Added GGUF Vision support through a separately selected `mmproj` projector and llama.cpp `--mmproj` launch argument.
- Added a local synthetic-image probe against `/v1/chat/completions`; the DSH model advertises `input: ['text', 'image']` only after the image-input request succeeds.
- Bound the Vision verification to the main GGUF, projector and llama-server executable fingerprints. Replacing any of them clears stale verification and downgrades the DSH model back to text input.
- Added local recursive projector discovery. A single projector in the model folder is paired automatically; ambiguous folders require an explicit selection.
- Hugging Face downloads now bundle the selected projector and all complete split-GGUF shards at one pinned repository revision.
- Download each bundle into a temporary folder, verify every known byte size, and atomically move the whole set into the model library; cancellation/failure removes partial data and rolls back the catalog entry.
- Added pagination for large Hugging Face repository trees and constrained next-page links to the same HTTPS repository/revision endpoint.
- Added 39 regression checks for pagination, bundle planning, projector pairing, Vision declaration, stale-verification prevention, staging-folder isolation and Remote descriptors.

## 0.1.6 — 2026-11-07

- Capability badges now distinguish what the model advertises from what the current plugin actually supports: ✓ text/chat and code tasks, ~ conditional tool calling/reasoning, × vision/audio/embeddings/rerank not yet wired into this plugin.
- Capability badges explain requirements in their tooltips; tool calls require Jinja and a compatible GGUF chat template.
- Local model cards show the exact DSH model ID, making stale-session `no configured model` errors easier to diagnose.
- Registration guidance now explains that existing DSH sessions retain their recorded model ID; re-register the intended model and start a new chat or reselect it in the existing session.

- Added compact model-capability badges in the Hugging Face catalogue (chat, code, vision, audio, tools, reasoning, embeddings and reranking), derived from repository tags and pipeline metadata.
- Added separate llama.cpp compatibility status: Hub catalogue listing is shown as a metadata claim, while a successful local llama-server health check is shown as an actual load verification.
- Persisted Hugging Face capability metadata with downloaded local GGUF models.
- Added registration read-back verification and surfaced the currently registered DSH model ID/name in the Local AI panel.
- Removed guessed reasoning support from the local provider profile; only text input is declared until a feature is explicitly verified.
- Added a UI warning that existing DSH conversations keep their previously selected model ID after switching the registered model.

## 0.1.5 — 2026-11-07

- Added a Hugging Face parameter-count filter using the Hub's `num_parameters` search parameter.
- Added GGUF file-weight ranges based on exact byte sizes from each repository's recursive tree API, not estimates from filenames.
- Selecting a GGUF now displays the selected file's parameter count when identifiable, quantization, and exact file size; the dropdown options include the same metadata.
- Added bounded concurrent metadata lookups (up to four repositories at a time) and graceful fallback to the existing file list if a tree lookup fails.
- Added regression coverage for parameter-range requests, tree metadata parsing, exact file-size filtering, and the updated Remote method descriptor.

## 0.1.4

- Reworked Hugging Face discovery to mirror the Models catalogue with server-side `apps=llama.cpp` search and a `filter=gguf` fallback.
- Added query normalization for spaced model names and a model-family fallback when the exact phrase returns no results.
- Added simple sorting (trending, downloads, likes, recently updated), repository links, download/like counts, last-updated date, GGUF file count, and per-file size when available.
- Only standalone GGUF checkpoints are offered for one-click download; `mmproj` files and split GGUF shards are hidden to avoid incomplete downloads.
- Increased the result cap to 24 repositories and retained the existing local-only inference path.

## 0.1.3 — 2026-11-07

- Fixed the SRC/Typepert Gateway argument-name mismatch in `saveSettings`: the Host method parameter now matches the Client descriptor field `settings`.
- Added a regression test that compares every exported Remote method's Host parameter names with the Client descriptor, preventing similar named-argument mismatches.

## 0.1.2 — 2026-11-06

- Fixed the Remote Gateway registration error: `addModel` now uses a plain required-parameter signature; an omitted display name is handled by the existing string normalization.
- Made the Local AI panel itself vertically scrollable inside the DSH main-panel viewport, without relying on the host page/body scrollbar.
- Kept scan results in the panel normal flow so the main panel scrollbar can reach every discovered GGUF and continue to the model library below.
- Improved narrow-window scan-result layout so the Add button moves below the file path.

## 0.1.1 — 2026-11-06

- Recursive GGUF discovery in the configured models directory and user-selected scan folders.
- Scan results show the relative path so files with identical names in different subfolders are easy to distinguish.
- Unreadable nested folders/files are skipped and counted in the scan summary; directory symlinks are not followed.
- Fixed the GitHub installation command to use `REALLY-beep/dsh-plugin-local-ai`.


## 0.1.0 — 2026-11-06

- First standalone DSH panel for Local AI under the standard More navigation.
- GGUF library management, folder scanning, and per-model launch options.
- llama.cpp `llama-server` start/stop, health checks, logs, and DSH provider registration.
- Public Hugging Face GGUF search/download with progress and cancellation.
- Host/client separation, local-only server binding, path validation, and unit tests.
- DSH exposes only the registered model that matches the running llama-server alias.
