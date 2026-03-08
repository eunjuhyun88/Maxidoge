// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Terminal API Client (browser-side)
// ═══════════════════════════════════════════════════════════════
//
// Wraps terminal-facing endpoints for the Terminal page.

import type {
  TerminalScanSummary,
  TerminalScanDetail,
  TerminalScanSignal,
} from '$lib/services/scanService';

type JsonRecord = Record<string, unknown>;

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

export interface TerminalChatRow {
  id: string;
  userId: string;
  channel: string;
  senderKind: string;
  senderId: string | null;
  senderName: string;
  message: string;
  meta: Record<string, unknown>;
  createdAt: number;
}

export interface TerminalChatResponse {
  success: boolean;
  message: TerminalChatRow | null;
  agentResponse: TerminalChatRow | null;
}

export interface TerminalLiveTickerSnapshot {
  btcDominance: number | null;
  ethDominance: number | null;
  totalVolumeUsd: number | null;
  totalMarketCapUsd: number | null;
  marketCapChange24hPct: number | null;
  fearGreedValue: number | null;
  fearGreedClassification: string | null;
  stablecoinTotalMcapUsd: number | null;
}

export class TerminalApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TerminalApiError';
    this.status = status;
  }
}

// ─── Helper ─────────────────────────────────────────────────

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function extractDataRecord(payload: JsonRecord): JsonRecord | null {
  return isRecord(payload.data) ? payload.data : null;
}

function parseErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  return `API error ${status}`;
}

function isSuccessEnvelope(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return payload.success === true || payload.ok === true;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseTimestampMs(value: unknown): number {
  const asNumber = parseNumber(value);
  if (asNumber !== null) return asNumber;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function toBooleanMap(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const mapped: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value)) {
    mapped[key] = Boolean(raw);
  }
  return mapped;
}

function pickString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function pickWarning(payload: JsonRecord, data: JsonRecord | null): string | undefined {
  if (typeof payload.warning === 'string') return payload.warning;
  if (data && typeof data.warning === 'string') return data.warning;
  return undefined;
}

function toJsonRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function mapTerminalChatRow(value: unknown): TerminalChatRow | null {
  if (!isRecord(value)) return null;

  return {
    id: pickString(value.id),
    userId: pickString(value.userId),
    channel: pickString(value.channel),
    senderKind: pickString(value.senderKind),
    senderId: typeof value.senderId === 'string' ? value.senderId : null,
    senderName: pickString(value.senderName, 'ORCHESTRATOR'),
    message: pickString(value.message),
    meta: toJsonRecord(value.meta),
    createdAt: parseTimestampMs(value.createdAt),
  };
}

async function apiCall<T extends JsonRecord>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    signal: options?.signal ?? AbortSignal.timeout(10_000),
  });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok || !isSuccessEnvelope(payload)) {
    throw new Error(parseErrorMessage(payload, res.status));
  }
  if (!isRecord(payload)) {
    throw new Error(`Invalid API response (${res.status})`);
  }
  return payload as T;
}

// ─── Terminal Scan API ──────────────────────────────────────

/** Run a new terminal scan */
export async function runTerminalScan(
  pair = 'BTC/USDT',
  timeframe = '4h',
): Promise<RunScanResponse> {
  const payload = await apiCall<JsonRecord>('/api/terminal/scan', {
    method: 'POST',
    body: JSON.stringify({ pair, timeframe }),
  });

  const data = extractDataRecord(payload);
  if (!data) throw new Error('Malformed scan payload');

  return {
    success: true,
    scanId: pickString(payload.scanId, pickString(data.scanId, '')),
    persisted: payload.persisted === true,
    warning: pickWarning(payload, data),
    data: data as unknown as TerminalScanDetail,
  };
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
  const payload = await apiCall<JsonRecord>(`/api/terminal/scan/history?${params}`);
  const data = extractDataRecord(payload);

  const recordsSource = Array.isArray(payload.records)
    ? payload.records
    : data && Array.isArray(data.records)
      ? data.records
      : [];
  const paginationSource = isRecord(payload.pagination)
    ? payload.pagination
    : data && isRecord(data.pagination)
      ? data.pagination
      : {};

  return {
    success: true,
    records: recordsSource as TerminalScanSummary[],
    pagination: {
      limit: parseNumber(paginationSource.limit) ?? 20,
      offset: parseNumber(paginationSource.offset) ?? 0,
      total: parseNumber(paginationSource.total) ?? 0,
    },
    warning: pickWarning(payload, data),
  };
}

