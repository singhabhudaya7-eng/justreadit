// TerminalLine.jsx — Renders a single disguised line with appropriate styling

export default function TerminalLine({ line }) {
  switch (line.type) {
    // ── LOG ──────────────────────────────────────────────
    case 'log-line':
      return (
        <div className="log-block">
          <span className={`log-prefix log-level-${line.level}`}>[{line.level}]</span>
          <span className="log-meta"> {line.header.slice(line.level.length + 2)}</span>
          <span className="log-body">{line.text}</span>
        </div>
      );
    case 'log-continuation':
      return (
        <div className="log-block log-continuation">
          <span style={{ opacity: 0, userSelect: 'none' }}>{line.indent}</span>
          <span className="log-body">{line.text}</span>
        </div>
      );

    // ── CODE ─────────────────────────────────────────────
    case 'code-sep':    return <div className="log-block code-separator">{line.text}</div>;
    case 'code-header': return <div className="log-block code-header">{line.text}</div>;
    case 'code-line':   return <div className="log-block code-line">{line.text}</div>;
    case 'code-footer': return <div className="log-block code-footer">{line.text}</div>;

    // ── DOCS ─────────────────────────────────────────────
    case 'docs-header': return <div className="log-block docs-header">{line.text}</div>;
    case 'docs-body':   return <div className="log-block docs-body">{line.text}</div>;
    case 'docs-footer': return <div className="log-block docs-footer">{line.text}</div>;

    // ── DIFF ─────────────────────────────────────────────
    case 'diff-hunk':    return <div className="log-block diff-hunk">{line.text}</div>;
    case 'diff-removed': return <div className="log-block diff-removed">{line.text}</div>;
    case 'diff-added':   return <div className="log-block diff-added">{line.text}</div>;

    // ── VS CODE ──────────────────────────────────────────
    case 'vsc-import':       return <div className="vsc-l vsc-import">{line.text}</div>;
    case 'vsc-blank':        return <div className="vsc-l vsc-blank">&nbsp;</div>;
    case 'vsc-jsdoc-start':  return <div className="vsc-l vsc-comment">{line.text}</div>;
    case 'vsc-jsdoc-body':   return <div className="vsc-l vsc-comment-body">{line.text}</div>;
    case 'vsc-jsdoc-blank':  return <div className="vsc-l vsc-comment">{line.text}</div>;
    case 'vsc-jsdoc-tag':    return <div className="vsc-l vsc-comment-tag">{line.text}</div>;
    case 'vsc-jsdoc-end':    return <div className="vsc-l vsc-comment">{line.text}</div>;
    case 'vsc-fn-keyword':   return <div className="vsc-l vsc-fn-keyword">{line.text}</div>;
    case 'vsc-fn-param':     return <div className="vsc-l vsc-fn-param">{line.text}</div>;
    case 'vsc-fn-close-sig': return <div className="vsc-l vsc-fn-sig">{line.text}</div>;
    case 'vsc-fn-body':      return <div className="vsc-l vsc-fn-body">{line.text}</div>;
    case 'vsc-fn-end':       return <div className="vsc-l vsc-punctuation">{line.text}</div>;

    default:
      return <div className="log-block">{line.text}</div>;
  }
}
