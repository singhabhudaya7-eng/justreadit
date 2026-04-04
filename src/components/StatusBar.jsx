// StatusBar.jsx — Fake live status bar at the bottom
import { useState, useEffect } from 'react';
import { getProgress } from '../utils/storage';

const MODULES = ['node_modules/.cache', 'dist/.build', 'tmp/.sock', '.git/index', 'build/output'];

function fakeHeap() { return Math.floor(100 + Math.random() * 400); }
function fakePID()  { return Math.floor(1000 + Math.random() * 60000); }
function fakeInode(){ return Math.floor(10000 + Math.random() * 900000); }

function pad2(n) { return String(n).padStart(2, '0'); }
function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export default function StatusBar({ activeBook, chunkIndex }) {
  const [heap, setHeap] = useState(fakeHeap);
  const [pid]  = useState(fakePID);
  const [inode] = useState(fakeInode);
  const [mod]  = useState(() => MODULES[Math.floor(Math.random() * MODULES.length)]);
  const [uptime, setUptime] = useState(Math.floor(Math.random() * 3600));

  useEffect(() => {
    const heapInterval = setInterval(() => setHeap(h => h + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 8)), 3500);
    const uptimeInterval = setInterval(() => setUptime(u => u + 1), 1000);
    return () => { clearInterval(heapInterval); clearInterval(uptimeInterval); };
  }, []);

  const { total } = activeBook ? getProgress(activeBook) : { total: 0 };
  const pct = total > 0 ? Math.round((chunkIndex / total) * 100) : 0;

  return (
    <div className="status-bar">
      <span className="status-segment">{mod}</span>
      <span className="status-sep">│</span>
      <span className="status-segment">heap: {heap}mb</span>
      <span className="status-sep">│</span>
      <span className="status-segment">pid: {pid}</span>
      <span className="status-sep">│</span>
      <span className="status-segment">inode: {inode}</span>
      <span className="status-sep">│</span>
      <span className="status-segment">uptime: {formatUptime(uptime)}</span>
      {activeBook && (
        <>
          <span className="status-sep">│</span>
          <span className="status-segment">sync: {pct}% ({chunkIndex}/{total})</span>
        </>
      )}
      <span className="status-spacer" />
      <span className="status-segment">devread v1.0.0</span>
    </div>
  );
}
