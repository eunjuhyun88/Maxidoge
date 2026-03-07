import type {
  DexHot,
  GainerLoser,
  HeadlineSort,
  LiveEventItem,
  OnchainData,
  OpAlert,
  OpScore,
  ShadowDecision,
  ShadowRuntime,
  TrendingCoin,
} from '$lib/terminal/intel/intelTypes';

type JsonRecord = Record<string, unknown>;

export interface IntelNewsRecord {
  sentiment: string;
  publishedAt: string;
  title: string;
  summary: string;
  link: string;
  interactions: number;
  importance: number;
  network: string;
  creator: string;
  source: string;
}

export interface IntelNewsPage {
  records: IntelNewsRecord[];
  offset: number;
  hasMore: boolean;
}

export interface IntelFlowRecord {
  id: string;
  agent?: string;
  pair?: string;
  text?: string;
  vote?: string;
  source?: string;
}

export interface IntelFlowSnapshot {
  funding?: number | null;
  lsRatio?: number | null;
  liqLong24h?: number | null;
  liqShort24h?: number | null;
  quoteVolume24h?: number | null;
  priceChangePct?: number | null;
  cmcMarketCap?: number | null;
  cmcChange24hPct?: number | null;
}

export interface IntelFlowApiPayload {
  pair: string;
  snapshot: IntelFlowSnapshot;
  records: IntelFlowRecord[];
}

export interface IntelTrendingPayload {
  trending: TrendingCoin[];
  gainers: GainerLoser[];
  losers: GainerLoser[];
  dexHot: DexHot[];
  updatedAt: number;
}

export interface IntelOpportunityPayload {
  coins: OpScore[];
  alerts: OpAlert[];
  macroBackdrop?: { regime?: string };
  scanDurationMs?: number;
}

export interface IntelShadowPolicyPayload {
  policy: unknown;
  shadow: ShadowDecision | null;
  llm: ShadowRuntime | null;
  executionEnabled: boolean;
}

export interface IntelShadowTradeExecutionResponse {
  ok: true;
  data?: {
    dir?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function canUseBrowserFetch(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

async function fetchEnvelope(url: string, init?: RequestInit): Promise<JsonRecord | null> {
  if (!canUseBrowserFetch()) return null;
  try {
    const response = await fetch(url, {
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function readData(payload: JsonRecord | null): JsonRecord | null {
  return payload && isRecord(payload.data) ? payload.data : null;
}

function parseErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  return `Request failed (${status})`;
}

export async function fetchIntelOnchainApi(): Promise<OnchainData | null> {
  const payload = await fetchEnvelope('/api/market/alerts/onchain', {
    signal: AbortSignal.timeout(12_000),
  });
  const data = readData(payload);
  return data ? (data as unknown as OnchainData) : null;
}

export async function fetchIntelNewsPageApi(params: {
  token: string;
  limit?: number;
  offset?: number;
  sort?: HeadlineSort;
  interval?: string;
}): Promise<IntelNewsPage | null> {
  const search = new URLSearchParams({
    token: params.token,
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
    sort: params.sort ?? 'importance',
    interval: params.interval ?? '1m',
  });
  const payload = await fetchEnvelope(`/api/market/news?${search.toString()}`);
  const data = readData(payload);
  if (!data) return null;

  return {
    records: Array.isArray(data.records) ? (data.records as IntelNewsRecord[]) : [],
    offset: typeof data.offset === 'number' ? data.offset : Number(data.offset ?? 0),
    hasMore: Boolean(data.hasMore),
  };
}

export async function fetchIntelEventsApi(pair: string): Promise<LiveEventItem[] | null> {
  const payload = await fetchEnvelope(`/api/market/events?pair=${encodeURIComponent(pair)}`);
  const data = readData(payload);
  if (!data) return null;
  return Array.isArray(data.records) ? (data.records as LiveEventItem[]) : [];
}

export async function fetchIntelFlowApi(pair: string): Promise<IntelFlowApiPayload | null> {
  const payload = await fetchEnvelope(`/api/market/flow?pair=${encodeURIComponent(pair)}`);
  const data = readData(payload);
  if (!data) return null;

  return {
    pair: typeof data.pair === 'string' ? data.pair : pair,
    snapshot: isRecord(data.snapshot) ? (data.snapshot as IntelFlowSnapshot) : {},
    records: Array.isArray(data.records) ? (data.records as IntelFlowRecord[]) : [],
  };
}

export async function fetchIntelTrendingApi(limit = 15): Promise<IntelTrendingPayload | null> {
  const payload = await fetchEnvelope(`/api/market/trending?section=all&limit=${limit}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const data = readData(payload);
  if (!data) return null;

  return {
    trending: Array.isArray(data.trending) ? (data.trending as TrendingCoin[]) : [],
    gainers: Array.isArray(data.gainers) ? (data.gainers as GainerLoser[]) : [],
    losers: Array.isArray(data.losers) ? (data.losers as GainerLoser[]) : [],
    dexHot: Array.isArray(data.dexHot) ? (data.dexHot as DexHot[]) : [],
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Number(data.updatedAt ?? Date.now()),
  };
}

export async function fetchIntelOpportunityScanApi(limit = 15): Promise<IntelOpportunityPayload | null> {
  const payload = await fetchEnvelope(`/api/terminal/opportunity-scan?limit=${limit}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = readData(payload);
  if (!data) return null;

  return {
    coins: Array.isArray(data.coins) ? (data.coins as OpScore[]) : [],
    alerts: Array.isArray(data.alerts) ? (data.alerts as OpAlert[]) : [],
    macroBackdrop: isRecord(data.macroBackdrop)
      ? { regime: typeof data.macroBackdrop.regime === 'string' ? data.macroBackdrop.regime : undefined }
      : undefined,
    scanDurationMs: typeof data.scanDurationMs === 'number'
      ? data.scanDurationMs
      : Number(data.scanDurationMs ?? 0),
  };
}

export async function fetchIntelShadowPolicyApi(
  pair: string,
  timeframe: string,
): Promise<IntelShadowPolicyPayload | null> {
  const query = new URLSearchParams({ pair, timeframe });
  const payload = await fetchEnvelope(`/api/terminal/intel-agent-shadow?${query.toString()}`);
  const data = readData(payload);
  if (!data) return null;

  return {
    policy: data.policy ?? null,
    shadow: (data.shadow ?? null) as ShadowDecision | null,
    llm: (data.llm ?? null) as ShadowRuntime | null,
    executionEnabled: Boolean(isRecord(data.execution) ? data.execution.enabled : false),
  };
}

export async function fetchIntelPolicyApi(pair: string, timeframe: string): Promise<unknown | null> {
  const query = new URLSearchParams({ pair, timeframe });
  const payload = await fetchEnvelope(`/api/terminal/intel-policy?${query.toString()}`);
  const data = readData(payload);
  return data ?? null;
}

export async function executeIntelShadowTradeApi(payload: {
  pair: string;
  timeframe: string;
  currentPrice: number;
  entry: number;
  refresh: boolean;
}): Promise<IntelShadowTradeExecutionResponse> {
  if (!canUseBrowserFetch()) {
    throw new Error('Browser fetch unavailable');
  }

  const response = await fetch('/api/terminal/intel-agent-shadow/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const result: unknown = await response.json().catch(() => null);

  if (!response.ok || !isRecord(result) || result.ok !== true) {
    throw new Error(parseErrorMessage(result, response.status));
  }

  return result as IntelShadowTradeExecutionResponse;
}
