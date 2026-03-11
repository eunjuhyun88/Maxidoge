// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Configuration
// ═══════════════════════════════════════════════════════════════
//
// Feature flags, timeouts, and A/B test settings.
// All controlled via environment variables for runtime tuning.

import { env } from '$env/dynamic/private';

// ─── Configuration ──────────────────────────────────────────

export interface LLMScanConfig {
  /** Master switch — enables C-02 pipeline */
  enabled: boolean;
  /** A/B test: percentage of eligible users routed to C-02 (0-100) */
  abTestPercent: number;
  /** Overall pipeline timeout (ms) — data + LLM combined */
  pipelineTimeoutMs: number;
  /** Individual LLM call timeout (ms) */
  llmCallTimeoutMs: number;
  /** Maximum cost per scan (USD) — safety limit */
  maxCostPerScan: number;
  /** Auto-fallback to B-02 on any C-02 error */
  fallbackOnError: boolean;
  /** Minimum successful Level 1 agents to proceed (out of 8) */
  minSuccessfulAgents: number;
  /** LLM temperature by level */
  temperature: {
    analyst: number;
    synthesis: number;
    commander: number;
  };
  /** Max tokens by level */
  maxTokens: {
    analyst: number;
    synthesis: number;
    commander: number;
  };
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return value === 'true' || value === '1';
}

function parseNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function getLLMScanConfig(): LLMScanConfig {
  return {
    enabled: parseBool(env.LLM_SCAN_ENABLED, false),
    abTestPercent: parseNumber(env.LLM_SCAN_AB_PERCENT, 0, 0, 100),
    pipelineTimeoutMs: parseNumber(env.LLM_SCAN_TIMEOUT_MS, 15_000, 5_000, 30_000),
    llmCallTimeoutMs: parseNumber(env.LLM_SCAN_LLM_TIMEOUT_MS, 8_000, 3_000, 15_000),
    maxCostPerScan: parseNumber(env.LLM_SCAN_MAX_COST, 0.05, 0.001, 1.0),
    fallbackOnError: parseBool(env.LLM_SCAN_FALLBACK, true),
    minSuccessfulAgents: parseNumber(env.LLM_SCAN_MIN_AGENTS, 4, 1, 8),
    temperature: {
      analyst: 0.3,
      synthesis: 0.4,
      commander: 0.5,
    },
    maxTokens: {
      analyst: 256,
      synthesis: 256,
      commander: 384,
    },
  };
}

// ─── Routing Decision ───────────────────────────────────────

/**
 * Determines if a user should be routed to C-02 (LLM scan).
 * - Master switch must be on
 * - Non-logged-in users always get B-02 (cost savings)
 * - A/B test: hash userId to get deterministic bucket
 */
export function shouldUseLLMScan(userId: string | null | undefined): boolean {
  const config = getLLMScanConfig();

  // Master switch
  if (!config.enabled) return false;

  // Non-logged-in users → B-02 (avoid LLM cost for guests)
  if (!userId) return false;

  // 100% → always C-02
  if (config.abTestPercent >= 100) return true;

  // 0% → always B-02
  if (config.abTestPercent <= 0) return false;

  // Deterministic A/B: hash userId to get stable bucket
  const bucket = hashToBucket(userId, 100);
  return bucket < config.abTestPercent;
}

/**
 * Simple deterministic hash → bucket [0, modulus).
 * Uses DJB2-like hash for fast, stable distribution.
 */
function hashToBucket(str: string, modulus: number): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash % modulus;
}
