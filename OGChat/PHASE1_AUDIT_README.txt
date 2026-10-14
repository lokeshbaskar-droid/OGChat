OGChat Phase 1 — Core Audit Build

Included:
- Existing working Ollama chat/streaming code preserved.
- Rotating rainbow glow CSS preserved.
- Chat conversation JSON persistence disabled; startup clears old conversation JSON files.
- Memory tool changed to RAM-only and clears on server restart.
- Unrestricted file_system, python, code_execution, and git tools disabled by default for safety.
- Existing upload endpoint and model selector retained.

Important:
- This ZIP has not been run against the user's Windows PC or their installed Ollama.
- After extraction, replace project files only after making a backup.
- Start with `npm start` in the project directory.
- Tool execution is not yet a sandbox. Do not enable unrestricted code/file tools until sandboxing is implemented.
- File uploads are stored under the app data uploads directory; they are not the same as chat-history persistence. Delete uploaded files manually if you want them removed.
