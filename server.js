const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const os = require('os');
const { promisify } = require('util');
const execFileAsync = promisify(require('child_process').execFile);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('@napi-rs/canvas');
const { spawn, execSync } = require('child_process');

const app = express();
const PORT = 3000;
// Use IPv4 explicitly: Node may resolve 'localhost' to ::1 while Ollama listens on 127.0.0.1.
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const OLLAMA_EXE = 'D:\\Ollama\\ollama.exe';
const DATA_DIR = path.join(__dirname, 'data');
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');
// DELETE_OLD_CHAT_HISTORY_ON_STARTUP: chat history is disabled by user request.
try {
  if (fs.existsSync(CONVERSATIONS_DIR)) {
    for (const file of fs.readdirSync(CONVERSATIONS_DIR)) {
      if (file.toLowerCase().endsWith('.json')) fs.unlinkSync(path.join(CONVERSATIONS_DIR, file));
    }
  }
} catch (err) { console.warn('Could not clear old conversation files:', err.message); }

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DEFAULT_MODEL = 'gpt-oss:20b';
const TESSERACT_EXE = process.env.TESSERACT_PATH || 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
const OCR_LANG = process.env.OCR_LANG || 'eng';
const OCR_DPI_SCALE = Math.max(1, Math.min(3, Number(process.env.OCR_DPI_SCALE || 2)));
const OCR_MAX_PAGES = Math.max(1, Math.min(500, Number(process.env.OCR_MAX_PAGES || 250)));

// Ensure data directories exist
[DATA_DIR, CONVERSATIONS_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedExts = [
      '.txt', '.md', '.json', '.csv', '.py', '.js', '.ts',
      '.html', '.css', '.svg', '.xml', '.pdf', '.docx',
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not supported`));
    }
  }
});

// ─── Ollama helpers ────────────────────────────────────────────────

function ollamaFetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, OLLAMA_BASE);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function isOllamaRunning() {
  try {
    const res = await ollamaFetch('/', { timeout: 3000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

// ─── API Routes ────────────────────────────────────────────────────

// Check Ollama status
app.get('/api/ollama/status', async (req, res) => {
  try {
    const running = await isOllamaRunning();
    if (!running) {
      return res.json({
        running: false,
        executableExists: fs.existsSync(OLLAMA_EXE),
        executablePath: OLLAMA_EXE
      });
    }
    // Also fetch models
    const tagsRes = await ollamaFetch('/api/tags');
    let models = [];
    try {
      const parsed = JSON.parse(tagsRes.data);
      models = (parsed.models || []).map(m => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at,
        digest: m.digest,
        details: m.details
      }));
    } catch (e) {
      // tags parse failed
    }

    const defaultModelAvailable = models.some(m =>
      m.name === DEFAULT_MODEL || m.name.startsWith(DEFAULT_MODEL.split(':')[0])
    );

    res.json({
      running: true,
      models,
      defaultModel: DEFAULT_MODEL,
      defaultModelAvailable,
      executablePath: OLLAMA_EXE
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Ollama
app.post('/api/ollama/start', async (req, res) => {
  try {
    // Check if already running
    const running = await isOllamaRunning();
    if (running) {
      return res.json({ success: true, message: 'Ollama is already running' });
    }

    // Check executable exists
    if (!fs.existsSync(OLLAMA_EXE)) {
      return res.status(404).json({
        error: `Ollama executable not found at ${OLLAMA_EXE}`
      });
    }

    // Set environment for model storage
    const env = { ...process.env, OLLAMA_MODELS: 'D:\\Ollama\\Models' };

    // Start Ollama serve in detached mode
    const child = spawn(OLLAMA_EXE, ['serve'], {
      detached: true,
      stdio: 'ignore',
      env,
      windowsHide: true
    });
    child.unref();

    // Wait for Ollama to be ready (up to 15 seconds)
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 500));
      const nowRunning = await isOllamaRunning();
      if (nowRunning) {
        return res.json({ success: true, message: 'Ollama started successfully' });
      }
      attempts++;
    }

    res.status(500).json({ error: 'Ollama started but API not responding after 15 seconds' });
  } catch (err) {
    res.status(500).json({ error: `Failed to start Ollama: ${err.message}` });
  }
});

// Chat completion with streaming (proxies to Ollama)
app.post('/api/chat', async (req, res) => {
  const { model, messages, options } = req.body;

  if (!model || !messages) {
    return res.status(400).json({ error: 'model and messages are required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const body = JSON.stringify({
    model,
    messages,
    stream: true,
    options: options || {}
  });

  const url = new URL('/api/chat', OLLAMA_BASE);
  const reqOptions = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    timeout: 300000 // 5 minute timeout for long generations
  };

  let aborted = false;
  let ollamaReq;

  // The incoming request can close as soon as its POST body has been read.
  // Watch the outgoing response instead, so a normal request does not cancel its own stream.
  res.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
      if (ollamaReq && !ollamaReq.destroyed) ollamaReq.destroy();
    }
  });

  ollamaReq = http.request(reqOptions, (ollamaRes) => {
    let buffer = '';

    ollamaRes.on('data', (chunk) => {
      if (aborted) return;

      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          res.write(`data: ${JSON.stringify(parsed)}\n\n`);

          if (parsed.done) {
            res.write('data: [DONE]\n\n');
            res.end();
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    });

    ollamaRes.on('end', () => {
      // Process remaining buffer
      if (buffer.trim() && !aborted) {
        try {
          const parsed = JSON.parse(buffer);
          res.write(`data: ${JSON.stringify(parsed)}\n\n`);
          if (parsed.done) {
            res.write('data: [DONE]\n\n');
          }
        } catch (e) { /* skip */ }
      }
      if (!aborted) {
        res.end();
      }
    });

    ollamaRes.on('error', (err) => {
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    });
  });

  ollamaReq.on('error', (err) => {
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ error: `Ollama connection error: ${err.message}` })}\n\n`);
      res.end();
    }
  });

  ollamaReq.on('timeout', () => {
    ollamaReq.destroy();
    if (!aborted) {
      res.write(`data: ${JSON.stringify({ error: 'Request timed out' })}\n\n`);
      res.end();
    }
  });

  ollamaReq.write(body);
  ollamaReq.end();
});

