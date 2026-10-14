OGChat Phase 4 — Offline OCR + Page-aware Document Retrieval
===========================================================

This release builds on Phase 3 and adds a local Tesseract OCR fallback for scanned PDFs.

WHAT'S NEW
----------
1. PDF pages are inspected individually. Pages with a usable selectable-text layer use that text; pages with little/no selectable text are rendered locally and passed to Tesseract OCR. Mixed PDFs are supported page-by-page.
2. OCR text is tagged with its original PDF page number (for example, [Page 12]) so answers can refer to source pages when the relevant passage is included in context.
3. OCR status endpoint: http://localhost:3000/api/ocr/status
4. Temporary OCR page images are created in the operating system temp directory and removed after processing.
5. Page count is limited by default to 250 for OCR safety; maximum configurable to 500.
6. Existing Phase 3 text extraction, DOCX support, in-memory chunk retrieval, Ollama integration, and chat-history-disabled behavior are retained.

WINDOWS SETUP
-------------
1. Install Node.js LTS if not already installed.
2. Install Tesseract OCR for Windows and ensure English language data (eng.traineddata) is installed.
   Default executable expected by OGChat:
   C:\Program Files\Tesseract-OCR\tesseract.exe
3. If installed elsewhere, set TESSERACT_PATH to the full path of tesseract.exe before starting OGChat.
   Example (PowerShell):
   $env:TESSERACT_PATH = 'D:\Tools\Tesseract-OCR\tesseract.exe'
   $env:OCR_LANG = 'eng'
   npm start
4. From the OGChat folder run:
   npm install
   npm start
5. Open http://localhost:3000
6. Open http://localhost:3000/api/ocr/status to check whether Tesseract can be launched.

OPTIONAL ENVIRONMENT SETTINGS
-----------------------------
TESSERACT_PATH   Full path to tesseract.exe. Default: C:\Program Files\Tesseract-OCR\tesseract.exe
OCR_LANG         Tesseract language code(s). Default: eng. Example for English + Tamil if the Tamil language pack is installed: eng+tam
OCR_DPI_SCALE    PDF render scale from 1 to 3. Default: 2. Higher can improve small print but uses more memory/time.
OCR_MAX_PAGES    Max PDF pages allowed for processing, 1 to 500. Default: 250.

TESTING NOTES
-------------
- This archive was syntax-checked in the build environment. Full Windows integration testing with installed Tesseract, npm dependency installation, and the user's actual PDF still needs to be run on the target PC.
- If Tesseract is not installed, OGChat returns a clear setup error rather than silently pretending OCR succeeded.
- OCR quality depends on scan resolution, skew, language packs, handwriting, and page layout. OCR is best suited to printed text.
- The app's uploaded source files continue to persist under data/uploads as in Phase 3. Temporary OCR-rendered page images are deleted after each extraction; this does not automatically delete uploaded PDFs.
- Chat history is not saved to disk, preserving the user's existing preference.
