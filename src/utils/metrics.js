// metrics.js — Cross-user counters.
// "users" is deduped server-side by IP (see netlify/functions/track-visit.js + Blobs) —
// client-side localStorage dedup broke under incognito, cleared storage, and visits split
// across readyourway.ink / www / the netlify.app subdomain. Clicks/minutes don't need
// dedup, so those still go straight to a free, no-signup public counter API.

const COUNTAPI_BASE = 'https://countapi.mileshilliard.com/api/v1';

const KEYS = {
  clicks: 'readyourway_jru_tidybits_clicks_v1',
  minutes: 'readyourway_jru_minutes_v1',
};

async function hit(key, amount) {
  try {
    const url = amount ? `${COUNTAPI_BASE}/hit/${key}?amount=${amount}` : `${COUNTAPI_BASE}/hit/${key}`;
    await fetch(url, { keepalive: true });
  } catch {
    // best-effort only
  }
}

async function get(key) {
  try {
    const res = await fetch(`${COUNTAPI_BASE}/get/${key}`);
    const data = await res.json();
    return data.value || 0;
  } catch {
    return null;
  }
}

async function getUsersCount() {
  try {
    const res = await fetch('/api/users-count');
    const data = await res.json();
    return data.users ?? 0;
  } catch {
    return null;
  }
}

export function trackVisit() {
  fetch('/api/track-visit', { method: 'POST', keepalive: true }).catch(() => {});
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
    getUsersCount(),
    get(KEYS.clicks),
    get(KEYS.minutes),
  ]);
  return { users, clicks, minutes };
}