// ─── Conversation CRUD ─────────────────────────────────────────────

function getConversationPath(id) {
  return path.join(CONVERSATIONS_DIR, `${id}.json`);
}

function loadConversation(id) {
  const p = getConversationPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveConversation(conv) { /* Chat history persistence disabled. */ }

// List all conversations
app.get('/api/conversations', (req, res) => { res.json([]); });

// Get single conversation
app.get('/api/conversations/:id', (req, res) => { res.status(404).json({ error: 'Conversation history is disabled' }); });

// Create conversation
app.post('/api/conversations', (req, res) => {
  const now = new Date().toISOString();
  const conv = { id: crypto.randomUUID(), title: (req.body && req.body.title) || 'New Chat',
    messages: [], createdAt: now, updatedAt: now };
  res.json(conv);
});

// Update conversation (title, messages, etc.)
app.put('/api/conversations/:id', (req, res) => { res.json({ id: req.params.id, ...(req.body || {}) }); });

// Delete conversation
app.delete('/api/conversations/:id', (req, res) => {
  const p = getConversationPath(req.params.id);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

// Search conversations
app.get('/api/conversations/search/:query', (req, res) => { res.json([]); });

// Render PDF pages with PDF.js and run local Tesseract only for pages with no text layer.
// Temporary page images live in the OS temp directory and are removed after each OCR call.
async function extractPdfWithOcr(pdfPath) {
  const bytes = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data: bytes, useSystemFonts: true }).promise;
  if (pdf.numPages > OCR_MAX_PAGES) {
    throw new Error(`PDF has ${pdf.numPages} pages; OCR limit is ${OCR_MAX_PAGES}. Set OCR_MAX_PAGES to raise the limit.`);
  }
  const pages = [];
  let ocrPages = 0;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ogchat-ocr-'));
  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const textContent = await page.getTextContent();
      const selectable = textContent.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
      let pageText = selectable;
      if (selectable.length < 20) {
        const version = page.getViewport({ scale: OCR_DPI_SCALE });
        const canvas = createCanvas(Math.ceil(version.width), Math.ceil(version.height));
        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport: version }).promise;
        const imagePath = path.join(tempDir, `page-${String(pageNo).padStart(5, '0')}.png`);
        fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));
        let result;
        try {
          result = await execFileAsync(TESSERACT_EXE, [imagePath, 'stdout', '-l', OCR_LANG], { windowsHide: true, timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
        } catch (err) {
          if (err.code === 'ENOENT') throw new Error(`Tesseract OCR not found. Install Tesseract or set TESSERACT_PATH. Expected path: ${TESSERACT_EXE}`);
          if (String(err.message || '').toLowerCase().includes('failed loading language')) throw new Error(`Tesseract language data '${OCR_LANG}' is missing. Install that language pack or set OCR_LANG.`);
          throw new Error(`OCR failed on page ${pageNo}: ${err.message}`);
        }
        pageText = String(result.stdout || '').trim();
        ocrPages++;
        try { fs.unlinkSync(imagePath); } catch (_) {}
      }
      pages.push({ page: pageNo, text: pageText });
      page.cleanup();
    }
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    try { await pdf.destroy(); } catch (_) {}
  }
  const content = pages.filter(p => p.text).map(p => `[Page ${p.page}]\n${p.text}`).join('\n\n');
  return { content, pages: pdf.numPages, ocrPages, hasText: !!content.trim() };
}

