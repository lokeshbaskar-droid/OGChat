OGChat Phase 3 — File Intelligence

What's new
- Extracts selectable text from PDF files.
- Extracts text from DOCX files.
- Continues to read TXT, Markdown, JSON, CSV and common source-code/text files.
- Splits long extracted documents into overlapping chunks and ranks passages against the user's question before sending context to Ollama. Summary requests sample the beginning, middle and end as well as relevant passages.
- Existing chat UI, model controls, streaming, edit/regenerate/copy features, and rotating glow are carried forward from Phase 2.
- Chat history remains disabled on disk.

Install / update
1. Keep your previous working folder as a backup. Extract this ZIP into a NEW folder.
2. Open a terminal in the extracted project folder.
3. Run: npm install
4. Run: npm start
5. Open http://localhost:3000

Important limitations
- Scanned/image-only PDFs need OCR; this build reports when no selectable text was extracted.
- Image understanding still depends on selecting a compatible vision model in Ollama.
- Uploaded files are stored in data/uploads on disk by the current upload design. Chat messages are not saved, but uploads are not automatically deleted. Delete data/uploads manually when you want to remove uploaded files.
- New PDF/DOCX dependencies are installed by npm install.
- The project can be syntax-checked here, but cannot be integration-tested against your Windows/Ollama installation from this environment.
