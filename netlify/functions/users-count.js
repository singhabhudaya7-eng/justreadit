// users-count.js — Netlify Function: read-only lookup of the IP-deduped user count
// written by track-visit.js.
import { getStore } from '@netlify/blobs';

export default async () => {
  const store = getStore('ryw-metrics');
  const count = parseInt((await store.get('users_count')) || '0', 10);
  return new Response(JSON.stringify({ users: count }), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
};

export const config = { path: '/api/users-count' };
