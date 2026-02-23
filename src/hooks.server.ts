// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Server Hooks
// ═══════════════════════════════════════════════════════════════
// 1. Security headers
// 2. Static asset cache headers
// NOTE: Response compression should be handled by CDN/reverse proxy.

import type { Handle } from '@sveltejs/kit';

// Immutable asset path pattern (Vite hashed filenames)
const IMMUTABLE_ASSET = /\/_app\/immutable\//;

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // ── Security headers ──────────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ── Cache headers for immutable assets ────────────────────
  const url = event.url.pathname;
  if (IMMUTABLE_ASSET.test(url)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return response;
};
