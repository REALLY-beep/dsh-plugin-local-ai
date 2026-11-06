# Changelog

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
