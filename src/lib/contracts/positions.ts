export interface Eip712TypedDataField {
  name: string;
  type: string;
}

export interface Eip712TypedData {
  types: Record<string, Eip712TypedDataField[]>;
  primaryType: string;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  message: Record<string, unknown>;
}

export type UnifiedPositionType = 'quick_trade' | 'polymarket' | 'gmx';
export type UnifiedPositionsFilter = 'all' | UnifiedPositionType;
export type PolymarketDirection = 'YES' | 'NO';

export interface UnifiedPosition {
  id: string;
  type: UnifiedPositionType;
  asset: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  pnlUsdc: number | null;
  amountUsdc: number | null;
  status: string;
  openedAt: number;
  meta: Record<string, unknown>;
}

export interface UnifiedPositionsParams {
  type?: UnifiedPositionsFilter;
  limit?: number;
}

export interface UnifiedPositionsData {
  ok: boolean;
  positions: UnifiedPosition[];
  total: number;
}

export interface PolymarketPosition {
  id: string;
  marketId: string;
  marketTitle: string;
  marketSlug: string;
  tokenId: string;
  direction: PolymarketDirection;
  side: string;
  price: number;
  size: number;
  amountUsdc: number;
  clobOrderId: string | null;
  orderStatus: string | null;
  filledSize: number;
  avgFillPrice: number | null;
  currentPrice: number | null;
  pnlUsdc: number | null;
  settled: boolean;
  walletAddress: string | null;
  createdAt: number;
}

export interface PolymarketPositionsParams {
  settled?: boolean;
  limit?: number;
  offset?: number;
}

export interface PolymarketPositionsData {
  ok: boolean;
  positions: PolymarketPosition[];
  total: number;
}

export interface PolymarketPositionStatusData {
  ok: boolean;
  position: PolymarketPosition;
}

export interface PolymarketAuthData {
  ok: boolean;
  typedData?: Eip712TypedData;
  timestamp?: number;
  nonce?: number;
  authenticated?: boolean;
  error?: string;
}

export interface SubmitPolymarketAuthRequest {
  walletAddress: string;
  signature: string;
  timestamp: number;
  nonce?: number;
}

export interface PolymarketOrderParams {
  tokenId: string;
  side: string;
  price: number;
  size: number;
  salt: string;
  nonce: string;
  expiration: string;
  feeRateBps: number;
}

export interface PreparePolymarketOrderRequest {
  marketId: string;
  direction: PolymarketDirection;
  price: number;
  amount: number;
  walletAddress: string;
}

export interface PreparePolymarketOrderData {
  ok: boolean;
  positionId: string;
  typedData: Eip712TypedData;
  orderParams: PolymarketOrderParams;
}

export interface SubmitPolymarketOrderRequest {
  positionId: string;
  signature: string;
}

export interface SubmitPolymarketOrderData {
  ok: boolean;
  clobOrderId: string;
  orderStatus: string;
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  source: string;
  createdAt?: number;
  updatedAt: number;
}

export interface PortfolioHoldingsSnapshot {
  holdings: PortfolioHolding[];
  totalValue: number;
  totalCost: number;
}

export interface PortfolioHoldingsData {
  ok: boolean;
  data: PortfolioHoldingsSnapshot;
}

export interface UpsertPortfolioHoldingRequest {
  symbol: string;
  name: string;
  amount: number;
  avgPrice: number;
  currentPrice?: number;
  source?: string;
}

export interface UpsertPortfolioHoldingData {
  ok: boolean;
  holding: PortfolioHolding;
}
