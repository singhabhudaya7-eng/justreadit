// storage.js — Persistent store: books, progress, bookmarks, stats, config

const BOOKS_KEY     = 'devread_books';
const PROGRESS_KEY  = 'devread_progress';
const CONFIG_KEY    = 'devread_config';
const BOOKMARKS_KEY = 'devread_bookmarks';
const STATS_KEY     = 'devread_stats';

// ── Books ──────────────────────────────────────────────────
export function saveBook(name, paragraphs, chunksPerPage, totalPages) {
  const books = getAllBooks();
  books[name] = { name, paragraphs, chunksPerPage, totalPages, savedAt: Date.now() };
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));

  const progress = getAllProgress();
  if (!progress[name]) {
    progress[name] = { chunkIndex: 0, total: paragraphs.length, firstOpened: null, totalSessions: 0 };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  const stats = getAllStats();
  if (!stats[name]) {
    stats[name] = { totalTimeMs: 0, sessionsCount: 0, lastSessionStart: null };
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }
}

export function loadBook(name) {
  return getAllBooks()[name] || null;
}

export function getAllBooks() {
  try { return JSON.parse(localStorage.getItem(BOOKS_KEY) || '{}'); }
  catch { return {}; }
}

export function deleteBook(name) {
  for (const key of [BOOKS_KEY, PROGRESS_KEY, BOOKMARKS_KEY, STATS_KEY]) {
    try {
      const store = JSON.parse(localStorage.getItem(key) || '{}');
      delete store[name];
      localStorage.setItem(key, JSON.stringify(store));
    } catch {}
  }
}

// ── Progress ───────────────────────────────────────────────
export function getAllProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
  catch { return {}; }
}

export function getProgress(name) {
  const prog = getAllProgress();
  const book = loadBook(name);
  const total = book ? book.paragraphs.length : 0;
  return { chunkIndex: 0, total, ...prog[name] };
}

export function setProgress(name, chunkIndex) {
  const progress = getAllProgress();
  const book = loadBook(name);
  const existing = progress[name] || {};
  progress[name] = {
    ...existing,
    chunkIndex,
    total: book ? book.paragraphs.length : (existing.total || 0),
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

// ── Sessions ───────────────────────────────────────────────
export function recordSessionStart(name) {
  const progress = getAllProgress();
  const existing = progress[name] || {};
  progress[name] = {
    ...existing,
    lastOpened: Date.now(),
    firstOpened: existing.firstOpened || Date.now(),
    totalSessions: (existing.totalSessions || 0) + 1,
  };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));

  const stats = getAllStats();
  const s = stats[name] || {};
  s.sessionsCount = (s.sessionsCount || 0) + 1;
  s.lastSessionStart = Date.now();
  stats[name] = s;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordSessionEnd(name, elapsedMs) {
  if (!name || elapsedMs < 2000) return; // ignore very short sessions
  const stats = getAllStats();
  const s = stats[name] || {};
  s.totalTimeMs = (s.totalTimeMs || 0) + elapsedMs;
  s.lastSessionMs = elapsedMs;
  s.lastSessionStart = null;
  stats[name] = s;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// ── Bookmarks ──────────────────────────────────────────────
export function getAllBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '{}'); }
  catch { return {}; }
}

export function getBookmarks(name) {
  return getAllBookmarks()[name] || [];
}

export function toggleBookmark(name, chunkIndex, snippet = '') {
  const bm = getAllBookmarks();
  if (!bm[name]) bm[name] = [];
  const idx = bm[name].findIndex(b => b.index === chunkIndex);
  if (idx >= 0) {
    bm[name].splice(idx, 1);
  } else {
    bm[name].push({ index: chunkIndex, snippet: snippet.slice(0, 100), createdAt: Date.now() });
    bm[name].sort((a, b) => a.index - b.index);
  }
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bm));
  return bm[name];
}

export function isBookmarked(name, chunkIndex) {
  return !!(getAllBookmarks()[name] || []).find(b => b.index === chunkIndex);
}

// ── Stats ──────────────────────────────────────────────────
export function getAllStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); }
  catch { return {}; }
}

export function getStats(name) {
  return { totalTimeMs: 0, sessionsCount: 0, lastSessionMs: null, ...getAllStats()[name] };
}

// ── Config ─────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  appMode:      'vscode',    // 'vscode' | 'terminal'
  disguiseMode: 'vscode',    // 'logs' | 'code' | 'docs' | 'diff' | 'vscode'
  vsActivity:   'explorer',  // 'explorer' | 'bookmarks' | 'stats'
  termMode:     'logs',      // terminal disguise sub-mode
};

export function getConfig() {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }; }
  catch { return { ...DEFAULT_CONFIG }; }
}

export function setConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}