app.get('/api/ocr/status', async (req, res) => {
  try {
    const result = await execFileAsync(TESSERACT_EXE, ['--version'], { windowsHide: true, timeout: 5000 });
    res.json({ available: true, executable: TESSERACT_EXE, language: OCR_LANG, version: String(result.stdout || '').split(/\r?\n/)[0] });
  } catch (err) {
    res.json({ available: false, executable: TESSERACT_EXE, language: OCR_LANG, error: err.code === 'ENOENT' ? 'Tesseract was not found. Install it or set TESSERACT_PATH.' : err.message });
  }
});

// ─── File upload ───────────────────────────────────────────────────

app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const results = await Promise.all(req.files.map(async (f) => {
      const ext = path.extname(f.originalname).toLowerCase();
      const textExts = ['.txt', '.md', '.json', '.csv', '.py', '.js', '.ts', '.html', '.css', '.svg', '.xml'];
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
      let content = null;
      let base64 = null;
      let extractionError = null;

      try {
        if (textExts.includes(ext)) {
          content = fs.readFileSync(f.path, 'utf-8');
        } else if (ext === '.pdf') {
          const extracted = await extractPdfWithOcr(f.path);
          content = extracted.content || '';
          if (content) {
            content = `[Document: ${f.originalname}; pages: ${extracted.pages}; OCR pages processed: ${extracted.ocrPages}]\n\n` + content;
            f.ocrPages = extracted.ocrPages;
            f.pageCount = extracted.pages;
          } else {
            extractionError = 'No readable text was found, even after OCR. The scan may be blank, very low quality, or use an unsupported language.';
          }
        } else if (ext === '.docx') {
          const parsed = await mammoth.extractRawText({ path: f.path });
          content = (parsed.value || '').trim();
          if (!content) extractionError = 'No readable text found in this DOCX file.';
        } else if (imageExts.includes(ext)) {
          base64 = fs.readFileSync(f.path).toString('base64');
        }
      } catch (err) {
        extractionError = `Could not extract text: ${err.message}`;
      }

      return {
        id: path.parse(f.filename).name,
        originalName: f.originalname,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimetype,
        ext,
        isText: content !== null,
        content,
        base64,
        extractionError,
        ocrPages: f.ocrPages || 0,
        pageCount: f.pageCount || null,
        url: `/uploads/${f.filename}`
      };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: `File processing failed: ${err.message}` });
  }
});

// ─── Tool interface (high-risk tools disabled until sandboxed) ──────
/* Security note: file_system, python, code_execution and git can perform
   arbitrary local actions. Keep them disabled until an isolated sandbox
   and path/command allowlists are implemented. */

