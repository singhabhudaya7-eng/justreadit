// storage.js — Persistent store: books, progress, bookmarks, highlights, stats, config.
// Backed by IndexedDB (src/utils/db.js). Metadata stores are hydrated into an in-memory
// cache once at boot (initStorage) so every read below stays synchronous — only the heavy
// per-book payload (paragraphs + original PDF blob) is fetched on demand, async.

import { dbGet, dbGetAll, dbSet, dbDelete } from './db';

const LS_BOOKS     = 'devread_books';
const LS_PROGRESS  = 'devread_progress';
const LS_CONFIG    = 'devread_config';
const LS_BOOKMARKS = 'devread_bookmarks';
const LS_STATS     = 'devread_stats';

export const DEFAULT_CONFIG = {
  appMode:        'vscode',   // 'vscode' | 'terminal' | 'reader' | 'excel' | 'cmd'
  disguiseMode:   'vscode',   // 'logs' | 'code' | 'docs' | 'diff' | 'vscode'
  vsActivity:     'explorer', // 'explorer' | 'bookmarks' | 'stats'
  termMode:       'logs',     // terminal disguise sub-mode
  readerStyle:    'scroll',   // 'scroll' | 'flip'
  readerTheme:    'dark-white',
  readerFontSize: 2,          // index into READER_FONT_SIZES (see ReaderLayout)
  readerTwoPage:  false,      // flip mode: show two pages side by side
};

const _cache = {
  books:      {},
  progress:   {},
  bookmarks:  {},
  stats:      {},
  highlights: {},
  config:     { ...DEFAULT_CONFIG },
};

let _ready = false;

// ── Boot ───────────────────────────────────────────────────
export async function initStorage() {
  if (_ready) return _cache;

  const existingBooks = await dbGetAll('books');
  if (Object.keys(existingBooks).length === 0) {
    await migrateFromLocalStorage();
  }

  _cache.books      = await dbGetAll('books');
  _cache.progress   = await dbGetAll('progress');
  _cache.bookmarks  = await dbGetAll('bookmarks');
  _cache.stats      = await dbGetAll('stats');
  _cache.highlights = await dbGetAll('highlights');
  const cfg = await dbGet('config', 'app');
  _cache.config = { ...DEFAULT_CONFIG, ...(cfg || {}) };

  _ready = true;
  return _cache;
}

async function migrateFromLocalStorage() {
  try {
    const oldBooks = JSON.parse(localStorage.getItem(LS_BOOKS) || '{}');
    for (const [name, b] of Object.entries(oldBooks)) {
      await dbSet('books', name, {
        name,
        chunksPerPage:    b.chunksPerPage,
        totalPages:       b.totalPages,
        totalParagraphs:  (b.paragraphs || []).length,
        savedAt:          b.savedAt || Date.now(),
      });
      await dbSet('bookText', name, { paragraphs: b.paragraphs || [], pdfBlob: null });
    }

    const oldProgress = JSON.parse(localStorage.getItem(LS_PROGRESS) || '{}');
    for (const [name, p] of Object.entries(oldProgress)) await dbSet('progress', name, p);

    const oldBookmarks = JSON.parse(localStorage.getItem(LS_BOOKMARKS) || '{}');
    for (const [name, bm] of Object.entries(oldBookmarks)) await dbSet('bookmarks', name, bm);

    const oldStats = JSON.parse(localStorage.getItem(LS_STATS) || '{}');
    for (const [name, s] of Object.entries(oldStats)) await dbSet('stats', name, s);

    const oldConfig = JSON.parse(localStorage.getItem(LS_CONFIG) || '{}');
    if (Object.keys(oldConfig).length) await dbSet('config', 'app', { ...DEFAULT_CONFIG, ...oldConfig });
  } catch (err) {
    console.error('devread: localStorage migration failed', err);
  }
}

// ── Books ──────────────────────────────────────────────────
export async function saveBook(name, paragraphs, chunksPerPage, totalPages, pdfBlob = null) {
  const meta = {
    name,
    chunksPerPage,
    totalPages,
    totalParagraphs: paragraphs.length,
    savedAt: Date.now(),
  };
  _cache.books[name] = meta;
  await dbSet('books', name, meta);
  await dbSet('bookText', name, { paragraphs, pdfBlob });

  if (!_cache.progress[name]) {
    _cache.progress[name] = { chunkIndex: 0, total: paragraphs.length, firstOpened: null, totalSessions: 0 };
    dbSet('progress', name, _cache.progress[name]).catch(console.error);
  }
  if (!_cache.stats[name]) {
    _cache.stats[name] = { totalTimeMs: 0, sessionsCount: 0, lastSessionStart: null };
    dbSet('stats', name, _cache.stats[name]).catch(console.error);
  }
}

