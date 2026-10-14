# OGChat audit notes

## Fixes applied

1. **Use IPv4 explicitly for Ollama (`server.js`)**
   - Changed the Ollama base URL from `http://localhost:11434` to `http://127.0.0.1:11434`.
   - This avoids a possible Windows/Node `localhost` IPv6 (`::1`) resolution mismatch if Ollama is listening on IPv4 only. This is a plausible cause, not confirmed as the user's exact runtime cause.

2. **Keep stream errors visible (`public/app.js`)**
   - The previous client could display an SSE error briefly, then overwrite it with an empty assistant response after the stream ended.
   - It now preserves and displays stream errors, reports non-2xx HTTP responses, and handles a missing response stream.

3. **Stream disconnect handling (`server.js`)**
   - Watches the outgoing response's `close` event rather than the incoming POST request's `close` event, avoiding cancellation when the POST body has simply finished uploading.

4. **Duplicate file uploads (`public/app.js`)**
   - Removed the redundant upload request and displays upload errors.

## Checks performed in this environment

- `node --check server.js` — passed.
- `node --check public/app.js` — passed.
- `node --check playwright_test.js` — passed.
- Node server started successfully.
- `GET /` — HTTP 200.
- `GET /api/config` — returned expected local model/configuration.
- **Mock Ollama streaming integration test** — passed; the app returned two SSE chunks and `[DONE]` through `/api/chat`.
- Real `gpt-oss:20b` inference was not available in this environment, so the real Windows Ollama integration still needs to be checked on the user's PC.

## Run on Windows

1. Extract this ZIP to a separate folder, e.g. `D:\OGChat_fixed`.
2. Open PowerShell in that folder and run `npm install` if dependencies are not installed.
3. Confirm Ollama is running and the model exists: `ollama list`.
4. Run `npm start`.
5. Open `http://localhost:3000`.
6. Send `Say hello in one sentence.`. If an error occurs, OGChat should now display the error instead of leaving a blank assistant message.

This app uses Ollama at `http://127.0.0.1:11434` and its auto-start route expects `D:\Ollama\ollama.exe`.
