// TerminalViewer.jsx — The main interactive reading pane
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, SkipBack, Maximize2, Minimize2,
  HelpCircle, Compass, Search, X
} from 'lucide-react';
import TerminalLine from './TerminalLine';
import { renderChunk, resetTimestamp } from '../utils/disguise';
import { setProgress } from '../utils/storage';

const LOOKAHEAD = 6; // render next N chunks ahead for context

export default function TerminalViewer({ book, bookName, mode, focusMode, onFocusToggle, onChunkChange }) {
  const [chunkIndex, setChunkIndex] = useState(0);
  const [renderedChunks, setRenderedChunks] = useState([]);
  const [showJump, setShowJump] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [jumpValue, setJumpValue] = useState('');
  const bodyRef = useRef(null);
  const jumpInputRef = useRef(null);

  const paragraphs = book?.paragraphs || [];
  const total = paragraphs.length;

  // Initialize from saved progress
  useEffect(() => {
    if (!book) return;
    resetTimestamp();
    setRenderedChunks([]);
    setChunkIndex(0);
  }, [bookName]);

  // Re-render when mode changes
  useEffect(() => {
    if (!paragraphs.length) return;
    const chunks = [];
    const end = Math.min(chunkIndex + LOOKAHEAD + 1, total);
    for (let i = Math.max(0, chunkIndex - 1); i < end; i++) {
      chunks.push({
        index: i,
        lines: renderChunk(paragraphs[i], mode),
        isCurrent: i === chunkIndex,
      });
    }
    setRenderedChunks(chunks);
  }, [mode, chunkIndex, bookName]);

  // Persist progress + notify parent
  useEffect(() => {
    if (bookName) {
      setProgress(bookName, chunkIndex);
      onChunkChange?.(chunkIndex);
    }
  }, [chunkIndex, bookName]);

  // Auto-scroll to current chunk
  useEffect(() => {
    if (!bodyRef.current) return;
    const el = bodyRef.current.querySelector('[data-current="true"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [renderedChunks]);

  // Focus jump input
  useEffect(() => {
    if (showJump && jumpInputRef.current) jumpInputRef.current.focus();
  }, [showJump]);

  const navigate = useCallback((delta) => {
    setChunkIndex(i => {
      const next = Math.max(0, Math.min(total - 1, i + delta));
      return next;
    });
  }, [total]);

  const jumpToChunk = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(total - 1, idx));
    setChunkIndex(clamped);
    setShowJump(false);
    setJumpValue('');
  }, [total]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      if (showJump || showHelp) return;
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
        case 'Enter':
        case 'ArrowRight':
          e.preventDefault();
          navigate(1);
          break;
        case 'Backspace':
        case 'ArrowLeft':
        case 'b':
        case 'B':
          e.preventDefault();
          navigate(-1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          navigate(-5);
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigate(5);
          break;
        case 'g':
        case 'G':
          setShowJump(true);
          break;
        case 'f':
        case 'F':
          onFocusToggle?.();
          break;
        case '?':
          setShowHelp(true);
          break;
        case 'Escape':
          setShowHelp(false);
          setShowJump(false);
          break;
        default: break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, showJump, showHelp, onFocusToggle]);

  if (!book) return null;

  const pct = total > 0 ? Math.round((chunkIndex / total) * 100) : 0;

  return (
    <>
      {/* ── Terminal Tab Bar ── */}
      <div className="terminal-tab-bar">
        <div className="terminal-tab active">
          {bookName || 'stream'}.log
        </div>
        <div className="terminal-tab" style={{ opacity: .4 }}>output.log</div>
        <div className="terminal-tab" style={{ opacity: .25 }}>stderr</div>
      </div>

      {/* ── Body ── */}
      <div className="terminal-body" ref={bodyRef}>
        {renderedChunks.map(({ index, lines, isCurrent }) => (
          <div
            key={index}
            data-current={isCurrent}
            className={isCurrent ? 'chunk-current' : ''}
            style={{ marginBottom: '12px' }}
          >
            {lines.map((line, li) => (
              <TerminalLine key={li} line={line} />
            ))}
            {isCurrent && <span className="blink" />}
            {!isCurrent && index < chunkIndex && (
              <div className="log-separator">{'─'.repeat(60)}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Controls Bar ── */}
      <div className="controls-bar">
        <button className="ctrl-btn" onClick={() => navigate(-1)} disabled={chunkIndex === 0} title="Previous (B / ←)">
          <ChevronLeft size={13} />
          <span className="kbd">B</span>
        </button>
        <button className="ctrl-btn" onClick={() => navigate(1)} disabled={chunkIndex >= total - 1} title="Next (SPACE / →)">
          <span className="kbd">SPC</span>
          <ChevronRight size={13} />
        </button>
        <button className="ctrl-btn" onClick={() => navigate(-10)} disabled={chunkIndex === 0} title="Jump back 10">
          <SkipBack size={13} />
          <span style={{ fontSize: 10 }}>-10</span>
        </button>
        <button className="ctrl-btn" onClick={() => setShowJump(true)} title="Go to chunk (G)">
          <Search size={12} />
          <span className="kbd">G</span>
        </button>
        <button className={`ctrl-btn ${focusMode ? 'active' : ''}`} onClick={onFocusToggle} title="Focus mode (F)">
          {focusMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          <span className="kbd">F</span>
        </button>
        <button className="ctrl-btn" onClick={() => setShowHelp(true)} title="Help (?)">
          <HelpCircle size={12} />
          <span className="kbd">?</span>
        </button>

        <span className="ctrl-spacer" />

        <span className="progress-inline">
          <span style={{ color: 'var(--accent-cyan)' }}>{chunkIndex}</span>
          <span style={{ color: 'var(--text-dim)' }}>/{total}</span>
          <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{pct}%</span>
        </span>
      </div>

      {/* ── Jump Overlay ── */}
      {showJump && (
        <div className="jump-overlay">
          <label>Jump to chunk #</label>
          <input
            ref={jumpInputRef}
            type="number"
            min={0}
            max={total - 1}
            value={jumpValue}
            placeholder={`0 – ${total - 1}`}
            onChange={e => setJumpValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') jumpToChunk(parseInt(jumpValue, 10) || 0);
              if (e.key === 'Escape') { setShowJump(false); setJumpValue(''); }
            }}
          />
          <div className="jump-actions">
            <button className="btn" onClick={() => { setShowJump(false); setJumpValue(''); }}>
              <X size={12} /> Cancel
            </button>
            <button className="btn btn-primary" onClick={() => jumpToChunk(parseInt(jumpValue, 10) || 0)}>
              <Compass size={12} /> Jump
            </button>
          </div>
        </div>
      )}

      {/* ── Help Overlay ── */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-panel" onClick={e => e.stopPropagation()}>
            <h2>devread(1) — keyboard reference</h2>
            {[
              [['SPACE', '→', 'ENTER'], 'Next paragraph'],
              [['B', '←', 'BKSP'],     'Previous paragraph'],
              [['↑'],                   'Jump back 5'],
              [['↓'],                   'Jump forward 5'],
              [['G'],                   'Jump to specific chunk'],
              [['F'],                   'Toggle focus mode'],
              [['?'],                   'Show this help'],
              [['ESC'],                 'Close overlays'],
            ].map(([keys, desc]) => (
              <div className="help-row" key={desc}>
                <div className="help-keys">
                  {keys.map(k => <span key={k} className="kbd">{k}</span>)}
                </div>
                <div className="help-desc">{desc}</div>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setShowHelp(false)}>
                <X size={12} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
