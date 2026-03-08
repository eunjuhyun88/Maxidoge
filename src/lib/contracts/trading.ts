export type TradeDirection = 'LONG' | 'SHORT';
export type QuickTradeStatus = 'open' | 'closed' | 'stopped';
export type TrackedSignalStatus = 'tracking' | 'expired' | 'converted';

export interface QuickTrade {
  id: string;
  userId?: string | null;
  pair: string;
  dir: TradeDirection;
  entry: number;
  tp: number | null;
  sl: number | null;
  currentPrice: number;
  pnlPercent: number;
  status: QuickTradeStatus;
  openedAt: number;
  closedAt: number | null;
  closePnl: number | null;
  source: string;
  note: string;
}

export interface TrackedSignal {
  id: string;
  userId?: string | null;
  pair: string;
  dir: TradeDirection;
  confidence: number;
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  status: TrackedSignalStatus;
  source: string;
  note: string;
  trackedAt: number;
  expiresAt: number;
  clientMutationId?: string | null;
}

export interface CopyTradeRun {
  id: string;
  userId: string;
  selectedSignalIds: string[];
  draft: Record<string, unknown>;
  published: boolean;
  publishedTradeId: string | null;
  publishedSignalId: string | null;
  createdAt: number;
  publishedAt: number | null;
}

export interface QuickTradeListParams {
  limit?: number;
  offset?: number;
  status?: QuickTradeStatus;
}

export interface TrackedSignalListParams {
  limit?: number;
  offset?: number;
  status?: TrackedSignalStatus;
}

export interface QuickTradeListData {
  total: number;
  records: QuickTrade[];
  pagination?: {
    limit: number;
    offset: number;
  };
}

export interface TrackedSignalListData {
  total: number;
  records: TrackedSignal[];
  pagination?: {
    limit: number;
    offset: number;
  };
}

export interface OpenQuickTradeRequest {
  pair: string;
  dir: TradeDirection;
  entry: number;
  tp: number | null;
  sl: number | null;
  currentPrice: number;
  source: string;
  note: string;
}

export interface CloseQuickTradeRequest {
  closePrice: number;
  status?: Extract<QuickTradeStatus, 'closed' | 'stopped'>;
}

export interface QuickTradePriceUpdateItem {
  id: string;
  currentPrice: number;
}

export interface UpdateQuickTradePricesRequest {
  prices?: Record<string, number>;
  updates?: QuickTradePriceUpdateItem[];
}

export interface UpdateQuickTradePricesData {
  updated: number;
}

export interface TrackSignalRequest {
  pair: string;
  dir: TradeDirection;
  confidence: number;
  entryPrice: number;
  currentPrice: number;
  source: string;
  note: string;
  ttlHours?: number;
  clientMutationId?: string;
}

export interface ConvertSignalRequest {
  entry?: number;
  tp?: number | null;
  sl?: number | null;
  note?: string;
}

export interface UntrackSignalData {
  signalId: string;
  status: Extract<TrackedSignalStatus, 'expired'>;
}

export interface CopyTradeEvidenceItem {
  icon: string;
  name: string;
  text: string;
  conf: number;
  color: string;
}

export interface PublishCopyTradeDraft {
  pair: string;
  dir: TradeDirection;
  entry: number;
  tp: number[];
  sl: number;
  orderType?: string;
  leverage?: number;
  sizePercent?: number;
  marginMode?: string;
  evidence?: CopyTradeEvidenceItem[];
  note?: string;
  source?: string;
}

export interface PublishCopyTradeRequest {
  selectedSignalIds: string[];
  draft: PublishCopyTradeDraft;
  confidence?: number;
  clientMutationId?: string;
}

export interface PublishCopyTradeData {
  run: CopyTradeRun;
  trade: QuickTrade;
  signal: TrackedSignal;
  reused?: boolean;
}
