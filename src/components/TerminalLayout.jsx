// TerminalLayout.jsx — Terminal-disguise reading mode (continuous scroll, no fighting)
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Bookmark, BookmarkCheck,
  Search, X, HelpCircle, Monitor, SkipBack, SkipForward,
} from 'lucide-react';
import TerminalLine from './TerminalLine';
import { renderChunk, resetTimestamp } from '../utils/disguise';
import {
  setProgress, getProgress, getBookmarks, toggleBookmark, isBookmarked,
  recordSessionStart, recordSessionEnd, getStats,
} from '../utils/storage';

const TERM_MODES = ['logs', 'code', 'docs', 'diff'];

export default function TerminalLayout({
  books, activeBook, activeBookName, config, onOpenBook, onFileUpload,
  onConfigChange, onShowModeMenu, onBooksChange, onDeleteBook,
}) {
  const disguiseMode  = config.termMode || 'logs';
  const [curIndex, setCurIndex]       = useState(0);
  const [bookmarks, setBookmarks]     = useState([]);
  const [showHelp, setShowHelp]       = useState(false);
  const [showJump, setShowJump]       = useState(false);
  const [jumpVal,  setJumpVal]        = useState('');
  const [showBmPanel, setShowBmPanel] = useState(false);

  const bodyRef        = useRef(null);
  const curIndexRef    = useRef(0);
  const sessionStartMs = useRef(Date.now());
  const saveTimer      = useRef(null);
  const jumpRef        = useRef(null);
  const fileInputRef   = useRef(null);
  const didInitScroll  = useRef(false);

  const paragraphs = activeBook?.paragraphs || [];
  const total      = paragraphs.length;

  // Pre-render all chunks (only when book or mode changes)
  const allLines = useMemo(() => {
    if (!paragraphs.length) return [];
    resetTimestamp();
    const out = [];
    paragraphs.forEach((para, paraIdx) => {
      const lines = renderChunk(para, disguiseMode);
      lines.forEach(line => out.push({ ...line, paraIdx }));
      out.push({ type: 'term-separator', paraIdx });
    });
    return out;
  }, [activeBookName, disguiseMode]);

  // Reset state on book change
  useEffect(() => {
    if (!activeBookName) return;
    didInitScroll.current = false;
    const prog = getProgress(activeBookName);
    curIndexRef.current = prog.chunkIndex || 0;
    setCurIndex(prog.chunkIndex || 0);
    setBookmarks(getBookmarks(activeBookName));
    sessionStartMs.current = Date.now();
    recordSessionStart(activeBookName);

    return () => {
      const elapsed = Date.now() - sessionStartMs.current;
      recordSessionEnd(activeBookName, elapsed);
    };
  }, [activeBookName]);

  // Initial scroll to saved position (fires once after lines render)
  useEffect(() => {
    if (!allLines.length || didInitScroll.current || !bodyRef.current) return;
    const target = curIndexRef.current;
    if (target === 0) { didInitScroll.current = true; return; }
    // Small delay to let DOM paint
    const t = setTimeout(() => {
      const el = bodyRef.current?.querySelector(`[data-para="${target}"]`);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        didInitScroll.current = true;
      }
    }, 60);
    return () => clearTimeout(t);
  }, [allLines]);

  // Scroll tracking — updates current index based on scroll position
  const onScroll = useCallback(() => {
    if (!bodyRef.current) return;
    const containerTop = bodyRef.current.getBoundingClientRect().top;
    const els = bodyRef.current.querySelectorAll('[data-para]');
    let found = 0;
    for (const el of els) {
      const top = el.getBoundingClientRect().top - containerTop;
      if (top <= 80) found = parseInt(el.dataset.para, 10);
      else break;
    }
    if (found !== curIndexRef.current) {
      curIndexRef.current = found;
      setCurIndex(found);
      // Debounced save
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setProgress(activeBookName, found);
      }, 500);
    }
  }, [activeBookName]);

  // Explicit navigation (called by buttons/keyboard — uses scrollIntoView intentionally)
  const navigateTo = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(total - 1, idx));
    const el = bodyRef.current?.querySelector(`[data-para="${clamped}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [total]);

  const toggleBm = useCallback(() => {
    if (!activeBookName) return;
    const snippet = paragraphs[curIndexRef.current]?.slice(0, 80) || '';
    const updated = toggleBookmark(activeBookName, curIndexRef.current, snippet);
    setBookmarks(updated);
  }, [activeBookName, paragraphs]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (showHelp || showJump) return;
      if (e.target.tagName === 'INPUT') return;
      const cur = curIndexRef.current;
      switch (e.key) {
        case ' ':
        case 'ArrowDown':
          e.preventDefault(); navigateTo(cur + 1); break;
        case 'ArrowUp':
          e.preventDefault(); navigateTo(cur - 1); break;
        case 'ArrowRight':
          e.preventDefault(); navigateTo(cur + 1); break;
        case 'ArrowLeft':
          e.preventDefault(); navigateTo(cur - 1); break;
        case 'PageDown':
          e.preventDefault(); navigateTo(cur + 10); break;
        case 'PageUp':
          e.preventDefault(); navigateTo(cur - 10); break;
        case 'g': case 'G':
          setShowJump(true); break;
        case 'd': case 'D':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); toggleBm(); }
          break;
        case 'b': case 'B':
          setShowBmPanel(p => !p); break;
        case '?':
          setShowHelp(true); break;
        case 'Escape':
          setShowHelp(false); setShowJump(false); setShowBmPanel(false); break;
        case 'm': case 'M':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); onShowModeMenu(); }
          break;
        default: break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigateTo, toggleBm, showHelp, showJump, onShowModeMenu]);

  // Focus jump input
  useEffect(() => {
    if (showJump && jumpRef.current) jumpRef.current.focus();
  }, [showJump]);

  const pct      = total > 0 ? Math.round((curIndex / total) * 100) : 0;
  const bmActive = activeBookName ? isBookmarked(activeBookName, curIndex) : false;
  const stats    = activeBookName ? getStats(activeBookName) : null;

  function fmtTime(ms) {
    if (!ms) return '0m';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div className="term-shell">
      {/* ── Title Bar ── */}
      <div className="term-titlebar">
        <div className="term-dots">
          <div className="tdot tdot-red" />
          <div className="tdot tdot-yellow" />
          <div className="tdot tdot-green" />
        </div>
        <div className="term-title">
          {activeBookName ? `${activeBookName}.log — devread stream` : 'devread — log streaming utility'}
        </div>
        <div className="term-title-actions">
          <button className="term-hdr-btn" onClick={onShowModeMenu} title="Switch mode (Ctrl+M)">
            <Monitor size={13} />
          </button>
        </div>
      </div>

      <div className="term-body-wrap">
        {/* ── Sidebar ── */}
        <aside className="term-sidebar">
          <div className="term-sidebar-section">// workspaces</div>
          <div className="term-book-list">
            {Object.keys(books).length === 0 && (
              <div className="term-no-books">No books loaded.<br />Drop a PDF to start.</div>
            )}
            {Object.values(books).map(b => {
              const prog = getProgress(b.name);
              const p    = prog.total > 0 ? Math.round((prog.chunkIndex / prog.total) * 100) : 0;
              return (
                <div
                  key={b.name}
                  className={`term-book-item ${activeBookName === b.name ? 'active' : ''}`}
                  onClick={() => onOpenBook(b.name)}
                >
                  <div className="term-book-name" title={b.name}>{b.name}</div>
                  <div className="term-book-prog">{p}% · {prog.chunkIndex}/{prog.total}</div>
                  <div className="term-book-bar">
                    <div className="term-book-fill" style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="term-sidebar-section">// mode</div>
          <div className="term-mode-chips">
            {TERM_MODES.map(m => (
              <button
                key={m}
                className={`term-chip ${disguiseMode === m ? 'active' : ''}`}
                onClick={() => onConfigChange({ termMode: m })}
              >{m}</button>
            ))}
          </div>

          {stats && activeBookName && (
            <>
              <div className="term-sidebar-section">// stats</div>
              <div className="term-stats">
                <div className="term-stat-row">
                  <span className="term-stat-label">progress</span>
                  <span className="term-stat-val">{pct}%</span>
                </div>
                <div className="term-stat-row">
                  <span className="term-stat-label">read time</span>
                  <span className="term-stat-val">{fmtTime(stats.totalTimeMs)}</span>
                </div>
                <div className="term-stat-row">
                  <span className="term-stat-label">sessions</span>
                  <span className="term-stat-val">{stats.sessionsCount}</span>
                </div>
              </div>
            </>
          )}

          <div className="term-sidebar-actions">
            <button className="term-btn term-btn-primary" onClick={() => fileInputRef.current?.click()}>
              + Load PDF
            </button>
            {activeBookName && (
              <button className="term-btn term-btn-danger" onClick={() => onDeleteBook(activeBookName)}>
                Remove
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); }} />
          </div>
        </aside>

        {/* ── Main Terminal ── */}
        <div className="term-main">
          {/* Tab bar */}
          <div className="term-tab-bar">
            {activeBookName
              ? <div className="term-tab active">{activeBookName}.log</div>
              : <div className="term-tab active">stream.log</div>
            }
            <div className="term-tab" style={{ opacity: .35 }}>output.log</div>
            <div className="term-tab" style={{ opacity: .2 }}>stderr</div>
            <div className="term-tab-spacer" />
            {activeBookName && (
              <button
                className={`term-tab-bm ${bmActive ? 'active' : ''}`}
                onClick={toggleBm}
                title="Toggle bookmark (Ctrl+D)"
              >
                {bmActive ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
              </button>
            )}
          </div>

          {/* Content */}
          {!activeBook ? (
            <div className="term-empty">
              <div className="term-empty-icon">▶</div>
              <div className="term-empty-title">devread — log stream ready</div>
              <div className="term-empty-sub">Drop a PDF file or click "Load PDF" in the sidebar</div>
              <label className="term-drop-zone"
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }}
                onDragLeave={e => e.currentTarget.classList.remove('dragging')}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('dragging');
                  const f = e.dataTransfer.files?.[0];
                  if (f) onFileUpload(f);
                }}
              >
                <input type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); }} />
                Drop PDF here
              </label>
            </div>
          ) : (
            <div className="term-content" ref={bodyRef} onScroll={onScroll}>
              {allLines.map((line, i) => {
                if (line.type === 'term-separator') {
                  return (
                    <div key={`sep-${i}`} data-para={line.paraIdx} className="term-para-anchor">
                      <div className="term-sep-line" />
                    </div>
                  );
                }
                return (
                  <div key={i} data-para={line.paraIdx}>
                    <TerminalLine line={line} />
                  </div>
                );
              })}
              <div style={{ height: '60vh' }} /> {/* bottom padding so last para can reach top */}
            </div>
          )}

          {/* Controls bar */}
          {activeBook && (
            <div className="term-controls">
              <button className="ctrl-btn" onClick={() => navigateTo(curIndex - 1)} disabled={curIndex === 0}>
                <ChevronLeft size={13} /> <span className="kbd">←</span>
              </button>
              <button className="ctrl-btn" onClick={() => navigateTo(curIndex + 1)} disabled={curIndex >= total - 1}>
                <span className="kbd">SPC</span> <ChevronRight size={13} />
              </button>
              <button className="ctrl-btn" onClick={() => navigateTo(curIndex - 10)} disabled={curIndex === 0}>
                <SkipBack size={12} />
              </button>
              <button className="ctrl-btn" onClick={() => navigateTo(curIndex + 10)} disabled={curIndex >= total - 10}>
                <SkipForward size={12} />
              </button>
              <button className="ctrl-btn" onClick={() => setShowJump(true)} title="Go to (G)">
                <Search size={12} /> <span className="kbd">G</span>
              </button>
              <button
                className={`ctrl-btn ${bmActive ? 'active' : ''}`}
                onClick={toggleBm} title="Bookmark (Ctrl+D)"
              >
                {bmActive ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
              </button>
              <button className={`ctrl-btn ${showBmPanel ? 'active' : ''}`} onClick={() => setShowBmPanel(p => !p)} title="Bookmarks (B)">
                <span style={{ fontSize: 10 }}>BM</span>
              </button>
              <button className="ctrl-btn" onClick={() => setShowHelp(true)} title="Help (?)">
                <HelpCircle size={12} />
              </button>
              <span className="ctrl-spacer" />
              <span className="term-progress-text">
                <span style={{ color: 'var(--accent-cyan)' }}>{curIndex}</span>
                <span style={{ color: 'var(--text-dim)' }}>/{total}</span>
                <span style={{ marginLeft: 8, color: 'var(--accent-green)' }}>{pct}%</span>
              </span>
            </div>
          )}
        </div>

        {/* ── Bookmarks panel ── */}
        {showBmPanel && activeBookName && (
          <div className="term-bm-panel">
            <div className="term-bm-header">
              <span>// bookmarks</span>
              <button onClick={() => setShowBmPanel(false)}><X size={12} /></button>
            </div>
            {bookmarks.length === 0 ? (
              <div className="term-bm-empty">No bookmarks yet.<br />Press Ctrl+D to add one.</div>
            ) : (
              <div className="term-bm-list">
                {bookmarks.map(bm => (
                  <div key={bm.index} className={`term-bm-item ${bm.index === curIndex ? 'active' : ''}`}
                    onClick={() => navigateTo(bm.index)}>
                    <div className="term-bm-idx">ln {bm.index}</div>
                    <div className="term-bm-snip">{bm.snippet || '(no preview)'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <TermStatusBar activeBook={activeBookName} curIndex={curIndex} total={total} pct={pct} />

      {/* ── Jump overlay ── */}
      {showJump && (
        <div className="jump-overlay">
          <label>Jump to paragraph #</label>
          <input ref={jumpRef} type="number" min={0} max={total - 1}
            value={jumpVal} placeholder={`0 – ${total - 1}`}
            onChange={e => setJumpVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { navigateTo(parseInt(jumpVal, 10) || 0); setShowJump(false); setJumpVal(''); }
              if (e.key === 'Escape') { setShowJump(false); setJumpVal(''); }
            }} />
          <div className="jump-actions">
            <button className="term-btn" onClick={() => { setShowJump(false); setJumpVal(''); }}><X size={12} /> Cancel</button>
            <button className="term-btn term-btn-primary" onClick={() => { navigateTo(parseInt(jumpVal, 10) || 0); setShowJump(false); setJumpVal(''); }}>
              Jump
            </button>
          </div>
        </div>
      )}

      {/* ── Help overlay ── */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-panel" onClick={e => e.stopPropagation()}>
            <h2>devread — keyboard reference</h2>
            {[
              [['SPACE', '↓'], 'Next paragraph'],
              [['↑'],          'Previous paragraph'],
              [['PgDn'],       'Jump +10 paragraphs'],
              [['PgUp'],       'Jump -10 paragraphs'],
              [['G'],          'Jump to paragraph #'],
              [['Ctrl+D'],     'Toggle bookmark'],
              [['B'],          'Toggle bookmarks panel'],
              [['Ctrl+M'],     'Switch view mode'],
              [['?'],          'Show this help'],
              [['ESC'],        'Close overlays'],
            ].map(([keys, desc]) => (
              <div className="help-row" key={desc}>
                <div className="help-keys">{keys.map(k => <span key={k} className="kbd">{k}</span>)}</div>
                <div className="help-desc">{desc}</div>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <button className="term-btn" onClick={() => setShowHelp(false)}><X size={12} /> Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status bar sub-component ────────────────────────────────
function TermStatusBar({ activeBook, curIndex, total, pct }) {
  const [heap,   setHeap]   = useState(() => Math.floor(100 + Math.random() * 400));
  const [pid]               = useState(() => Math.floor(1000 + Math.random() * 60000));
  const [uptime, setUptime] = useState(() => Math.floor(Math.random() * 3600));

  useEffect(() => {
    const h = setInterval(() => setHeap(v => v + (Math.random() > .5 ? 1 : -1) * Math.floor(Math.random() * 6)), 3500);
    const u = setInterval(() => setUptime(v => v + 1), 1000);
    return () => { clearInterval(h); clearInterval(u); };
  }, []);

  function pad2(n) { return String(n).padStart(2, '0'); }
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;

  return (
    <div className="term-statusbar">
      <span>heap: {heap}mb</span>
      <span className="tsep">│</span>
      <span>pid: {pid}</span>
      <span className="tsep">│</span>
      <span>uptime: {pad2(h)}:{pad2(m)}:{pad2(s)}</span>
      {activeBook && (
        <>
          <span className="tsep">│</span>
          <span>sync: {pct}% ({curIndex}/{total})</span>
        </>
      )}
      <span style={{ flex: 1 }} />
      <span>devread v2.0 · terminal</span>
    </div>
  );
}