/** Get scan detail by ID */
export async function getScanDetail(scanId: string): Promise<ScanDetailResponse> {
  const payload = await apiCall<JsonRecord>(`/api/terminal/scan/${scanId}`);
  const data = extractDataRecord(payload);

  const recordRaw = payload.record ?? data;
  const record = isRecord(recordRaw) ? (recordRaw as TerminalScanDetail) : null;

  return {
    success: true,
    record,
    warning: pickWarning(payload, data),
  };
}

/** Get scan signals by scan ID */
export async function getScanSignals(scanId: string): Promise<ScanSignalsResponse> {
  const payload = await apiCall<JsonRecord>(`/api/terminal/scan/${scanId}/signals`);
  const data = extractDataRecord(payload);
  const records = Array.isArray(payload.records)
    ? payload.records
    : data && Array.isArray(data.records)
      ? data.records
      : [];

  return {
    success: true,
    records: records as TerminalScanSignal[],
    warning: pickWarning(payload, data),
  };
}

// ─── Market Data API ────────────────────────────────────────

/** Get market snapshot (aggregated from all sources) */
export async function getMarketSnapshot(
  pair = 'BTC/USDT',
  timeframe = '4h',
): Promise<MarketSnapshotResponse> {
  const params = new URLSearchParams();
  params.set('pair', pair);
  params.set('timeframe', timeframe);

  const payload = await apiCall<JsonRecord>(`/api/market/snapshot?${params.toString()}`);
  const data = extractDataRecord(payload) ?? payload;

  return {
    success: true,
    pair: pickString(data.pair, pair),
    timeframe: pickString(data.timeframe, timeframe),
    at: parseTimestampMs(data.at),
    sources: toBooleanMap(data.sources),
    warning: pickWarning(payload, data),
  };
}

/** Get Fear & Greed index */
export async function getFearGreed(options?: { signal?: AbortSignal }): Promise<{
  success: boolean;
  current: { value: number; classification: string } | null;
}> {
  const payload = await apiCall<JsonRecord>('/api/feargreed', { signal: options?.signal });
  const data = extractDataRecord(payload) ?? payload;
  const currentRaw = data.current;

  if (!isRecord(currentRaw)) {
    return { success: true, current: null };
  }

  const value = parseNumber(currentRaw.value);
  if (value === null) {
    return { success: true, current: null };
  }

  return {
    success: true,
    current: {
      value,
      classification: pickString(currentRaw.classification, 'unknown'),
    },
  };
}

