// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Data Freshness Utilities
// Shared freshness contract for terminal, passport, and signals UI.
// ═══════════════════════════════════════════════════════════════

import { timeSince } from '$lib/utils/time';

export type FreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unknown';
export type FreshnessInput = number | string | Date | null | undefined;

export interface FreshnessOptions {
  freshMs?: number;
  staleMs?: number;
  now?: number;
  futureGraceMs?: number;
}

export interface FreshnessMeta {
  level: FreshnessLevel;
  timestampMs: number | null;
  ageMs: number | null;
  ageLabel: string;
  isFresh: boolean;
  isAging: boolean;
  isStale: boolean;
  isUnknown: boolean;
}

const DEFAULT_FRESH_MS = 15_000;
const DEFAULT_STALE_MS = 60_000;
const DEFAULT_FUTURE_GRACE_MS = 5_000;

export function normalizeTimestamp(input: FreshnessInput): number | null {
  if (input == null) return null;
  if (input instanceof Date) {
    const value = input.getTime();
    return Number.isFinite(value) ? value : null;
  }
  if (typeof input === 'string') {
    const numeric = Number(input);
    if (Number.isFinite(numeric)) return normalizeNumericTimestamp(numeric);
    const parsed = Date.parse(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof input === 'number') {
    return normalizeNumericTimestamp(input);
  }
  return null;
}

function normalizeNumericTimestamp(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

export function getFreshnessLevel(
  input: FreshnessInput,
  options: FreshnessOptions = {}
): FreshnessLevel {
  return getFreshnessMeta(input, options).level;
}

export function getFreshnessMeta(
  input: FreshnessInput,
  {
    freshMs = DEFAULT_FRESH_MS,
    staleMs = DEFAULT_STALE_MS,
    now = Date.now(),
    futureGraceMs = DEFAULT_FUTURE_GRACE_MS,
  }: FreshnessOptions = {}
): FreshnessMeta {
  const timestampMs = normalizeTimestamp(input);
  if (timestampMs == null) {
    return {
      level: 'unknown',
      timestampMs: null,
      ageMs: null,
      ageLabel: 'Unknown',
      isFresh: false,
      isAging: false,
      isStale: false,
      isUnknown: true,
    };
  }

  const rawAgeMs = now - timestampMs;
  const ageMs = rawAgeMs < 0 && Math.abs(rawAgeMs) <= futureGraceMs ? 0 : rawAgeMs;
  const safeAgeMs = Math.max(ageMs, 0);

  let level: FreshnessLevel = 'aging';
  if (safeAgeMs <= freshMs) level = 'fresh';
  else if (safeAgeMs >= staleMs) level = 'stale';

  return {
    level,
    timestampMs,
    ageMs: safeAgeMs,
    ageLabel: formatFreshnessAge(safeAgeMs, timestampMs),
    isFresh: level === 'fresh',
    isAging: level === 'aging',
    isStale: level === 'stale',
    isUnknown: false,
  };
}

export function formatFreshnessAge(ageMs: number | null, timestampMs?: number | null): string {
  if (ageMs == null) return 'Unknown';
  if (ageMs < 1000) return 'just now';
  if (timestampMs != null) return timeSince(timestampMs);
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