export async function loadBook(name) {
  const meta = _cache.books[name];
  if (!meta) return null;
  const text = await dbGet('bookText', name);
  if (!text) return null;
  return { ...meta, paragraphs: text.paragraphs, pdfBlob: text.pdfBlob };
}

export function getAllBooks() {
  return _cache.books;
}

export function deleteBook(name) {
  delete _cache.books[name];
  delete _cache.progress[name];
  delete _cache.bookmarks[name];
  delete _cache.stats[name];
  delete _cache.highlights[name];
  for (const store of ['books', 'bookText', 'progress', 'bookmarks', 'stats', 'highlights']) {
    dbDelete(store, name).catch(console.error);
  }
}

// ── Progress ───────────────────────────────────────────────
export function getAllProgress() {
  return _cache.progress;
}

export function getProgress(name) {
  const book  = _cache.books[name];
  const total = book ? book.totalParagraphs : 0;
  return { chunkIndex: 0, total, ..._cache.progress[name] };
}

export function setProgress(name, chunkIndex) {
  const book     = _cache.books[name];
  const existing = _cache.progress[name] || {};
  const updated  = {
    ...existing,
    chunkIndex,
    total: book ? book.totalParagraphs : (existing.total || 0),
  };
  _cache.progress[name] = updated;
  dbSet('progress', name, updated).catch(console.error);
}

// ── Sessions ───────────────────────────────────────────────
export function recordSessionStart(name) {
  const existing = _cache.progress[name] || {};
  const updated = {
    ...existing,
    lastOpened: Date.now(),
    firstOpened: existing.firstOpened || Date.now(),
    totalSessions: (existing.totalSessions || 0) + 1,
  };
  _cache.progress[name] = updated;
  dbSet('progress', name, updated).catch(console.error);

  const s = { ...(_cache.stats[name] || {}) };
  s.sessionsCount = (s.sessionsCount || 0) + 1;
  s.lastSessionStart = Date.now();
  _cache.stats[name] = s;
  dbSet('stats', name, s).catch(console.error);
}

export function recordSessionEnd(name, elapsedMs) {
  if (!name || elapsedMs < 2000) return; // ignore very short sessions
  const s = { ...(_cache.stats[name] || {}) };
  s.totalTimeMs = (s.totalTimeMs || 0) + elapsedMs;
  s.lastSessionMs = elapsedMs;
  s.lastSessionStart = null;
  _cache.stats[name] = s;
  dbSet('stats', name, s).catch(console.error);
}

// ── Bookmarks ──────────────────────────────────────────────
export function getAllBookmarks() {
  return _cache.bookmarks;
}

export function getBookmarks(name) {
  return _cache.bookmarks[name] || [];
}

export function toggleBookmark(name, chunkIndex, snippet = '') {
  const list = [...(_cache.bookmarks[name] || [])];
  const idx  = list.findIndex(b => b.index === chunkIndex);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push({ index: chunkIndex, snippet: snippet.slice(0, 100), createdAt: Date.now() });
    list.sort((a, b) => a.index - b.index);
  }
  _cache.bookmarks[name] = list;
  dbSet('bookmarks', name, list).catch(console.error);
  return list;
}

export function isBookmarked(name, chunkIndex) {
  return !!(_cache.bookmarks[name] || []).find(b => b.index === chunkIndex);
}

// ── Highlights ─────────────────────────────────────────────
export function getAllHighlights() {
  return _cache.highlights;
}

export function getHighlights(name) {
  return _cache.highlights[name] || [];
}

export function addHighlight(name, { paraIdx, start, end, text, color }) {
  const list = [...(_cache.highlights[name] || [])];
  list.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    paraIdx, start, end, text, color: color || 'yellow',
    createdAt: Date.now(),
  });
  list.sort((a, b) => a.paraIdx - b.paraIdx || a.start - b.start);
  _cache.highlights[name] = list;
  dbSet('highlights', name, list).catch(console.error);
  return list;
}

export function removeHighlight(name, id) {
  const list = (_cache.highlights[name] || []).filter(h => h.id !== id);
  _cache.highlights[name] = list;
  dbSet('highlights', name, list).catch(console.error);
  return list;
}

// ── Stats ──────────────────────────────────────────────────
export function getAllStats() {
  return _cache.stats;
}

export function getStats(name) {
  return { totalTimeMs: 0, sessionsCount: 0, lastSessionMs: null, ..._cache.stats[name] };
}

// ── Config ─────────────────────────────────────────────────
export function getConfig() {
  return _cache.config;
}

export function setConfig(cfg) {
  _cache.config = cfg;
  dbSet('config', 'app', cfg).catch(console.error);
}
