// App.jsx — Root: manages books, loading, mode switching
import { useState, useCallback, useEffect } from 'react';
import VSCodeLayout  from './components/VSCodeLayout';
import TerminalLayout from './components/TerminalLayout';
import ReaderLayout   from './components/ReaderLayout';
import ExcelLayout    from './components/ExcelLayout';
import CmdLayout      from './components/CmdLayout';
import ModeMenu       from './components/ModeMenu';
import SupportWidget  from './components/SupportWidget';
import { extractPDF } from './utils/pdfParser';
import {
  initStorage, saveBook, loadBook, getAllBooks, deleteBook,
  getConfig, setConfig as persistConfig, DEFAULT_CONFIG,
} from './utils/storage';

export default function App() {
  const [ready,          setReady]          = useState(false);
  const [books,          setBooks]          = useState({});
  const [activeBookName, setActiveBookName] = useState(null);
  const [activeBook,     setActiveBook]     = useState(null);
  const [config,         setLocalConfig]    = useState(DEFAULT_CONFIG);
  const [loading,        setLoading]        = useState(false);
  const [loadPct,        setLoadPct]        = useState(0);
  const [loadLabel,      setLoadLabel]      = useState('Parsing PDF…');
  const [showModeMenu,   setShowModeMenu]   = useState(false);

  useEffect(() => {
    initStorage().then(() => {
      setBooks(getAllBooks());
      setLocalConfig(getConfig());
      setReady(true);
    });
  }, []);

  const refreshBooks = () => setBooks(getAllBooks());

  const openBook = useCallback(async (name) => {
    setLoadLabel('Opening book…');
    setLoadPct(0);
    setLoading(true);
    try {
      const b = await loadBook(name);
      if (b) {
        setActiveBookName(name);
        setActiveBook(b);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      alert('Please provide a valid .pdf file.');
      return;
    }
    setLoadLabel('Parsing PDF…');
    setLoading(true);
    setLoadPct(0);
    try {
      const { paragraphs, chunksPerPage, totalPages } = await extractPDF(file, setLoadPct);
      const name = file.name
        .replace(/\.pdf$/i, '')
        .replace(/[^a-z0-9_-]/gi, '_')
        .slice(0, 40);
      await saveBook(name, paragraphs, chunksPerPage, totalPages, file);
      refreshBooks();
      setLoadLabel('Opening book…');
      const b = await loadBook(name);
      setActiveBookName(name);
      setActiveBook(b);
      setLoading(false);
    } catch (err) {
      console.error(err);
      alert('Failed to parse PDF: ' + err.message);
      setLoading(false);
    }
  }, []);

  const handleDeleteBook = useCallback((name) => {
    if (!confirm(`Remove "${name}" from devread?`)) return;
    deleteBook(name);
    refreshBooks();
    if (activeBookName === name) {
      setActiveBookName(null);
      setActiveBook(null);
    }
  }, [activeBookName]);

  const updateConfig = useCallback((updates) => {
    const newCfg = { ...config, ...updates };
    setLocalConfig(newCfg);
    persistConfig(newCfg);
  }, [config]);

  const handleModeSelect = useCallback((mode) => {
    updateConfig({ appMode: mode });
    setShowModeMenu(false);
  }, [updateConfig]);

  const sharedProps = {
    books,
    activeBook,
    activeBookName,
    config,
    onOpenBook:    openBook,
    onFileUpload:  handleFile,
    onConfigChange: updateConfig,
    onShowModeMenu: () => setShowModeMenu(true),
    onBooksChange:  refreshBooks,
    onDeleteBook:   handleDeleteBook,
  };

  if (!ready) {
    return (
      <div className="global-loading">
        <div className="global-spinner" />
        <div className="global-loading-text">Loading library…</div>
      </div>
    );
  }

  return (
    <>
      {/* Loading overlay (full screen) */}
      {loading && (
        <div className="global-loading">
          <div className="global-spinner" />
          <div className="global-loading-text">{loadLabel} {loadPct > 0 ? `${loadPct}%` : ''}</div>
          <div className="global-loading-bar">
            <div className="global-loading-fill" style={{ width: `${loadPct}%` }} />
          </div>
        </div>
      )}

      {config.appMode === 'vscode'   && <VSCodeLayout   {...sharedProps} />}
      {config.appMode === 'terminal' && <TerminalLayout {...sharedProps} />}
      {config.appMode === 'reader'   && <ReaderLayout   {...sharedProps} />}
      {config.appMode === 'excel'    && <ExcelLayout    {...sharedProps} />}
      {config.appMode === 'cmd'      && <CmdLayout      {...sharedProps} />}

      {showModeMenu && (
        <ModeMenu
          currentMode={config.appMode}
          onSelect={handleModeSelect}
          onClose={() => setShowModeMenu(false)}
        />
      )}

      <SupportWidget />
    </>
  );
}
