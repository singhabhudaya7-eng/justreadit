// track-visit.js — Netlify Function: increments the unique-users counter, deduped by IP.
// IP dedup has to happen here (server-side) — a client can't be trusted to report its
// own IP honestly, and localStorage dedup breaks under incognito, cleared storage, or
// visits split across readyourway.ink / www / the netlify.app subdomain.
import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const ip = context.ip || 'unknown';
  const store = getStore('ryw-metrics');
  const ipKey = `ip:${ip}`;

  const alreadySeen = await store.get(ipKey);
  if (!alreadySeen) {
    await store.set(ipKey, String(Date.now()));
    const current = parseInt((await store.get('users_count')) || '0', 10);
    await store.set('users_count', String(current + 1));
  }

  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*' } });
};

export const config = { path: '/api/track-visit' };
