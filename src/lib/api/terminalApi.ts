// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Terminal Scan API Client (browser-side)
// ═══════════════════════════════════════════════════════════════
//
// Wraps /api/terminal/scan/* endpoints for the Terminal page.

import type {
  TerminalScanSummary,
  TerminalScanDetail,
  TerminalScanSignal,
} from '$lib/services/scanService';

// ─── Response Types ─────────────────────────────────────────

export interface RunScanResponse {
  success: boolean;
  scanId: string;
  persisted: boolean;
  warning?: string;
  data: TerminalScanDetail;
}

export interface ScanHistoryResponse {
  success: boolean;
  records: TerminalScanSummary[];
  pagination: { limit: number; offset: number; total: number };
  warning?: string;
}

export interface ScanDetailResponse {
  success: boolean;
  record: TerminalScanDetail | null;
  warning?: string;
}

export interface ScanSignalsResponse {
  success: boolean;
  records: TerminalScanSignal[];
  warning?: string;
}

// ─── Market Snapshot Response ───────────────────────────────

export interface MarketSnapshotResponse {
  success: boolean;
  pair: string;
  timeframe: string;
  at: number;
  sources: Record<string, boolean>;
  warning?: string;
}

// ─── Helper ─────────────────────────────────────────────────

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `API error ${res.status}`);
  }
  return data as T;
}

// ─── Terminal Scan API ──────────────────────────────────────

/** Run a new terminal scan */
export async function runTerminalScan(
  pair = 'BTC/USDT',
  timeframe = '4h',
): Promise<RunScanResponse> {
  return apiCall<RunScanResponse>('/api/terminal/scan', {
    method: 'POST',
    body: JSON.stringify({ pair, timeframe }),
  });
}

/** Get scan history */
export async function getScanHistory(
  options: { pair?: string; timeframe?: string; limit?: number; offset?: number } = {},
): Promise<ScanHistoryResponse> {
  const params = new URLSearchParams();
  if (options.pair) params.set('pair', options.pair);
  if (options.timeframe) params.set('timeframe', options.timeframe);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  return apiCall<ScanHistoryResponse>(`/api/terminal/scan/history?${params}`);
}

/** Get scan detail by ID */
export async function getScanDetail(scanId: string): Promise<ScanDetailResponse> {
  return apiCall<ScanDetailResponse>(`/api/terminal/scan/${scanId}`);
}

/** Get scan signals by scan ID */
export async function getScanSignals(scanId: string): Promise<ScanSignalsResponse> {
  return apiCall<ScanSignalsResponse>(`/api/terminal/scan/${scanId}/signals`);
}

// ─── Market Data API ────────────────────────────────────────

/** Get market snapshot (aggregated from all sources) */
export async function getMarketSnapshot(
  pair = 'BTC/USDT',
  timeframe = '4h',
): Promise<MarketSnapshotResponse> {
  return apiCall<MarketSnapshotResponse>('/api/market/snapshot', {
    method: 'POST',
    body: JSON.stringify({ pair, timeframe }),
  });
}

/** Get Fear & Greed index */
export async function getFearGreed(): Promise<{
  success: boolean;
  current: { value: number; classification: string } | null;
}> {
  return apiCall('/api/feargreed');
}

/** Get CoinGecko global data */
export async function getCoinGeckoGlobal(): Promise<{
  success: boolean;
  data: {
    btcDominance: number;
    totalMarketCap: number;
    marketCapChange24hPct: number;
  } | null;
}> {
  return apiCall('/api/coingecko/global');
}

/** Get Yahoo Finance data for a symbol */
export async function getYahooData(symbol: string): Promise<{
  success: boolean;
  symbol: string;
  points: Array<{ timestampMs: number; close: number }>;
}> {
  return apiCall(`/api/yahoo/${encodeURIComponent(symbol)}`);
}
