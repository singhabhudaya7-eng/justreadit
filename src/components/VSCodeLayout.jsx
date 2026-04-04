// VSCodeLayout.jsx — Full VS Code disguise mode
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Files, Bookmark, BarChart2, Settings, X,
  BookmarkCheck, ChevronRight, ChevronDown,
  Upload, Trash2, Plus, Monitor,
} from 'lucide-react';
import TerminalLine from './TerminalLine';
import { renderVSCode } from '../utils/disguise';
import {
  setProgress, getProgress, getBookmarks, toggleBookmark, isBookmarked,
  recordSessionStart, recordSessionEnd, getStats, getAllBooks,
} from '../utils/storage';

const FAKE_TABS = ['index.ts', 'router.ts', 'types.d.ts'];

export default function VSCodeLayout({
  books, activeBook, activeBookName, config, onOpenBook, onFileUpload,
  onConfigChange, onShowModeMenu, onBooksChange, onDeleteBook,
}) {
  const activity    = config.vsActivity || 'explorer';
  const [curIndex,    setCurIndex]     = useState(0);
  const [bookmarks,   setBookmarks]    = useState([]);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [showBmNote,  setShowBmNote]   = useState(false);

  const editorRef      = useRef(null);
  const curIndexRef    = useRef(0);
  const sessionStartMs = useRef(Date.now());
  const saveTimer      = useRef(null);
  const didInitScroll  = useRef(false);
  const fileInputRef   = useRef(null);

  const paragraphs = activeBook?.paragraphs || [];
  const total      = paragraphs.length;

  // Pre-render all lines (stable across scrolling)
  const { allLines, paraLineMap } = useMemo(() => {
    if (!paragraphs.length) return { allLines: [], paraLineMap: [] };
    const out      = [];
    const paraMap  = []; // paraMap[paraIdx] = first line index
    paragraphs.forEach((para, paraIdx) => {
      paraMap[paraIdx] = out.length;
      const lines = renderVSCode(para);
      lines.forEach(line => out.push({ ...line, paraIdx }));
    });
    return { allLines: out, paraLineMap: paraMap };
  }, [activeBookName]);

  // Reset on book change
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

  // Initial scroll to restored position
  useEffect(() => {
    if (!allLines.length || didInitScroll.current || !editorRef.current) return;
    const target = curIndexRef.current;
    if (target === 0) { didInitScroll.current = true; return; }
    const t = setTimeout(() => {
      const el = editorRef.current?.querySelector(`[data-para="${target}"]`);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        didInitScroll.current = true;
      }
    }, 60);
    return () => clearTimeout(t);
  }, [allLines]);

  // Scroll tracking
  const onScroll = useCallback(() => {
    if (!editorRef.current) return;
    const containerTop = editorRef.current.getBoundingClientRect().top;
    const els = editorRef.current.querySelectorAll('[data-para]');
    let found = 0;
    for (const el of els) {
      const top = el.getBoundingClientRect().top - containerTop;
      if (top <= 60) found = parseInt(el.dataset.para, 10);
      else break;
    }
    if (found !== curIndexRef.current) {
      curIndexRef.current = found;
      setCurIndex(found);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setProgress(activeBookName, found), 500);
    }
  }, [activeBookName]);

  const navigateTo = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(total - 1, idx));
    const el = editorRef.current?.querySelector(`[data-para="${clamped}"]`);
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
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const cur = curIndexRef.current;
      switch (e.key) {
        case ' ':
        case 'ArrowDown':
          e.preventDefault(); navigateTo(cur + 1); break;
        case 'ArrowUp':
          e.preventDefault(); navigateTo(cur - 1); break;
        case 'PageDown':
          e.preventDefault(); navigateTo(cur + 10); break;
        case 'PageUp':
          e.preventDefault(); navigateTo(cur - 10); break;
        case 'd': case 'D':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); toggleBm(); }
          break;
        case 'm': case 'M':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); onShowModeMenu(); }
          break;
        default: break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigateTo, toggleBm, onShowModeMenu]);

  const pct      = total > 0 ? Math.round((curIndex / total) * 100) : 0;
  const bmActive = activeBookName ? isBookmarked(activeBookName, curIndex) : false;
  const stats    = activeBookName ? getStats(activeBookName) : null;
  const prog     = activeBookName ? getProgress(activeBookName) : null;

  // Current line number in editor
  const curLineNum = paraLineMap[curIndex] ? paraLineMap[curIndex] + 1 : 1;
  const totalLines = allLines.length;

  const bookFileName = activeBookName ? `${activeBookName}.service.ts` : null;

  function fmtTime(ms) {
    if (!ms) return '0m';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function fmtRelative(ts) {
    if (!ts) return 'never';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  }

  return (
    <div className="vsc-shell">
      {/* ── Mac-style title bar ── */}
      <div className="vsc-titlebar">
        <div className="vsc-dots">
          <div className="vdot vdot-red" />
          <div className="vdot vdot-yellow" />
          <div className="vdot vdot-green" />
        </div>
        <div className="vsc-title-text">
          {bookFileName || 'devread'} — Visual Studio Code
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className="vsc-workbench">
        {/* ── Activity Bar ── */}
        <div className="vsc-activity-bar">
          <div className="vsc-activity-top">
            <button
              className={`vsc-act-btn ${activity === 'explorer' ? 'active' : ''}`}
              onClick={() => onConfigChange({ vsActivity: 'explorer' })}
              title="Explorer (books)"
            >
              <Files size={22} strokeWidth={1.5} />
            </button>
            <button
              className={`vsc-act-btn ${activity === 'bookmarks' ? 'active' : ''}`}
              onClick={() => onConfigChange({ vsActivity: 'bookmarks' })}
              title="Bookmarks"
            >
              <Bookmark size={22} strokeWidth={1.5} />
            </button>
            <button
              className={`vsc-act-btn ${activity === 'stats' ? 'active' : ''}`}
              onClick={() => onConfigChange({ vsActivity: 'stats' })}
              title="Reading Stats"
            >
              <BarChart2 size={22} strokeWidth={1.5} />
            </button>
          </div>
          <div className="vsc-activity-bottom">
            <button className="vsc-act-btn" onClick={onShowModeMenu} title="Switch view mode (Ctrl+M)">
              <Settings size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* ── Primary Sidebar ── */}
        <div className="vsc-sidebar">
          {/* EXPLORER PANEL */}
          {activity === 'explorer' && (
            <div className="vsc-panel">
              <div className="vsc-panel-title">EXPLORER</div>

              <div className="vsc-explorer-section">
                <div className="vsc-section-header" onClick={() => setExplorerOpen(p => !p)}>
                  {explorerOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span>OPEN EDITORS</span>
                </div>
                {explorerOpen && bookFileName && (
                  <div className="vsc-open-editor active">
                    <span className="vsc-oe-dot" />
                    <span className="vsc-oe-name">{bookFileName}</span>
                  </div>
                )}
              </div>

              <div className="vsc-explorer-section">
                <div className="vsc-section-header">
                  <ChevronDown size={12} />
                  <span>DEVREAD</span>
                  <button className="vsc-section-btn" onClick={() => fileInputRef.current?.click()} title="Load PDF">
                    <Plus size={12} />
                  </button>
                </div>
                <div className="vsc-filetree">
                  <div className="vsc-folder">
                    <span className="vsc-folder-icon"><ChevronDown size={10} /></span>
                    <span className="vsc-folder-name">library</span>
                  </div>
                  {Object.values(books).map(b => {
                    const p = getProgress(b.name);
                    const pct2 = p.total > 0 ? Math.round((p.chunkIndex / p.total) * 100) : 0;
                    const isActive = b.name === activeBookName;
                    return (
                      <div
                        key={b.name}
                        className={`vsc-file ${isActive ? 'active' : ''}`}
                        onClick={() => onOpenBook(b.name)}
                        title={b.name}
                      >
                        <span className="vsc-file-icon">TS</span>
                        <span className="vsc-file-name">{b.name}.service.ts</span>
                        <span className="vsc-file-pct">{pct2}%</span>
                      </div>
                    );
                  })}
                  {Object.keys(books).length === 0 && (
                    <div className="vsc-empty-lib">
                      <label style={{ cursor: 'pointer', color: 'var(--vsc-link)' }}
                        onClick={() => fileInputRef.current?.click()}>
                        + Import PDF
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {activeBookName && (
                <div className="vsc-explorer-section">
                  <div className="vsc-section-header">
                    <ChevronDown size={12} />
                    <span>OUTLINE</span>
                  </div>
                  <div className="vsc-outline">
                    {[...Array(6)].map((_, i) => {
                      const fnIdx = Math.abs((curIndex * 7 + i * 13) % 20);
                      const FUNC_NAMES = ['parseStream','initCache','loadData','processEvent','validateToken','flushBuffer','syncState','resolveRef','invokeHandler','scheduleTask','emitSignal','handleRequest','bootstrapModule','dispatchAction','transformPayload','bindContext','initEventLoop','resolveModule','processQueue','normalizeData'];
                      return (
                        <div key={i} className={`vsc-outline-item ${i === 0 ? 'active' : ''}`}>
                          <span className="vsc-outline-icon">ƒ</span>
                          <span className="vsc-outline-name">{FUNC_NAMES[fnIdx]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeBookName && (
                <div className="vsc-panel-actions">
                  <button className="vsc-panel-btn vsc-panel-btn-danger"
                    onClick={() => onDeleteBook(activeBookName)}
                    title="Remove book">
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BOOKMARKS PANEL */}
          {activity === 'bookmarks' && (
            <div className="vsc-panel">
              <div className="vsc-panel-title">BOOKMARKS</div>
              {!activeBookName ? (
                <div className="vsc-panel-empty">No book open</div>
              ) : bookmarks.length === 0 ? (
                <div className="vsc-panel-empty">
                  No bookmarks yet.<br />
                  Press <span className="kbd">Ctrl+D</span> to bookmark<br />
                  your current position.
                </div>
              ) : (
                <div className="vsc-bm-list">
                  {bookmarks.map(bm => (
                    <div
                      key={bm.index}
                      className={`vsc-bm-item ${bm.index === curIndex ? 'active' : ''}`}
                      onClick={() => navigateTo(bm.index)}
                    >
                      <div className="vsc-bm-loc">
                        <BookmarkCheck size={10} />
                        <span>Ln {bm.index + 1}</span>
                        <span className="vsc-bm-time">{fmtRelative(bm.createdAt)}</span>
                      </div>
                      <div className="vsc-bm-snip">
                        {bm.snippet || '(no preview)'}
                      </div>
                      <button className="vsc-bm-del"
                        onClick={e => {
                          e.stopPropagation();
                          const updated = toggleBookmark(activeBookName, bm.index);
                          setBookmarks(updated);
                        }}
                      ><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STATS PANEL */}
          {activity === 'stats' && (
            <div className="vsc-panel">
              <div className="vsc-panel-title">READING STATS</div>
              {Object.values(books).length === 0 ? (
                <div className="vsc-panel-empty">No books loaded</div>
              ) : (
                <div className="vsc-stats-list">
                  {Object.values(books).map(b => {
                    const p  = getProgress(b.name);
                    const st = getStats(b.name);
                    const pct2 = p.total > 0 ? Math.round((p.chunkIndex / p.total) * 100) : 0;
                    const isActive = b.name === activeBookName;
                    return (
                      <div key={b.name} className={`vsc-stat-book ${isActive ? 'active' : ''}`}
                        onClick={() => onOpenBook(b.name)}>
                        <div className="vsc-stat-book-name">{b.name}.service.ts</div>
                        <div className="vsc-stat-pct-bar">
                          <div className="vsc-stat-pct-fill" style={{ width: `${pct2}%` }} />
                        </div>
                        <div className="vsc-stat-grid">
                          <div className="vsc-stat-cell">
                            <div className="vsc-stat-lbl">Progress</div>
                            <div className="vsc-stat-val">{pct2}%</div>
                          </div>
                          <div className="vsc-stat-cell">
                            <div className="vsc-stat-lbl">Read time</div>
                            <div className="vsc-stat-val">{fmtTime(st.totalTimeMs)}</div>
                          </div>
                          <div className="vsc-stat-cell">
                            <div className="vsc-stat-lbl">Sessions</div>
                            <div className="vsc-stat-val">{st.sessionsCount}</div>
                          </div>
                          <div className="vsc-stat-cell">
                            <div className="vsc-stat-lbl">Last read</div>
                            <div className="vsc-stat-val">{fmtRelative(p.lastOpened)}</div>
                          </div>
                          <div className="vsc-stat-cell">
                            <div className="vsc-stat-lbl">Ln</div>
                            <div className="vsc-stat-val">{p.chunkIndex}/{p.total}</div>
                          </div>
                          <div className="vsc-stat-cell">
                            <div className="vsc-stat-lbl">Bookmarks</div>
                            <div className="vsc-stat-val">{getBookmarks(b.name).length}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Editor Group ── */}
        <div className="vsc-editor-group">
          {/* Tab bar */}
          <div className="vsc-tabs">
            {bookFileName && (
              <div className="vsc-tab active">
                <span className="vsc-tab-icon">TS</span>
                <span className="vsc-tab-name">{bookFileName}</span>
                {bmActive && <BookmarkCheck size={10} style={{ marginLeft: 4, color: 'var(--vsc-yellow)' }} />}
              </div>
            )}
            {FAKE_TABS.map(t => (
              <div key={t} className="vsc-tab" style={{ opacity: .45 }}>
                <span className="vsc-tab-icon" style={{ opacity: .5 }}>TS</span>
                <span className="vsc-tab-name">{t}</span>
              </div>
            ))}
          </div>

          {/* Breadcrumbs */}
          {activeBookName && (
            <div className="vsc-breadcrumbs">
              <span>src</span>
              <span className="vsc-bc-sep">›</span>
              <span>{activeBookName}</span>
              <span className="vsc-bc-sep">›</span>
              <span className="vsc-bc-active">{bookFileName}</span>
              <span className="vsc-bc-sep">›</span>
              <span style={{ color: 'var(--vsc-fn)' }}>
                {['parseStream','initCache','loadData','processEvent','validateToken'][curIndex % 5]}
              </span>
            </div>
          )}

          <div className="vsc-editor-container">
            {/* Editor content */}
            <div className="vsc-editor" ref={editorRef} onScroll={onScroll}>
              {!activeBook ? (
                <VscWelcome onFileUpload={onFileUpload} fileInputRef={fileInputRef} />
              ) : (
                <>
                  {/* File header comment */}
                  <div className="vsc-file-header">
                    <div className="vsc-l vsc-comment">/**</div>
                    <div className="vsc-l vsc-comment"> * @file {bookFileName}</div>
                    <div className="vsc-l vsc-comment"> * @module devread · {activeBookName}</div>
                    <div className="vsc-l vsc-comment"> * @description Auto-generated service module</div>
                    <div className="vsc-l vsc-comment"> */</div>
                    <div className="vsc-l vsc-blank">&nbsp;</div>
                    <div className="vsc-l vsc-import">{"import { Injectable, OnModuleInit } from '@nestjs/common';"}</div>
                    <div className="vsc-l vsc-import">{"import { EventEmitter2 } from '@nestjs/event-emitter';"}</div>
                    <div className="vsc-l vsc-blank">&nbsp;</div>
                    <div className="vsc-l vsc-fn-keyword">@Injectable()</div>
                    <div className="vsc-l vsc-fn-keyword">{"export class " + activeBookName.replace(/[^a-zA-Z0-9]/g, '') + "Service implements OnModuleInit {"}</div>
                    <div className="vsc-l vsc-blank">&nbsp;</div>
                  </div>

                  {/* Paragraphs as code */}
                  {allLines.map((line, i) => {
                    const isFirst = i === 0 || allLines[i - 1]?.paraIdx !== line.paraIdx;
                    return (
                      <div key={i}
                        data-para={isFirst ? line.paraIdx : undefined}
                        className={`vsc-editor-line ${line.paraIdx === curIndex ? 'vsc-line-active-para' : ''}`}
                      >
                        <TerminalLine line={line} />
                      </div>
                    );
                  })}
                  <div style={{ height: '60vh' }} />
                </>
              )}
            </div>

            {/* Minimap */}
            {activeBook && (
              <div className="vsc-minimap">
                <div className="vsc-minimap-viewport"
                  style={{ top: `${pct}%`, height: `${Math.min(30, (100 / Math.max(total, 1)) * 20)}%` }}
                />
                {bookmarks.map(bm => (
                  <div key={bm.index} className="vsc-minimap-bm"
                    style={{ top: `${(bm.index / Math.max(total, 1)) * 100}%` }}
                    onClick={() => navigateTo(bm.index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom overlay: bookmark toggle */}
          {activeBook && (
            <div className="vsc-editor-actions">
              <button
                className={`vsc-ea-btn ${bmActive ? 'active' : ''}`}
                onClick={toggleBm}
                title="Toggle bookmark (Ctrl+D)"
              >
                {bmActive ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                {bmActive ? 'Bookmarked' : 'Bookmark'}
              </button>
              <span className="vsc-ea-progress">
                <span style={{ width: `${pct}%` }} className="vsc-ea-bar" />
                {pct}% read
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ── */}
      <VscStatusBar
        activeBook={activeBookName}
        curIndex={curIndex}
        total={total}
        pct={pct}
        lineNum={curLineNum}
        totalLines={totalLines}
        onModeMenu={onShowModeMenu}
      />

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); }} />
    </div>
  );
}

// ── Welcome screen ────────────────────────────────────────
function VscWelcome({ onFileUpload, fileInputRef }) {
  return (
    <div className="vsc-welcome">
      <div className="vsc-welcome-logo">
        <Monitor size={48} strokeWidth={.8} />
      </div>
      <div className="vsc-welcome-title">devread</div>
      <div className="vsc-welcome-sub">Read novels at work. Look like you're coding.</div>
      <div className="vsc-welcome-actions">
        <button className="vsc-welcome-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Import PDF
        </button>
      </div>
      <div className="vsc-welcome-drop"
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
      <div className="vsc-welcome-shortcuts">
        <div><span className="kbd">Space / ↓</span> Next paragraph</div>
        <div><span className="kbd">↑</span> Previous paragraph</div>
        <div><span className="kbd">Ctrl+D</span> Bookmark</div>
        <div><span className="kbd">Ctrl+M</span> Switch mode</div>
      </div>
    </div>
  );
}

// ── VS Code status bar ────────────────────────────────────
function VscStatusBar({ activeBook, curIndex, total, pct, lineNum, totalLines, onModeMenu }) {
  const [branch] = useState(() => {
    const branches = ['main', 'develop', 'feature/auth', 'fix/stream', 'release/v2'];
    return branches[Math.floor(Math.random() * branches.length)];
  });
  const [errors]   = useState(() => Math.random() > .7 ? 0 : Math.floor(Math.random() * 3));
  const [warnings] = useState(() => Math.floor(Math.random() * 5));

  return (
    <div className="vsc-statusbar" onClick={onModeMenu} title="Click to switch mode">
      <div className="vsc-sb-left">
        <span className="vsc-sb-branch">⎇ {branch}</span>
        <span className="vsc-sb-sep" />
        <span className="vsc-sb-errors">✕ {errors}  ⚠ {warnings}</span>
      </div>
      <div className="vsc-sb-right">
        {activeBook && (
          <>
            <span>Ln {lineNum}, Col 1</span>
            <span className="vsc-sb-sep" />
            <span>{pct}% read</span>
            <span className="vsc-sb-sep" />
          </>
        )}
        <span>UTF-8</span>
        <span className="vsc-sb-sep" />
        <span>TypeScript</span>
        <span className="vsc-sb-sep" />
        <span>devread v2.0</span>
      </div>
    </div>
  );
}
