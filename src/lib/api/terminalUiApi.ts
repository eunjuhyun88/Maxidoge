// UI-facing API wrapper for Terminal and Intel panels.
// Keeps network and response parsing outside Svelte components.

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

async function requestJson<T>(url: string, init?: RequestInit, timeoutMs = 10000): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : `API error ${response.status}`;
    throw new Error(message);
  }

  if (!isRecord(payload)) {
    throw new Error('Invalid API response');
  }

  return payload as T;
}

export interface FearGreedApiPayload {
  ok?: boolean;
  success?: boolean;
  data?: {
    current?: {
      value?: number;
      classification?: string;
    };
  };
}

export interface CoinGeckoGlobalApiPayload {
  ok?: boolean;
  success?: boolean;
  data?: {
    global?: {
      btcDominance?: number;
      ethDominance?: number;
      totalVolumeUsd?: number;
      totalMarketCapUsd?: number;
      marketCapChange24hPct?: number;
    };
    stablecoin?: {
      totalMcapUsd?: number;
    } | null;
  };
}

export async function fetchLiveTickerSources(): Promise<{
  fearGreed: FearGreedApiPayload | null;
  coinGecko: CoinGeckoGlobalApiPayload | null;
}> {
  const [fearGreed, coinGecko] = await Promise.all([
    requestJson<FearGreedApiPayload>('/api/feargreed?limit=1', undefined, 5000).catch(() => null),
    requestJson<CoinGeckoGlobalApiPayload>('/api/coingecko/global', undefined, 5000).catch(() => null),
  ]);

  return { fearGreed, coinGecko };
}

export interface TerminalChatMessageRequest {
  channel: 'terminal';
  senderKind: 'user';
  senderName: string;
  message: string;
  meta: {
    pair: string;
    timeframe: string;
    mentionedAgent?: string;
    livePrices: Record<string, number>;
  };
}

export interface TerminalChatMessageResponse {
  success: boolean;
  agentResponse?: {
    senderName: string;
    message: string;
  } | null;
}

export async function postTerminalChatMessage(
  payload: TerminalChatMessageRequest,
): Promise<TerminalChatMessageResponse> {
  return requestJson<TerminalChatMessageResponse>(
    '/api/chat/messages',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    15000,
  );
}

export interface MarketNewsFeedResponse {
  ok?: boolean;
  data?: {
    records?: Array<{
      sentiment?: 'bullish' | 'bearish' | 'neutral';
      publishedAt?: number;
      title?: string;
      summary?: string;
      link?: string;
      interactions?: number;
      importance?: number;
      network?: string;
      creator?: string;
      source?: string;
    }>;
    offset?: number;
    hasMore?: boolean;
  };
}

export async function fetchMarketNewsFeed(params: {
  limit: number;
  offset: number;
  token: string;
  sort: 'importance' | 'time';
  interval?: string;
}): Promise<MarketNewsFeedResponse> {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    token: params.token,
    sort: params.sort,
    interval: params.interval ?? '1m',
  });

  return requestJson<MarketNewsFeedResponse>(`/api/market/news?${query.toString()}`, undefined, 12000);
}

export interface MarketEventsFeedResponse {
  ok?: boolean;
  data?: {
    records?: Array<{
      id?: string;
      tag?: string;
      level?: string;
      text?: string;
      source?: string;
      createdAt?: number;
    }>;
  };
}

export async function fetchMarketEventsFeed(pair: string): Promise<MarketEventsFeedResponse> {
  const query = new URLSearchParams({ pair });
  return requestJson<MarketEventsFeedResponse>(`/api/market/events?${query.toString()}`);
}

export interface MarketFlowFeedResponse {
  ok?: boolean;
  data?: {
    pair?: string;
    snapshot?: {
      funding?: number | null;
      liqLong24h?: number | null;
      liqShort24h?: number | null;
      quoteVolume24h?: number | null;
      priceChangePct?: number | null;
    };
  };
}

export async function fetchMarketFlowFeed(pair: string): Promise<MarketFlowFeedResponse> {
  const query = new URLSearchParams({ pair });
  return requestJson<MarketFlowFeedResponse>(`/api/market/flow?${query.toString()}`);
}

export interface MarketTrendingFeedResponse {
  ok?: boolean;
  data?: {
    trending?: Array<Record<string, unknown>>;
    gainers?: Array<Record<string, unknown>>;
    losers?: Array<Record<string, unknown>>;
    dexHot?: Array<Record<string, unknown>>;
  };
}

export async function fetchMarketTrendingFeed(limit = 15): Promise<MarketTrendingFeedResponse> {
  const query = new URLSearchParams({ section: 'all', limit: String(limit) });
  return requestJson<MarketTrendingFeedResponse>(`/api/market/trending?${query.toString()}`);
}

export interface OpportunityScanFeedResponse {
  ok?: boolean;
  data?: {
    coins?: Array<Record<string, unknown>>;
    alerts?: Array<Record<string, unknown>>;
    macroBackdrop?: {
      regime?: string;
    };
    scanDurationMs?: number;
  };
}

export async function fetchOpportunityScanFeed(limit = 15): Promise<OpportunityScanFeedResponse> {
  const query = new URLSearchParams({ limit: String(limit) });
  return requestJson<OpportunityScanFeedResponse>(`/api/terminal/opportunity-scan?${query.toString()}`, undefined, 15000);
}
