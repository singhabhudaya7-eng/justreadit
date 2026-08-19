// metrics.js — Cross-user counters via countapi.mileshilliard.com (free, no signup, no keys).
// No backend of our own: each browser hits a shared public counter directly.
// Caveat: these keys are unauthenticated — anyone who learns them could inflate the numbers,
// and "users" only counts browsers that still have their localStorage id (cleared storage /
// other devices / other browsers = recounted as new). Good enough for a rough dashboard, not audit-grade.

const BASE = 'https://countapi.mileshilliard.com/api/v1';

const KEYS = {
  users:  'readyourway_jru_users_v1',
  clicks: 'readyourway_jru_tidybits_clicks_v1',
  minutes: 'readyourway_jru_minutes_v1',
};

const UID_KEY = 'ryw_uid';

async function hit(key, amount) {
  try {
    const url = amount ? `${BASE}/hit/${key}?amount=${amount}` : `${BASE}/hit/${key}`;
    await fetch(url, { keepalive: true });
  } catch {
    // best-effort only
  }
}

async function get(key) {
  try {
    const res = await fetch(`${BASE}/get/${key}`);
    const data = await res.json();
    return data.value || 0;
  } catch {
    return null;
  }
}

export function trackVisit() {
  let uid = localStorage.getItem(UID_KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem(UID_KEY, uid);
    hit(KEYS.users);
  }
}

export function trackTidybitsClick() {
  hit(KEYS.clicks);
}

export function trackMinutes(minutes) {
  const whole = Math.round(minutes);
  if (whole > 0) hit(KEYS.minutes, whole);
}

export async function fetchAllMetrics() {
  const [users, clicks, minutes] = await Promise.all([
    get(KEYS.users),
    get(KEYS.clicks),
    get(KEYS.minutes),
  ]);
  return { users, clicks, minutes };
}