/** Get CoinGecko global data */
export async function getCoinGeckoGlobal(options?: { signal?: AbortSignal }): Promise<{
  success: boolean;
  data: {
    btcDominance: number | null;
    ethDominance: number | null;
    totalMarketCapUsd: number | null;
    totalVolumeUsd: number | null;
    marketCapChange24hPct: number | null;
    stablecoinTotalMcapUsd: number | null;
  } | null;
}> {
  const payload = await apiCall<JsonRecord>('/api/coingecko/global', { signal: options?.signal });
  const data = extractDataRecord(payload) ?? payload;
  const global = isRecord(data.global) ? data.global : null;
  const stablecoin = isRecord(data.stablecoin) ? data.stablecoin : null;

  const btcDominance = parseNumber(data.btcDominance) ?? parseNumber(global?.btcDominance);
  const ethDominance = parseNumber(data.ethDominance) ?? parseNumber(global?.ethDominance);
  const totalMarketCapUsd = parseNumber(data.totalMarketCap) ?? parseNumber(global?.totalMarketCapUsd);
  const totalVolumeUsd = parseNumber(data.totalVolumeUsd) ?? parseNumber(global?.totalVolumeUsd);
  const marketCapChange24hPct =
    parseNumber(data.marketCapChange24hPct) ?? parseNumber(global?.marketCapChange24hPct);
  const stablecoinTotalMcapUsd =
    parseNumber(data.stablecoinTotalMcapUsd) ?? parseNumber(stablecoin?.totalMcapUsd);

  if (
    btcDominance === null
    && ethDominance === null
    && totalMarketCapUsd === null
    && totalVolumeUsd === null
    && marketCapChange24hPct === null
    && stablecoinTotalMcapUsd === null
  ) {
    return { success: true, data: null };
  }

  return {
    success: true,
    data: {
      btcDominance,
      ethDominance,
      totalMarketCapUsd,
      totalVolumeUsd,
      marketCapChange24hPct,
      stablecoinTotalMcapUsd,
    },
  };
}

export async function getTerminalLiveTicker(
  options?: { signal?: AbortSignal },
): Promise<TerminalLiveTickerSnapshot | null> {
  const [fearGreed, coingecko] = await Promise.all([
    getFearGreed(options).catch(() => ({ success: true as const, current: null })),
    getCoinGeckoGlobal(options).catch(() => ({ success: true as const, data: null })),
  ]);

  const data = coingecko.data;
  const current = fearGreed.current;
  if (!data && !current) return null;

  return {
    btcDominance: data?.btcDominance ?? null,
    ethDominance: data?.ethDominance ?? null,
    totalVolumeUsd: data?.totalVolumeUsd ?? null,
    totalMarketCapUsd: data?.totalMarketCapUsd ?? null,
    marketCapChange24hPct: data?.marketCapChange24hPct ?? null,
    fearGreedValue: current?.value ?? null,
    fearGreedClassification: current?.classification ?? null,
    stablecoinTotalMcapUsd: data?.stablecoinTotalMcapUsd ?? null,
  };
}

export async function sendTerminalChatMessage(input: {
  channel: string;
  senderKind: string;
  senderName: string;
  message: string;
  meta?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<TerminalChatResponse> {
  const res = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: input.channel,
      senderKind: input.senderKind,
      senderName: input.senderName,
      message: input.message,
      meta: input.meta ?? {},
    }),
    signal: input.signal ?? AbortSignal.timeout(20_000),
  });

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok || !isSuccessEnvelope(payload)) {
    throw new TerminalApiError(parseErrorMessage(payload, res.status), res.status);
  }

  if (!isRecord(payload)) {
    throw new TerminalApiError(`Invalid API response (${res.status})`, res.status);
  }

  return {
    success: true,
    message: mapTerminalChatRow(payload.message),
    agentResponse: mapTerminalChatRow(payload.agentResponse),
  };
}

/** Get Yahoo Finance data for a symbol */
export async function getYahooData(symbol: string): Promise<{
  success: boolean;
  symbol: string;
  points: Array<{ timestampMs: number; close: number }>;
}> {
  const payload = await apiCall<JsonRecord>(`/api/yahoo/${encodeURIComponent(symbol)}`);
  const data = extractDataRecord(payload) ?? payload;
  const pointsRaw = Array.isArray(data.points) ? data.points : [];
  const points: Array<{ timestampMs: number; close: number }> = [];

  for (const row of pointsRaw) {
    if (!isRecord(row)) continue;
    const timestampMs = parseNumber(row.timestampMs);
    const close = parseNumber(row.close);
    if (timestampMs === null || close === null) continue;
    points.push({ timestampMs, close });
  }

  return {
    success: true,
    symbol: pickString(data.symbol, symbol),
    points,
  };
}
