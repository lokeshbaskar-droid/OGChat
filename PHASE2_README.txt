OGChat Phase 2 — Chat features

This ZIP is a full project folder. It keeps the Phase 1 Ollama streaming, model selection, file upload, RAM-only chat behavior, and rotating input glow.

Added in Phase 2:
- Edit a user message (loads it back into the composer and trims later messages from the visible conversation).
- Regenerate an assistant response.
- Copy assistant responses and code blocks (existing feature retained).
- Clear current chat from the UI.
- Temperature and maximum response token controls; values are kept in browser localStorage, not chat history.

Install/run:
1. Extract this ZIP into a NEW folder (keep your working Phase 1 folder as backup).
2. Open a terminal in the extracted folder.
3. Run: npm install
4. Run: npm start
5. Open http://localhost:3000 and test send, edit, regenerate, settings and clear chat.

Privacy note: chat history is not saved to disk. Uploaded files may remain in the app's data/uploads directory until you manually delete them. This build has not been run against your Windows/Ollama environment from here; please test the listed features before replacing your working copy.
