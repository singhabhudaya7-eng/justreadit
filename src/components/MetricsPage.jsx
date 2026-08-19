// MetricsPage.jsx — Private /metric dashboard: users ever, tidybits clicks, hours online.
// Gate is a client-side password check only — anyone reading the bundle can find METRIC_PASSWORD.
// Good enough to keep casual visitors out, not a real auth boundary.
import { useEffect, useState } from 'react';
import { fetchAllMetrics } from '../utils/metrics';

const METRIC_PASSWORD = 'changeme';
const UNLOCK_KEY = 'ryw_metric_unlocked';

export default function MetricsPage() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1');
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!unlocked) return;
    fetchAllMetrics().then(setData);
  }, [unlocked]);

  const tryUnlock = (e) => {
    e.preventDefault();
    if (input === METRIC_PASSWORD) {
      sessionStorage.setItem(UNLOCK_KEY, '1');
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!unlocked) {
    return (
      <div style={styles.wrap}>
        <form style={styles.gate} onSubmit={tryUnlock}>
          <div style={styles.gateLabel}>readyourway / metric</div>
          <input
            style={styles.input}
            type="password"
            autoFocus
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder="password"
          />
          {error && <div style={styles.error}>wrong password</div>}
        </form>
      </div>
    );
  }

  const hours = data ? (data.minutes / 60).toFixed(1) : null;

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <div style={styles.title}>readyourway / metric</div>
        {!data ? (
          <div style={styles.loading}>loading…</div>
        ) : (
          <div style={styles.grid}>
            <Stat label="users ever" value={data.users} />
            <Stat label="tidybits clicks" value={data.clicks} />
            <Stat label="hours online" value={hours} />
          </div>
        )}
        <div style={styles.footnote}>
          approximate — counted client-side, resets per browser/device.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value ?? '—'}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0f14',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    color: '#d4d4d4',
  },
  gate: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: 260,
  },
  gateLabel: { color: '#858585', fontSize: 13, marginBottom: 4 },
  input: {
    background: '#1e1e1e',
    border: '1px solid #3c3c3c',
    borderRadius: 4,
    padding: '8px 10px',
    color: '#d4d4d4',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
  },
  error: { color: '#f48771', fontSize: 12 },
  panel: {
    background: '#111318',
    border: '1px solid #3c3c3c',
    borderRadius: 6,
    padding: '28px 32px',
    minWidth: 360,
  },
  title: { color: '#f0f0f0', fontSize: 14, marginBottom: 20 },
  loading: { color: '#858585', fontSize: 13 },
  grid: { display: 'flex', gap: 28 },
  stat: { display: 'flex', flexDirection: 'column', gap: 4 },
  statValue: { fontSize: 26, color: '#4ec9b0' },
  statLabel: { fontSize: 11, color: '#858585' },
  footnote: { marginTop: 22, fontSize: 10.5, color: '#5a5a5a' },
};
