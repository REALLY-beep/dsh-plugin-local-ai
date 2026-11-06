# Changelog

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
