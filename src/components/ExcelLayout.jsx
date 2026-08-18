// ExcelLayout.jsx — Spreadsheet-look disguise. The grid (column letters, row numbers,
// formula bar, sheet tabs) is chrome only — the actual paragraph text renders as normal
// readable prose inside one wide "cell" per row, not obfuscated into fake spreadsheet data.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bookmark, BookmarkCheck, Monitor, Upload, Trash2, Table2,
} from 'lucide-react';
import {
  setProgress, getProgress, getBookmarks, toggleBookmark, isBookmarked,
  recordSessionStart, recordSessionEnd,
} from '../utils/storage';

const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export default function ExcelLayout({
  books, activeBook, activeBookName, onOpenBook, onFileUpload,
  onShowModeMenu, onDeleteBook,
}) {
  const [curIndex,  setCurIndex]  = useState(0);
  const [bookmarks, setBookmarks] = useState([]);

  const gridRef         = useRef(null);
  const curIndexRef     = useRef(0);
  const sessionStartMs  = useRef(Date.now());
  const saveTimer       = useRef(null);
  const fileInputRef    = useRef(null);
  const didInitScroll   = useRef(false);

  const paragraphs = activeBook?.paragraphs || [];
  const total      = paragraphs.length;

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

  useEffect(() => {
    if (!paragraphs.length || didInitScroll.current || !gridRef.current) return;
    const target = curIndexRef.current;
    if (target === 0) { didInitScroll.current = true; return; }
    const t = setTimeout(() => {
      const el = gridRef.current?.querySelector(`[data-excel-row="${target}"]`);
      if (el) { el.scrollIntoView({ block: 'start' }); didInitScroll.current = true; }
    }, 60);
    return () => clearTimeout(t);
  }, [paragraphs]);

  const onScroll = useCallback(() => {
    if (!gridRef.current) return;
    const container = gridRef.current;
    const focalY = container.getBoundingClientRect().top + 90;
    const els = container.querySelectorAll('[data-excel-row]');
    let found = 0, minDist = Infinity;
    for (const el of els) {
      const dist = Math.abs(el.getBoundingClientRect().top - focalY);
      if (dist < minDist) { minDist = dist; found = parseInt(el.dataset.excelRow, 10); }
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
    const el = gridRef.current?.querySelector(`[data-excel-row="${clamped}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [total]);

  const toggleBm = useCallback(() => {
    if (!activeBookName) return;
    const snippet = paragraphs[curIndexRef.current]?.slice(0, 80) || '';
    setBookmarks(toggleBookmark(activeBookName, curIndexRef.current, snippet));
  }, [activeBookName, paragraphs]);

  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const cur = curIndexRef.current;
      switch (e.key) {
        case ' ': case 'ArrowDown':
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
  const cellRef  = `B${curIndex + 1}`;
  const preview  = activeBook ? (paragraphs[curIndex] || '').slice(0, 70) : '';
  const bookFileName = activeBookName ? `${activeBookName}.xlsx` : null;

  return (
    <div className="excel-shell">
      <div className="excel-titlebar">
        <div className="excel-dots">
          <div className="edot edot-red" /><div className="edot edot-yellow" /><div className="edot edot-green" />
        </div>
        <div className="excel-title-text">{bookFileName || 'Book1.xlsx'} — Excel</div>
        <button className="excel-hdr-btn" onClick={onShowModeMenu} title="Switch mode (Ctrl+M)">
          <Monitor size={14} />
        </button>
      </div>

      <div className="excel-body-wrap">
        <aside className="excel-sidebar">
          <div className="excel-sidebar-title">Workbooks</div>
          <div className="excel-book-list">
            {Object.keys(books).length === 0 && (
              <div className="excel-no-books">No workbooks.<br />Import a PDF to start.</div>
            )}
            {Object.values(books).map(b => {
              const p = getProgress(b.name);
              const p2 = p.total > 0 ? Math.round((p.chunkIndex / p.total) * 100) : 0;
              return (
                <div key={b.name} className={`excel-book-item ${activeBookName === b.name ? 'active' : ''}`}
                  onClick={() => onOpenBook(b.name)} title={b.name}>
                  <Table2 size={12} className="excel-book-icon" />
                  <div className="excel-book-name">{b.name}</div>
                  <div className="excel-book-pct">{p2}%</div>
                </div>
              );
            })}
          </div>
          <div className="excel-sidebar-actions">
            <button className="excel-btn excel-btn-primary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={12} /> Import PDF
            </button>
            {activeBookName && (
              <button className="excel-btn excel-btn-danger" onClick={() => onDeleteBook(activeBookName)}>
                <Trash2 size={12} /> Remove
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); }} />
          </div>
        </aside>

        <div className="excel-main">
          {!activeBook ? (
            <ExcelWelcome onFileUpload={onFileUpload} fileInputRef={fileInputRef} />
          ) : (
            <>
              <div className="excel-formula-bar">
                <span className="excel-cellref">{cellRef}</span>
                <span className="excel-fx">fx</span>
                <span className="excel-formula-preview">{preview}</span>
              </div>

              <div className="excel-grid" ref={gridRef} onScroll={onScroll}>
                <div className="excel-col-headers">
                  <div className="excel-corner" />
                  {COL_LETTERS.map(c => <div key={c} className={`excel-col-h ${c === 'B' ? 'excel-col-h-wide' : ''}`}>{c}</div>)}
                </div>
                {paragraphs.map((p, i) => (
                  <div key={i} data-excel-row={i} className={`excel-row ${i === curIndex ? 'excel-row-active' : ''}`}>
                    <div className="excel-row-num">{i + 1}</div>
                    <div className="excel-cell excel-cell-a" />
                    <div className="excel-cell excel-cell-b">{p}</div>
                    {COL_LETTERS.slice(2).map(c => <div key={c} className="excel-cell excel-cell-blank" />)}
                  </div>
                ))}
                <div style={{ height: '40vh' }} />
              </div>

              <div className="excel-sheet-tabs">
                <div className="excel-tab active">Sheet1</div>
                <div className="excel-tab">Data</div>
                <div className="excel-tab">Summary</div>
                <span className="excel-tab-spacer" />
                <button className={`excel-bm-btn ${bmActive ? 'active' : ''}`} onClick={toggleBm} title="Bookmark (Ctrl+D)">
                  {bmActive ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {activeBook && (
        <div className="excel-statusbar">
          <span>Ready</span>
          <span className="excel-sb-sep">│</span>
          <span>Row {curIndex + 1} of {total}</span>
          <span className="excel-sb-sep">│</span>
          <span>{pct}%</span>
          <span style={{ flex: 1 }} />
          <span>{bookmarks.length} bookmark{bookmarks.length === 1 ? '' : 's'}</span>
          <span className="excel-sb-sep">│</span>
          <span>devread v2.0 · sheet</span>
        </div>
      )}
    </div>
  );
}

function ExcelWelcome({ onFileUpload, fileInputRef }) {
  return (
    <div className="excel-welcome">
      <div className="excel-welcome-icon"><Table2 size={44} strokeWidth={1} /></div>
      <div className="excel-welcome-title">Book1.xlsx</div>
      <div className="excel-welcome-sub">Read novels at work. Look like you're crunching numbers.</div>
      <button className="excel-welcome-btn" onClick={() => fileInputRef.current?.click()}>
        <Upload size={14} /> Import PDF
      </button>
      <div className="excel-welcome-drop"
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
