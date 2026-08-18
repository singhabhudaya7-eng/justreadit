// ReaderLayout.jsx — Dedicated e-reader mode: plain readable prose, scroll or page-flip,
// day/night themes, bookmarks, highlights. No code/log disguise here — this mode is meant
// to look and feel like a proper on-web reader (Kindle-for-web), not like work.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Menu, Bookmark, BookmarkCheck, Sun, Moon, Plus, Minus,
  AlignJustify, BookOpen, HelpCircle, Monitor, X, Upload, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  setProgress, getProgress, getBookmarks, toggleBookmark, isBookmarked,
  recordSessionStart, recordSessionEnd, getHighlights, addHighlight, removeHighlight,
} from '../utils/storage';

function fmtRelative(ts) {
  if (!ts) return '';
  const m = Math.floor((Date.now() - ts) / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

const THEMES = [
  { id: 'dark-white', label: 'Dark · White',  icon: 'moon' },
  { id: 'dark-yellow', label: 'Dark · Amber', icon: 'moon' },
  { id: 'light-black', label: 'Light · Black', icon: 'sun' },
  { id: 'sepia',       label: 'Sepia',         icon: 'sun' },
];
const HL_COLORS = ['yellow', 'green', 'pink'];
const FONT_SIZES = [15, 17, 19, 21, 23];
const PAGE_CHAR_BUDGET = [2800, 2400, 2000, 1650, 1350]; // rough chars/page per font size step

export default function ReaderLayout({
  books, activeBook, activeBookName, config, onOpenBook, onFileUpload,
  onConfigChange, onShowModeMenu, onBooksChange, onDeleteBook,
}) {
  const style      = config.readerStyle || 'scroll';
  const theme      = config.readerTheme || 'dark-white';
  const fontStep   = config.readerFontSize ?? 2;

  const [curIndex,   setCurIndex]   = useState(0);
  const [bookmarks,  setBookmarks]  = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [showLibrary, setShowLibrary] = useState(!activeBook);
  const [showHelp,    setShowHelp]    = useState(false);
  const [showThemes,  setShowThemes]  = useState(false);
  const [showToast,   setShowToast]   = useState(false);
  const [selPopover,  setSelPopover]  = useState(null); // { x, y, paraIdx, start, end, text }

  const contentRef     = useRef(null);
  const curIndexRef    = useRef(0);
  const sessionStartMs = useRef(Date.now());
  const saveTimer      = useRef(null);
  const fileInputRef   = useRef(null);
  const didInitScroll  = useRef(false);
  const toastTimer     = useRef(null);

  const paragraphs = activeBook?.paragraphs || [];
  const total      = paragraphs.length;

  // ── Pagination (flip mode) ──────────────────────────────
  const pages = useMemo(() => {
    if (style !== 'flip' || !paragraphs.length) return [];
    const budget = PAGE_CHAR_BUDGET[fontStep] || 2000;
    const out = [];
    let cur = [];
    let curLen = 0;
    let startIdx = 0;
    paragraphs.forEach((p, i) => {
      if (curLen > 0 && curLen + p.length > budget) {
        out.push({ startIdx, paraIdx: [...Array(cur.length)].map((_, k) => startIdx + k), text: cur });
        cur = []; curLen = 0; startIdx = i;
      }
      cur.push(p);
      curLen += p.length;
    });
    if (cur.length) out.push({ startIdx, paraIdx: [...Array(cur.length)].map((_, k) => startIdx + k), text: cur });
    return out;
  }, [style, activeBookName, fontStep]);

  const curPageIdx = useMemo(() => {
    if (!pages.length) return 0;
    let p = 0;
    for (let i = 0; i < pages.length; i++) if (pages[i].startIdx <= curIndex) p = i; else break;
    return p;
  }, [pages, curIndex]);

  // ── Book open/close bookkeeping ─────────────────────────
  useEffect(() => {
    if (!activeBookName) { setShowLibrary(true); return; }
    setShowLibrary(false);
    didInitScroll.current = false;
    const prog = getProgress(activeBookName);
    curIndexRef.current = prog.chunkIndex || 0;
    setCurIndex(prog.chunkIndex || 0);
    setBookmarks(getBookmarks(activeBookName));
    setHighlights(getHighlights(activeBookName));
    sessionStartMs.current = Date.now();
    recordSessionStart(activeBookName);

    setShowToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), 5000);

    return () => {
      const elapsed = Date.now() - sessionStartMs.current;
      recordSessionEnd(activeBookName, elapsed);
    };
  }, [activeBookName]);

  // Initial scroll restore (scroll mode only)
  useEffect(() => {
    if (style !== 'scroll' || !paragraphs.length || didInitScroll.current || !contentRef.current) return;
    const target = curIndexRef.current;
    if (target === 0) { didInitScroll.current = true; return; }
    const t = setTimeout(() => {
      const el = contentRef.current?.querySelector(`[data-reader-para="${target}"]`);
      if (el) { el.scrollIntoView({ block: 'start' }); didInitScroll.current = true; }
    }, 60);
    return () => clearTimeout(t);
  }, [style, paragraphs]);

  const onScroll = useCallback(() => {
    if (style !== 'scroll' || !contentRef.current) return;
    const container = contentRef.current;
    const focalY = container.getBoundingClientRect().top + container.getBoundingClientRect().height * 0.3;
    const els = container.querySelectorAll('[data-reader-para]');
    let found = 0, minDist = Infinity;
    for (const el of els) {
      const dist = Math.abs(el.getBoundingClientRect().top - focalY);
      if (dist < minDist) { minDist = dist; found = parseInt(el.dataset.readerPara, 10); }
    }
    if (found !== curIndexRef.current) {
      curIndexRef.current = found;
      setCurIndex(found);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setProgress(activeBookName, found), 500);
    }
  }, [style, activeBookName]);

  const goToPara = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(total - 1, idx));
    curIndexRef.current = clamped;
    setCurIndex(clamped);
    setProgress(activeBookName, clamped);
    if (style === 'scroll') {
      const el = contentRef.current?.querySelector(`[data-reader-para="${clamped}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [total, activeBookName, style]);

  const nextPage = useCallback(() => {
    if (style === 'flip') {
      const next = Math.min(pages.length - 1, curPageIdx + 1);
      goToPara(pages[next]?.startIdx ?? curIndex);
    } else goToPara(curIndexRef.current + 1);
  }, [style, pages, curPageIdx, curIndex, goToPara]);

  const prevPage = useCallback(() => {
    if (style === 'flip') {
      const prev = Math.max(0, curPageIdx - 1);
      goToPara(pages[prev]?.startIdx ?? curIndex);
    } else goToPara(curIndexRef.current - 1);
  }, [style, pages, curPageIdx, curIndex, goToPara]);

  const toggleBm = useCallback(() => {
    if (!activeBookName) return;
    const snippet = paragraphs[curIndexRef.current]?.slice(0, 90) || '';
    setBookmarks(toggleBookmark(activeBookName, curIndexRef.current, snippet));
  }, [activeBookName, paragraphs]);

  const cycleTheme = useCallback(() => {
    const i = THEMES.findIndex(t => t.id === theme);
    onConfigChange({ readerTheme: THEMES[(i + 1) % THEMES.length].id });
  }, [theme, onConfigChange]);

  // ── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (showHelp) { if (e.key === 'Escape' || e.key === '?') setShowHelp(false); return; }
      switch (e.key) {
        case ' ': case 'ArrowRight': case 'ArrowDown':
          e.preventDefault(); nextPage(); break;
        case 'ArrowLeft': case 'ArrowUp':
          e.preventDefault(); prevPage(); break;
        case 'd': case 'D':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); toggleBm(); }
          break;
        case 'f': case 'F':
          onConfigChange({ readerStyle: style === 'scroll' ? 'flip' : 'scroll' }); break;
        case 'n': case 'N':
          cycleTheme(); break;
        case '?':
          setShowHelp(true); break;
        case 'Escape':
          setShowLibrary(false); setShowThemes(false); setSelPopover(null); break;
        case 'm': case 'M':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); onShowModeMenu(); }
          break;
        default: break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [nextPage, prevPage, toggleBm, style, cycleTheme, showHelp, onConfigChange, onShowModeMenu]);

  // ── Highlighting via text selection ─────────────────────
  const onMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { setSelPopover(null); return; }
    const range = sel.getRangeAt(0);
    const paraEl = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer.closest?.('[data-reader-para]')
      : range.commonAncestorContainer.parentElement?.closest('[data-reader-para]');
    if (!paraEl) { setSelPopover(null); return; }
    const paraIdx = parseInt(paraEl.dataset.readerPara, 10);
    const text = sel.toString();
    if (!text.trim()) { setSelPopover(null); return; }

    const start = textOffsetWithin(paraEl, range.startContainer, range.startOffset);
    const end   = start + text.length;
    const rect  = range.getBoundingClientRect();
    setSelPopover({ x: rect.left + rect.width / 2, y: rect.top, paraIdx, start, end, text });
  }, []);

  const applyHighlight = useCallback((color) => {
    if (!selPopover || !activeBookName) return;
    const { paraIdx, start, end, text } = selPopover;
    setHighlights(addHighlight(activeBookName, { paraIdx, start, end, text, color }));
    setSelPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [selPopover, activeBookName]);

  const removeHl = useCallback((id) => {
    if (!activeBookName) return;
    setHighlights(removeHighlight(activeBookName, id));
  }, [activeBookName]);

  const pct = total > 0 ? Math.round((curIndex / total) * 100) : 0;
  const bmActive = activeBookName ? isBookmarked(activeBookName, curIndex) : false;

  const visibleParas = style === 'flip'
    ? (pages[curPageIdx]?.paraIdx || [])
    : paragraphs.map((_, i) => i);

  return (
    <div className="reader-shell" data-reader-theme={theme} style={{ '--reader-font-size': `${FONT_SIZES[fontStep]}px` }}>
      {/* ── Top bar ── */}
      <div className="reader-topbar">
        <button className="reader-icon-btn" onClick={() => setShowLibrary(v => !v)} title="Library">
          <Menu size={17} />
        </button>
        <div className="reader-title">{activeBookName || 'devread reader'}</div>
        <div className="reader-topbar-actions">
          {activeBook && (
            <>
              <button className="reader-icon-btn" onClick={() => onConfigChange({ readerFontSize: Math.max(0, fontStep - 1) })} title="Smaller text">
                <Minus size={15} />
              </button>
              <button className="reader-icon-btn" onClick={() => onConfigChange({ readerFontSize: Math.min(FONT_SIZES.length - 1, fontStep + 1) })} title="Larger text">
                <Plus size={15} />
              </button>
              <button
                className="reader-icon-btn"
                onClick={() => onConfigChange({ readerStyle: style === 'scroll' ? 'flip' : 'scroll' })}
                title={`Switch to ${style === 'scroll' ? 'page flip' : 'scroll'} (F)`}
              >
                {style === 'scroll' ? <BookOpen size={16} /> : <AlignJustify size={16} />}
              </button>
              <div className="reader-theme-wrap">
                <button className="reader-icon-btn" onClick={() => setShowThemes(v => !v)} title="Reading theme (N)">
                  {theme.startsWith('dark') ? <Moon size={15} /> : <Sun size={15} />}
                </button>
                {showThemes && (
                  <div className="reader-theme-menu">
                    {THEMES.map(t => (
                      <button
                        key={t.id}
                        className={`reader-theme-opt reader-swatch-${t.id} ${theme === t.id ? 'active' : ''}`}
                        onClick={() => { onConfigChange({ readerTheme: t.id }); setShowThemes(false); }}
                      >{t.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button className={`reader-icon-btn ${bmActive ? 'active' : ''}`} onClick={toggleBm} title="Bookmark (Ctrl+D)">
                {bmActive ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </button>
            </>
          )}
          <button className="reader-icon-btn" onClick={() => setShowHelp(true)} title="Shortcuts (?)"><HelpCircle size={16} /></button>
          <button className="reader-icon-btn" onClick={onShowModeMenu} title="Switch view mode (Ctrl+M)"><Monitor size={16} /></button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="reader-body">
        {!activeBook ? (
          <ReaderWelcome onFileUpload={onFileUpload} fileInputRef={fileInputRef} />
        ) : style === 'scroll' ? (
          <div className="reader-content reader-content-scroll" ref={contentRef} onScroll={onScroll} onMouseUp={onMouseUp}>
            <div className="reader-page-inner">
              {visibleParas.map(i => (
                <p key={i} data-reader-para={i} className={`reader-para ${i === curIndex ? 'reader-para-active' : ''}`}>
                  {renderWithHighlights(paragraphs[i], highlights.filter(h => h.paraIdx === i), removeHl)}
                </p>
              ))}
              <div style={{ height: '50vh' }} />
            </div>
          </div>
        ) : (
          <div className="reader-content reader-content-flip" onMouseUp={onMouseUp}>
            <button className="reader-flip-btn reader-flip-left" onClick={prevPage} disabled={curPageIdx === 0}>
              <ChevronLeft size={20} />
            </button>
            <div className="reader-page-inner reader-page-flip" key={curPageIdx}>
              {visibleParas.map(i => (
                <p key={i} data-reader-para={i} className="reader-para">
                  {renderWithHighlights(paragraphs[i], highlights.filter(h => h.paraIdx === i), removeHl)}
                </p>
              ))}
            </div>
            <button className="reader-flip-btn reader-flip-right" onClick={nextPage} disabled={curPageIdx >= pages.length - 1}>
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* ── Footer / progress ── */}
      {activeBook && (
        <div className="reader-footer">
          <div className="reader-progress-bar"><div className="reader-progress-fill" style={{ width: `${pct}%` }} /></div>
          <div className="reader-footer-text">
            {style === 'flip'
              ? <span>Page {curPageIdx + 1} of {pages.length || 1}</span>
              : <span>Paragraph {curIndex + 1} of {total}</span>}
            <span className="reader-footer-sep">·</span>
            <span>{pct}% read</span>
          </div>
        </div>
      )}

      {/* ── Selection → highlight popover ── */}
      {selPopover && (
        <div className="reader-hl-popover" style={{ left: selPopover.x, top: selPopover.y }}>
          {HL_COLORS.map(c => (
            <button key={c} className={`reader-hl-swatch reader-hl-${c}`} onClick={() => applyHighlight(c)} title={`Highlight ${c}`} />
          ))}
        </div>
      )}

      {/* ── Shortcuts toast (auto-dismiss) ── */}
      {showToast && activeBook && (
        <div className="reader-toast" onClick={() => setShowToast(false)}>
          <span className="kbd">Space</span> next · <span className="kbd">←</span> prev ·{' '}
          <span className="kbd">Ctrl+D</span> bookmark · select text to highlight ·{' '}
          <span className="kbd">?</span> all shortcuts
        </div>
      )}

      {/* ── Library drawer ── */}
      {showLibrary && (
        <div className="reader-library-overlay" onClick={() => activeBook && setShowLibrary(false)}>
          <div className="reader-library" onClick={e => e.stopPropagation()}>
            <div className="reader-library-header">
              <span>Library</span>
              {activeBook && <button onClick={() => setShowLibrary(false)}><X size={14} /></button>}
            </div>
            <button className="reader-library-import" onClick={() => fileInputRef.current?.click()}>
              <Upload size={13} /> Import PDF
            </button>
            <div className="reader-library-list">
              {Object.values(books).length === 0 && (
                <div className="reader-library-empty">No books yet. Import a PDF to start reading.</div>
              )}
              {Object.values(books).map(b => {
                const p = getProgress(b.name);
                const p2 = p.total > 0 ? Math.round((p.chunkIndex / p.total) * 100) : 0;
                return (
                  <div key={b.name} className={`reader-library-item ${b.name === activeBookName ? 'active' : ''}`}
                    onClick={() => onOpenBook(b.name)}>
                    <div className="reader-library-item-name">{b.name}</div>
                    <div className="reader-library-item-bar"><div style={{ width: `${p2}%` }} /></div>
                    <div className="reader-library-item-pct">{p2}%</div>
                    <button className="reader-library-item-del" onClick={e => { e.stopPropagation(); onDeleteBook(b.name); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {activeBookName && (
              <>
                <div className="reader-library-header" style={{ borderTop: '1px solid var(--rt-border)' }}>
                  <span>Bookmarks — {activeBookName}</span>
                </div>
                <div className="reader-library-list">
                  {bookmarks.length === 0 && (
                    <div className="reader-library-empty">No bookmarks yet. Press <span className="kbd">Ctrl+D</span> while reading.</div>
                  )}
                  {bookmarks.map(bm => (
                    <div key={bm.index} className={`reader-library-item ${bm.index === curIndex ? 'active' : ''}`}
                      onClick={() => { goToPara(bm.index); setShowLibrary(false); }}>
                      <div className="reader-library-item-name">
                        ¶{bm.index + 1} — {bm.snippet || '(no preview)'}
                      </div>
                      <div className="reader-library-item-pct">{fmtRelative(bm.createdAt)}</div>
                      <button className="reader-library-item-del" onClick={e => {
                        e.stopPropagation();
                        setBookmarks(toggleBookmark(activeBookName, bm.index));
                      }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); }} />

      {/* ── Help overlay ── */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-panel" onClick={e => e.stopPropagation()}>
            <h2>devread reader — shortcuts</h2>
            {[
              [['SPACE', '→'], 'Next paragraph / page'],
              [['←'],          'Previous paragraph / page'],
              [['Ctrl+D'],     'Toggle bookmark'],
              [['F'],          'Toggle scroll ↔ page-flip'],
              [['N'],          'Cycle reading theme'],
              [['Ctrl+M'],     'Switch view mode'],
              [['?'],          'Show this help'],
              [['ESC'],        'Close overlays'],
            ].map(([keys, desc]) => (
              <div className="help-row" key={desc}>
                <div className="help-keys">{keys.map(k => <span key={k} className="kbd">{k}</span>)}</div>
                <div className="help-desc">{desc}</div>
              </div>
            ))}
            <p style={{ marginTop: 10, opacity: .7, fontSize: 12 }}>Select any text to highlight it.</p>
            <div style={{ marginTop: 16 }}>
              <button className="term-btn" onClick={() => setShowHelp(false)}><X size={12} /> Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Walk text nodes inside `container` up to (node, offset) and return the cumulative char count —
// robust against nested <mark> spans from existing highlights.
function textOffsetWithin(container, node, offset) {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let cur;
  while ((cur = walker.nextNode())) {
    if (cur === node) return total + offset;
    total += cur.textContent.length;
  }
  return total;
}

function renderWithHighlights(text, paraHighlights, onRemove) {
  if (!text) return text;
  if (!paraHighlights || !paraHighlights.length) return text;
  const sorted = [...paraHighlights].sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;
  sorted.forEach((h, i) => {
    const s = Math.max(cursor, Math.min(h.start, text.length));
    const e = Math.max(s, Math.min(h.end, text.length));
    if (s > cursor) out.push(text.slice(cursor, s));
    if (e > s) out.push(
      <mark
        key={h.id || i}
        className={`reader-hl-mark reader-hl-${h.color}`}
        title="Click to remove highlight"
        onClick={(ev) => { ev.stopPropagation(); onRemove?.(h.id); }}
      >{text.slice(s, e)}</mark>
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function ReaderWelcome({ onFileUpload, fileInputRef }) {
  return (
    <div className="reader-welcome">
      <div className="reader-welcome-icon"><BookOpen size={44} strokeWidth={1} /></div>
      <div className="reader-welcome-title">devread reader</div>
      <div className="reader-welcome-sub">A clean, sexy e-reader for your PDFs. Scroll or flip pages, day or night.</div>
      <button className="reader-welcome-btn" onClick={() => fileInputRef.current?.click()}>
        <Upload size={14} /> Import PDF
      </button>
      <div className="reader-welcome-drop"
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }}
        onDragLeave={e => e.currentTarget.classList.remove('dragging')}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.classList.remove('dragging');
          const f = e.dataTransfer.files?.[0];
          if (f) onFileUpload(f);
        }}
      >
        or drop a .pdf here
      </div>
    </div>
  );
}
