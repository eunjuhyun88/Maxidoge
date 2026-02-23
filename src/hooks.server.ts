// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Server Hooks
// ═══════════════════════════════════════════════════════════════
// 1. Response compression (gzip) — crucial for ngrok / external access
// 2. Security headers
// 3. Static asset cache headers

import type { Handle } from '@sveltejs/kit';
import { gzipSync } from 'node:zlib';

// Minimum size to bother compressing (bytes)
const MIN_COMPRESS_SIZE = 1024;

// Content types worth compressing
const COMPRESSIBLE = /^(text\/|application\/json|application\/javascript|application\/xml|image\/svg\+xml)/;

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

  // ── Gzip compression ──────────────────────────────────────
  const acceptEncoding = event.request.headers.get('accept-encoding') ?? '';
  if (!acceptEncoding.includes('gzip')) return response;

  const contentType = response.headers.get('content-type') ?? '';
  if (!COMPRESSIBLE.test(contentType)) return response;

  // Don't double-compress
  if (response.headers.has('content-encoding')) return response;

  try {
    const body = await response.arrayBuffer();
    if (body.byteLength < MIN_COMPRESS_SIZE) {
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    const compressed = gzipSync(Buffer.from(body), { level: 6 });

    const headers = new Headers(response.headers);
    headers.set('content-encoding', 'gzip');
    headers.set('content-length', String(compressed.byteLength));
    headers.delete('content-length'); // let transfer-encoding handle it
    headers.set('content-length', String(compressed.byteLength));
    headers.append('vary', 'Accept-Encoding');

    return new Response(compressed, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    // If compression fails, return original response
    return response;
  }
};
