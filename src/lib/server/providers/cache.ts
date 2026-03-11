// ═══════════════════════════════════════════════════════════════
// Stockclaw — Bounded LRU In-Memory Cache (B-05)
// ═══════════════════════════════════════════════════════════════
// - Max entries capped to prevent unbounded memory growth
// - LRU eviction when cache is full
// - Periodic expired-entry cleanup
// - Safe for 1000+ concurrent users

import type { CacheEntry } from './types';

// ── Config ────────────────────────────────────────────────────

const MAX_ENTRIES = 500;              // Hard cap on stored items
const CLEANUP_INTERVAL_MS = 60_000;  // Prune expired entries every 60s
const EVICT_BATCH = 50;              // How many LRU items to evict when full

// ── Store ─────────────────────────────────────────────────────

interface LRUCacheEntry<T> extends CacheEntry<T> {
  lastAccess: number;  // For LRU eviction
}

const store = new Map<string, LRUCacheEntry<unknown>>();

// ── Periodic cleanup (runs once, server-side singleton) ──────

let _cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (now > v.expiresAt) store.delete(k);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent Node from exiting
  if (_cleanupTimer && typeof _cleanupTimer === 'object' && 'unref' in _cleanupTimer) {
    (_cleanupTimer as NodeJS.Timeout).unref();
  }
}

// ── LRU eviction ─────────────────────────────────────────────

function evictLRU(): void {
  if (store.size <= MAX_ENTRIES) return;

  // First: remove all expired
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.expiresAt) store.delete(k);
  }
  if (store.size <= MAX_ENTRIES) return;

  // O(n) partial selection: find EVICT_BATCH oldest entries without full sort
  const oldest: Array<[string, number]> = [];
  for (const [k, v] of store.entries()) {
    if (oldest.length < EVICT_BATCH) {
      oldest.push([k, v.lastAccess]);
      if (oldest.length === EVICT_BATCH) {
        oldest.sort((a, b) => b[1] - a[1]); // descending — newest first
      }
    } else if (v.lastAccess < oldest[0][1]) {
      oldest[0] = [k, v.lastAccess];
      oldest.sort((a, b) => b[1] - a[1]);
    }
  }
  for (const [k] of oldest) store.delete(k);
}

// ── Public API ───────────────────────────────────────────────

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as LRUCacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // Update access time for LRU
  entry.lastAccess = Date.now();
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  ensureCleanup();

  // Evict if at capacity (before inserting)
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    evictLRU();
  }

  const now = Date.now();
  store.set(key, { data, expiresAt: now + ttlMs, lastAccess: now });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidatePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export function cacheStats(): { size: number; maxSize: number; keys: string[] } {
  // Prune expired
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.expiresAt) store.delete(k);
  }
  return { size: store.size, maxSize: MAX_ENTRIES, keys: [...store.keys()] };
}
