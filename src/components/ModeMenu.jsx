// ModeMenu.jsx — Full-screen mode switcher overlay
import { Monitor, TerminalSquare, BookOpen, Table2, ChevronRightSquare, X } from 'lucide-react';

const MODES = [
  {
    id: 'vscode', name: 'VS Code', icon: Monitor,
    desc: 'Looks like editing TypeScript in VS Code — activity bar, file explorer, editor tabs, line numbers, minimap. Indistinguishable from real coding.',
  },
  {
    id: 'terminal', name: 'Terminal', icon: TerminalSquare,
    desc: 'Looks like monitoring live server logs or streaming debug output. Multiple disguise sub-modes: logs, code, docs, diff.',
  },
  {
    id: 'cmd', name: 'Command Line', icon: ChevronRightSquare,
    desc: "A real fake shell. Type cd, cat, next, bm… and the book comes back as command output. Loaded with joke commands (try sudo, sl, neofetch, exit).",
  },
  {
    id: 'reader', name: 'Reader', icon: BookOpen,
    desc: 'A real e-reader: scroll or page-flip, day/night themes, highlights, bookmarks. Not disguised — just a clean place to read.',
  },
  {
    id: 'excel', name: 'Excel', icon: Table2,
    desc: 'Looks like a spreadsheet — columns, rows, formula bar, sheet tabs — with the actual text readable in one wide column.',
  },
];

export default function ModeMenu({ currentMode, onSelect, onClose }) {
  return (
    <div className="mode-menu-overlay" onClick={onClose}>
      <div className="mode-menu-panel" onClick={e => e.stopPropagation()}>
        <div className="mode-menu-header">
          <span className="mode-menu-title">Select View Mode</span>
          <button className="mode-menu-close" onClick={onClose}><X size={14} /></button>
        </div>
        <p className="mode-menu-sub">Choose how devread disguises your reading</p>

        <div className="mode-menu-cards mode-menu-cards-4">
          {MODES.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                className={`mode-card ${currentMode === m.id ? 'active' : ''}`}
                onClick={() => onSelect(m.id)}
              >
                <div className="mode-card-icon"><Icon size={26} strokeWidth={1.5} /></div>
                <div className="mode-card-name">{m.name}</div>
                <div className="mode-card-desc">{m.desc}</div>
                {currentMode === m.id && <div className="mode-card-badge">ACTIVE</div>}
              </button>
            );
          })}
        </div>

        <div className="mode-menu-tip">
          Press <span className="kbd">Ctrl+M</span> to toggle modes at any time
        </div>
      </div>
    </div>
  );
}
