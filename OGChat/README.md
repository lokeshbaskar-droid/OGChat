# OGChat — Phase 4

Local ChatGPT-style web UI powered by Ollama, with document extraction and optional Tesseract OCR for scanned/mixed PDFs. Chat history is not saved to disk by the app; uploaded source documents may remain in `data/uploads` until deleted.

## Run on Windows

Requirements: Node.js LTS, Ollama, the model you want to use pulled in Ollama, and (for scanned-PDF OCR) Tesseract OCR with the required language data installed.

```bat
npm install
npm start
```

Open `http://localhost:3000`. OCR diagnostics: `http://localhost:3000/api/ocr/status`.

Default Tesseract path: `C:\Program Files\Tesseract-OCR\tesseract.exe`. If installed elsewhere, set `TESSERACT_PATH` before starting the server. Optional settings: `OCR_LANG`, `OCR_DPI_SCALE`, `OCR_MAX_PAGES`. See `PHASE4_README.txt` for details.

## Upload this project to your GitHub repository

1. Extract this ZIP.
2. Open CMD in the extracted `OGChat` folder.
3. Run `UPLOAD_TO_GITHUB.bat`, or follow the commands in it.
4. Authenticate with GitHub when prompted.

The batch file targets `https://github.com/lokeshbaskar-droid/OGChat.git`. Edit the URL inside it if you want another repository. Do not commit secrets or private documents.

## Kaggle note

This is a Node.js + Ollama local application, not a Kaggle-ready notebook by itself. Kaggle deployment needs a separate runtime/model-serving setup; uploading to GitHub alone does not run the model.

## Verification

The project source is packaged here; full integration testing on your Windows machine with your installed Ollama model and Tesseract is still required.
