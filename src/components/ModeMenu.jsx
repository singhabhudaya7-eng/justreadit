// ModeMenu.jsx — Full-screen mode switcher overlay
import { Monitor, TerminalSquare, X } from 'lucide-react';

export default function ModeMenu({ currentMode, onSelect, onClose }) {
  return (
    <div className="mode-menu-overlay" onClick={onClose}>
      <div className="mode-menu-panel" onClick={e => e.stopPropagation()}>
        <div className="mode-menu-header">
          <span className="mode-menu-title">Select View Mode</span>
          <button className="mode-menu-close" onClick={onClose}><X size={14} /></button>
        </div>
        <p className="mode-menu-sub">Choose how devread disguises your reading</p>

        <div className="mode-menu-cards">
          <button
            className={`mode-card ${currentMode === 'vscode' ? 'active' : ''}`}
            onClick={() => onSelect('vscode')}
          >
            <div className="mode-card-icon"><Monitor size={28} strokeWidth={1.5} /></div>
            <div className="mode-card-name">VS Code</div>
            <div className="mode-card-desc">
              Looks like editing TypeScript in VS Code — activity bar, file explorer, editor tabs,
              line numbers, minimap. Indistinguishable from real coding.
            </div>
            {currentMode === 'vscode' && <div className="mode-card-badge">ACTIVE</div>}
          </button>

          <button
            className={`mode-card ${currentMode === 'terminal' ? 'active' : ''}`}
            onClick={() => onSelect('terminal')}
          >
            <div className="mode-card-icon"><TerminalSquare size={28} strokeWidth={1.5} /></div>
            <div className="mode-card-name">Terminal</div>
            <div className="mode-card-desc">
              Looks like monitoring live server logs or streaming debug output.
              Multiple disguise sub-modes: logs, code, docs, diff.
            </div>
            {currentMode === 'terminal' && <div className="mode-card-badge">ACTIVE</div>}
          </button>
        </div>

        <div className="mode-menu-tip">
          Press <span className="kbd">Ctrl+M</span> to toggle modes at any time
        </div>
      </div>
    </div>
  );
}
