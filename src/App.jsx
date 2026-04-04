// App.jsx — Root: manages books, loading, mode switching
import { useState, useRef, useCallback } from 'react';
import VSCodeLayout  from './components/VSCodeLayout';
import TerminalLayout from './components/TerminalLayout';
import ModeMenu      from './components/ModeMenu';
import { extractPDF } from './utils/pdfParser';
import {
  saveBook, loadBook, getAllBooks, deleteBook,
  getProgress, getConfig, setConfig as persistConfig,
} from './utils/storage';

export default function App() {
  const [books,          setBooks]          = useState(() => getAllBooks());
  const [activeBookName, setActiveBookName] = useState(null);
  const [activeBook,     setActiveBook]     = useState(null);
  const [config,         setLocalConfig]    = useState(() => getConfig());
  const [loading,        setLoading]        = useState(false);
  const [loadPct,        setLoadPct]        = useState(0);
  const [showModeMenu,   setShowModeMenu]   = useState(false);

  const refreshBooks = () => setBooks(getAllBooks());

  const openBook = useCallback((name) => {
    const b = loadBook(name);
    if (!b) return;
    setActiveBookName(name);
    setActiveBook(b);
  }, []);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      alert('Please provide a valid .pdf file.');
      return;
    }
    setLoading(true);
    setLoadPct(0);
    try {
      const { paragraphs, chunksPerPage, totalPages } = await extractPDF(file, setLoadPct);
      const name = file.name
        .replace(/\.pdf$/i, '')
        .replace(/[^a-z0-9_-]/gi, '_')
        .slice(0, 40);
      saveBook(name, paragraphs, chunksPerPage, totalPages);
      refreshBooks();
      setTimeout(() => {
        setLoading(false);
        openBook(name);
      }, 300);
    } catch (err) {
      console.error(err);
      alert('Failed to parse PDF: ' + err.message);
      setLoading(false);
    }
  }, [openBook]);

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

  return (
    <>
      {/* Loading overlay (full screen) */}
      {loading && (
        <div className="global-loading">
          <div className="global-spinner" />
          <div className="global-loading-text">Parsing PDF… {loadPct}%</div>
          <div className="global-loading-bar">
            <div className="global-loading-fill" style={{ width: `${loadPct}%` }} />
          </div>
        </div>
      )}

      {!loading && (
        <>
          {config.appMode === 'vscode'   && <VSCodeLayout   {...sharedProps} />}
          {config.appMode === 'terminal' && <TerminalLayout {...sharedProps} />}
        </>
      )}

      {showModeMenu && (
        <ModeMenu
          currentMode={config.appMode}
          onSelect={handleModeSelect}
          onClose={() => setShowModeMenu(false)}
        />
      )}
    </>
  );
}
