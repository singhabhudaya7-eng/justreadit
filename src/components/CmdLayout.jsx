// CmdLayout.jsx — Fake bash shell disguise. You "read" by typing real-feeling commands
// (cd, cat, next, ls…) and the book text comes back looking exactly like command output —
// because plain text really is what a terminal shows. Includes a pile of joke commands.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Monitor } from 'lucide-react';
import {
  setProgress, getProgress, getBookmarks, toggleBookmark,
  recordSessionStart, recordSessionEnd,
} from '../utils/storage';

const HOST = 'devuser@backend-worker-03';
const FORTUNES = [
  'The best code is the code you never had to write. — someone, probably in a standup',
  'A page turned is worth two lines committed.',
  'There are only two hard things: cache invalidation, naming things, and reading at your desk.',
  'It works on my machine, and so does this book.',
  'Ship early, read often.',
];

export default function CmdLayout({
  books, activeBook, activeBookName, onOpenBook, onFileUpload,
  onShowModeMenu, onDeleteBook,
}) {
  const [lines,   setLines]   = useState(() => [
    { type: 'sys', text: 'Last login: ' + new Date().toDateString() + ' on ttys001' },
    { type: 'sys', text: "Type 'help' to see what's available." },
  ]);
  const [input,   setInput]   = useState('');
  const [history, setHistory] = useState([]);
  const [histPos, setHistPos] = useState(-1);
  const [reconnecting, setReconnecting] = useState(false);

  const curIndexRef    = useRef(0);
  const sessionStartMs = useRef(Date.now());
  const scrollRef       = useRef(null);
  const inputRef         = useRef(null);
  const fileInputRef    = useRef(null);

  const paragraphs = activeBook?.paragraphs || [];
  const total      = paragraphs.length;

  useEffect(() => {
    if (!activeBookName) return;
    const prog = getProgress(activeBookName);
    curIndexRef.current = prog.chunkIndex || 0;
    sessionStartMs.current = Date.now();
    recordSessionStart(activeBookName);
    return () => recordSessionEnd(activeBookName, Date.now() - sessionStartMs.current);
  }, [activeBookName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  useEffect(() => { focusInput(); }, [focusInput]);

  const print = useCallback((text, type = 'out') => {
    setLines(prev => [...prev, { type, text }]);
  }, []);

  const prompt = () => `${HOST}:~/projects/backend${activeBookName ? '/' + activeBookName : ''}$`;

  const showParagraph = useCallback((idx) => {
    if (!paragraphs.length) { print('cat: no book open — try `ls` then `cd <book>`'); return; }
    const clamped = Math.max(0, Math.min(total - 1, idx));
    curIndexRef.current = clamped;
    setProgress(activeBookName, clamped);
    print(paragraphs[clamped], 'book');
    print(`— ¶${clamped + 1}/${total} · ${Math.round((clamped / total) * 100)}% —`, 'sys');
  }, [paragraphs, total, activeBookName, print]);

  const runCommand = useCallback((raw) => {
    const trimmed = raw.trim();
    print(trimmed, 'cmd');
    if (trimmed) setHistory(h => [...h, trimmed]);
    setHistPos(-1);

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ');
    const c = (cmd || '').toLowerCase();

    switch (c) {
      case '': break;

      case 'help': case 'man': case '--help':
        print([
          'ls                 list your library',
          'cd <book>          open a book',
          'next, n            (blank enter also works) next paragraph',
          'prev, p, back      previous paragraph',
          'goto <n>           jump to paragraph n',
          'bm, bookmark       bookmark current paragraph',
          'bm ls              list bookmarks',
          'progress           show reading progress',
          'mode, switch       switch view mode (or Ctrl+M)',
          'history            show command history',
          'clear, cls         clear the screen',
          'whoami, pwd, date  the usual',
          'exit, quit, logout guess',
        ].join('\n'));
        break;

      case 'ls': {
        const entries = Object.values(books);
        if (!entries.length) { print('total 0'); break; }
        print(entries.map(b => {
          const p = getProgress(b.name);
          const pct = p.total > 0 ? Math.round((p.chunkIndex / p.total) * 100) : 0;
          return `-rw-r--r--  1 devuser  staff  ${String(b.totalParagraphs || 0).padStart(5)}  ${b.name}.txt   [${pct}%]`;
        }).join('\n'));
        break;
      }

      case 'cd': {
        if (!arg || arg === '..' || arg === '~') { print('(library) — use `ls` to see books'); break; }
        const match = Object.keys(books).find(n => n === arg) || Object.keys(books).find(n => n.toLowerCase().includes(arg.toLowerCase()));
        if (!match) { print(`bash: cd: ${arg}: No such file or directory`, 'err'); break; }
        onOpenBook(match);
        print(`opened ${match}`);
        break;
      }

      case 'cat': case 'less': case 'more': case 'read':
        if (arg && arg !== activeBookName) {
          const match = Object.keys(books).find(n => n === arg || n.toLowerCase().includes(arg.toLowerCase()));
          if (match) { onOpenBook(match); print(`opened ${match}`); break; }
        }
        showParagraph(curIndexRef.current);
        break;

      case 'next': case 'n': case 'fg':
        showParagraph(curIndexRef.current + 1); break;

      case 'prev': case 'p': case 'back':
        showParagraph(curIndexRef.current - 1); break;

      case 'goto': case 'page': {
        const n = parseInt(arg, 10);
        if (Number.isNaN(n)) { print('usage: goto <paragraph number>', 'err'); break; }
        showParagraph(n - 1);
        break;
      }

      case 'bm': case 'bookmark': {
        if (!activeBookName) { print('no book open', 'err'); break; }
        if (arg === 'ls' || arg === 'list') {
          const bms = getBookmarks(activeBookName);
          print(bms.length ? bms.map(b => `¶${b.index + 1}  ${b.snippet}`).join('\n') : 'no bookmarks yet');
          break;
        }
        const snippet = (paragraphs[curIndexRef.current] || '').slice(0, 80);
        toggleBookmark(activeBookName, curIndexRef.current, snippet);
        print(`bookmarked ¶${curIndexRef.current + 1}`);
        break;
      }

      case 'progress': {
        if (!activeBookName) { print('no book open', 'err'); break; }
        const p = getProgress(activeBookName);
        print(`${Math.round((p.chunkIndex / (p.total || 1)) * 100)}% — paragraph ${p.chunkIndex + 1} of ${p.total}`);
        break;
      }

      case 'mode': case 'switch':
        onShowModeMenu(); break;

      case 'history':
        print(history.length ? history.map((h, i) => `  ${i + 1}  ${h}`).join('\n') : '(empty)');
        break;

      case 'clear': case 'cls':
        setLines([]); break;

      case 'whoami':
        print('devuser'); break;
      case 'pwd':
        print(`/home/devuser/projects/backend${activeBookName ? '/' + activeBookName : ''}`); break;
      case 'date':
        print(new Date().toString()); break;
      case 'echo':
        print(arg); break;
      case 'fortune':
        print(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]); break;
      case 'cowsay':
        print(cowsay(arg || 'moo'), 'ascii'); break;
      case 'neofetch':
        print(neofetch(books, activeBookName), 'ascii'); break;

      case 'sudo':
        print('devuser is not in the sudoers file. This incident will be reported.', 'err'); break;

      case 'rm':
        if (/-rf|\*|\//.test(arg)) print('Nice try. Nothing was harmed (except maybe your evening).', 'err');
        else print(`rm: ${arg || 'missing operand'}`, 'err');
        break;

      case 'sl':
        print('    ====        ________                ___________\n _D _|  |_______/        \\__I_I_____===__|_________|\n  |(_)---  |   H\\________/ |   |        =|___ ___|      _________________\n  /     |  |   H  |  |     |   |         ||_| |_||     _|                \\_____A\n |      |  |   H  |__--------------------| [___] |   =|                        |\n | ________|___H__/__|_____/[][]~\\_______|       |   -|                        |\n |/ |   |-----------I_____I [][] []  D   |=======|____|________________________|_\n__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__|__________________________|_\n |/-=|___|=    ||    ||    ||    |_____/~\\___/          |_D__D__D_|  |_D__D__D_|\n  \\_/      \\_O=====O=====O=====O_/      \\_/               \\_/   \\_/    \\_/   \\_/', 'ascii');
        break;

      case 'exit': case 'quit': case 'logout':
        print('logout');
        print('Connection to devread closed.', 'sys');
        setReconnecting(true);
        setTimeout(() => {
          setLines([
            { type: 'sys', text: 'Connecting to devread…' },
            { type: 'sys', text: 'Welcome back.' },
          ]);
          setReconnecting(false);
        }, 1400);
        break;

      default:
        print(`bash: ${cmd}: command not found`, 'err');
    }
  }, [books, activeBookName, activeBook, history, onOpenBook, onShowModeMenu, print, showParagraph, paragraphs]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (reconnecting) return;
      runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const pos = histPos < 0 ? history.length - 1 : Math.max(0, histPos - 1);
      setHistPos(pos);
      setInput(history[pos] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histPos < 0) return;
      const pos = histPos + 1;
      if (pos >= history.length) { setHistPos(-1); setInput(''); }
      else { setHistPos(pos); setInput(history[pos]); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const REGISTRY = ['help', 'ls', 'cd', 'cat', 'next', 'prev', 'goto', 'bm', 'bookmark', 'progress', 'mode', 'history', 'clear', 'whoami', 'pwd', 'date', 'echo', 'fortune', 'cowsay', 'neofetch', 'exit'];
      const matches = REGISTRY.filter(cmd => cmd.startsWith(input.toLowerCase()) && input.length > 0);
      if (matches.length === 1) setInput(matches[0] + ' ');
    } else if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault(); onShowModeMenu();
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault(); setLines([]);
    }
  }, [input, history, histPos, reconnecting, runCommand, onShowModeMenu]);

  return (
    <div className="cmd-shell" onClick={focusInput}>
      <div className="cmd-titlebar">
        <div className="cmd-dots"><div className="tdot tdot-red" /><div className="tdot tdot-yellow" /><div className="tdot tdot-green" /></div>
        <div className="cmd-title">devuser@backend-worker-03: ~/projects/backend</div>
        <button className="term-hdr-btn" onClick={onShowModeMenu} title="Switch mode (Ctrl+M)"><Monitor size={13} /></button>
      </div>

      <div className="cmd-scroll" ref={scrollRef}>
        {lines.map((l, i) => (
          <div key={i} className={`cmd-line cmd-line-${l.type}`}>
            {l.type === 'cmd' ? <><span className="cmd-prompt">{prompt()}</span> {l.text}</> : l.text}
          </div>
        ))}
        {!reconnecting && (
          <div className="cmd-line cmd-inputline">
            <span className="cmd-prompt">{prompt()}</span>
            <input
              ref={inputRef}
              className="cmd-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        )}
      </div>

      {!activeBook && !books && null}
      <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); }} />

      {Object.keys(books).length === 0 && (
        <div className="cmd-import-hint">
          No books yet — <button className="cmd-import-link" onClick={() => fileInputRef.current?.click()}>import a PDF</button>, then type <code>ls</code>.
        </div>
      )}

      {activeBook && (
        <div className="cmd-quickbar">
          <button className="cmd-qb-btn" onClick={() => fileInputRef.current?.click()}>+ import</button>
          <button className="cmd-qb-btn" onClick={() => onDeleteBook(activeBookName)}>rm {activeBookName}</button>
        </div>
      )}
    </div>
  );
}

function cowsay(text) {
  const clean = text.slice(0, 40);
  const border = '_'.repeat(clean.length + 2);
  return ` ${border}\n< ${clean} >\n ${'-'.repeat(clean.length + 2)}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`;
}

function neofetch(books, activeBookName) {
  const count = Object.keys(books).length;
  return [
    `devuser@backend-worker-03`,
    `-------------------------`,
    `OS: BackendOS 24.04 LTS`,
    `Host: MacBook Pro (definitely working)`,
    `Shell: zsh 5.9`,
    `Terminal: devread`,
    `Books loaded: ${count}`,
    `Currently reading: ${activeBookName || 'none'}`,
    `Uptime: suspiciously long for a "quick bug fix"`,
  ].join('\n');
}