const tools = new Map();

// Tool registration interface
function registerTool(name, config) {
  tools.set(name, {
    name,
    description: config.description,
    enabled: config.enabled || false,
    execute: config.execute,
    schema: config.schema || {}
  });
}

// Web search: uses DuckDuckGo's HTML results page; no API key required.
// Keep this server-side so the browser never needs to call the search provider directly.
function decodeSearchHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function stripSearchTags(value) {
  return decodeSearchHtml(String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}
function isPublicWebUrl(value) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return false;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return false;
    if (/^(10\.|127\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch (_) { return false; }
}
async function fetchWebpageText(url) {
  if (!isPublicWebUrl(url)) return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OGChat/1.0; +local-assistant)',
        'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9'
      },
      redirect: 'error',
      signal: controller.signal
    });
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || !(type.includes('text/html') || type.includes('text/plain') || type.includes('application/xhtml'))) return '';
    const raw = await response.text();
    const bounded = raw.slice(0, 600000);
    const text = type.includes('text/plain') ? bounded : bounded
      .replace(/<(script|style|nav|footer|header|noscript|svg|form)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(article|main)\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|article|main|section|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' ');
    return decodeSearchHtml(text).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 7000);
  } catch (_) {
    return '';
  } finally {
    clearTimeout(timer);
  }
}
async function searchWeb(query) {
  const q = String(query || '').trim().slice(0, 300);
  if (!q) throw new Error('Enter a search query.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGChat/1.0; +local-assistant)' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Search provider returned HTTP ' + response.status);
    const html = await response.text();
    const anchors = [...html.matchAll(/<a\b([^>]*class=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)];
    const snippets = [...html.matchAll(/<(?:a|div)\b([^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*)>([\s\S]*?)<\/(?:a|div)>/gi)];
    const results = [];
    for (let i = 0; i < anchors.length && results.length < 5; i++) {
      const hrefMatch = anchors[i][1].match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) continue;
      let url = decodeSearchHtml(hrefMatch[1]);
      try {
        if (url.startsWith('//')) url = 'https:' + url;
        const parsed = new URL(url);
        const redirect = parsed.searchParams.get('uddg');
        if (redirect) url = redirect;
      } catch (_) { continue; }
      if (!isPublicWebUrl(url)) continue;
      const title = stripSearchTags(anchors[i][2]);
      const snippet = stripSearchTags(snippets[i] ? snippets[i][2] : '');
      if (title && url && !results.some(r => r.url === url)) results.push({ title, url, snippet, content: '' });
    }
    if (!results.length) throw new Error('No search results were returned. The provider may be temporarily unavailable or blocking this request.');
    // Fetch a few actual pages, not just snippets. Pages are untrusted and may contain prompt injection.
    await Promise.all(results.slice(0, 3).map(async item => {
      item.content = await fetchWebpageText(item.url);
    }));
    return { query: q, results };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Web search timed out after 12 seconds.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
app.get('/api/web-search', async (req, res) => {
  try {
    const data = await searchWeb(req.query.q);
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Web search failed: ' + err.message });
  }
});

registerTool('web_search', {
  description: 'Search the public web and return titles, URLs, and snippets',
  enabled: true,
  schema: { query: 'string' },
  execute: async (args) => {
    try { return await searchWeb(args.query); }
    catch (e) { return { error: e.message, results: [] }; }
  }
});

registerTool('file_system', {
  description: 'Read and write files on the local file system',
  enabled: false,
  schema: { action: 'string', path: 'string', content: 'string?' },
  execute: async (args) => {
    try {
      const { action, path: filepath, content } = args;
      const fullPath = path.resolve(filepath);
      if (action === 'read') {
        if (!fs.existsSync(fullPath)) return { error: 'File not found' };
        return { content: fs.readFileSync(fullPath, 'utf-8') };
      } else if (action === 'write') {
        fs.writeFileSync(fullPath, content || '');
        return { success: true };
      } else if (action === 'list') {
        return { files: fs.readdirSync(fullPath) };
      } else {
        return { error: 'Invalid action (must be read, write, or list)' };
      }
    } catch (e) {
      return { error: e.message };
    }
  }
});

registerTool('python', {
  description: 'Execute Python code',
  enabled: false,
  schema: { code: 'string' },
  execute: async (args) => {
    try {
      const tmpPath = path.join(require('os').tmpdir(), `script_${uuidv4()}.py`);
      fs.writeFileSync(tmpPath, args.code);
      const output = execSync(`python "${tmpPath}"`, { encoding: 'utf-8' });
      fs.unlinkSync(tmpPath);
      return { output };
    } catch (e) {
      return { error: e.message, output: e.stdout ? e.stdout.toString() : '' };
    }
  }
});

registerTool('code_execution', {
  description: 'Execute JavaScript code in a node environment',
  enabled: false,
  schema: { language: 'string', code: 'string' },
  execute: async (args) => {
    try {
      if (args.language === 'javascript' || args.language === 'node') {
        const output = execSync(`node -e ${JSON.stringify(args.code)}`, { encoding: 'utf-8' });
        return { output };
      }
      return { error: `Language ${args.language} not supported yet.` };
    } catch (e) {
      return { error: e.message, output: e.stdout ? e.stdout.toString() : '' };
    }
  }
});

registerTool('git', {
  description: 'Git operations',
  enabled: false,
  schema: { command: 'string', cwd: 'string?' },
  execute: async (args) => {
    try {
      const cwd = args.cwd ? path.resolve(args.cwd) : process.cwd();
      const output = execSync(`git ${args.command}`, { cwd, encoding: 'utf-8' });
      return { output };
    } catch (e) {
      return { error: e.message, output: e.stdout ? e.stdout.toString() : '' };
    }
  }
});

registerTool('vision', {
  description: 'Analyze images using a vision model (STUBBED)',
  enabled: false,
  schema: { image: 'string' },
  execute: async () => ({ error: 'Vision tool requires a multimodal model and is not yet implemented' })
});

// Memory tool is intentionally session-only: no facts are written to disk.
const sessionMemory = [];
registerTool('memory', {
  description: 'Session-only memory and retrieval (cleared when server restarts)',
  enabled: true,
  schema: { action: 'string', query: 'string?', fact: 'string?' },
  execute: async (args) => {
    if (args.action === 'store' && args.fact) {
      sessionMemory.push({ timestamp: new Date().toISOString(), fact: String(args.fact) });
      return { success: true, note: 'Stored in RAM only; cleared on server restart.' };
    }
    if (args.action === 'retrieve' && args.query) {
      const words = String(args.query).toLowerCase().split(/\\s+/).filter(Boolean);
      return { results: sessionMemory.filter(item => words.some(word => item.fact.toLowerCase().includes(word))) };
    }
    return { error: 'Invalid action (store/retrieve) or missing arguments' };
  }
});

// List available tools
app.get('/api/tools', (req, res) => {
  const toolList = [];
  tools.forEach((tool, name) => {
    toolList.push({
      name,
      description: tool.description,
      enabled: tool.enabled,
      schema: tool.schema
    });
  });
  res.json(toolList);
});

// Execute a tool
app.post('/api/tools/execute', async (req, res) => {
  try {
    const { toolName, args } = req.body;
    const tool = tools.get(toolName);
    if (!tool) {
      return res.status(404).json({ error: `Tool ${toolName} not found` });
    }
    if (!tool.enabled) {
      return res.status(400).json({ error: `Tool ${toolName} is currently disabled` });
    }
    const result = await tool.execute(args || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── App config ────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({
    defaultModel: DEFAULT_MODEL,
    ollamaBase: OLLAMA_BASE,
    ollamaExe: OLLAMA_EXE,
    version: '1.0.0'
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║          OGChat - Local AI Chat          ║`);
  console.log(`  ╠══════════════════════════════════════════╣`);
  console.log(`  ║  App:    http://localhost:${PORT}            ║`);
  console.log(`  ║  Ollama: ${OLLAMA_BASE}       ║`);
  console.log(`  ║  Model:  ${DEFAULT_MODEL}                  ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});
