import type { QuickTrade, QuickTradeStatus, TradeDirection } from '$lib/contracts/trading';

export interface QuickTradeRow {
  id: string;
  user_id?: string | null;
  pair: string;
  dir: TradeDirection;
  entry: number | string;
  tp: number | string | null;
  sl: number | string | null;
  current_price: number | string;
  pnl_percent: number | string | null;
  status: QuickTradeStatus;
  source: string | null;
  note: string | null;
  opened_at: string | Date;
  closed_at: string | Date | null;
  close_pnl: number | string | null;
}

export function mapQuickTradeRow(
  row: QuickTradeRow,
  options: { defaultSource?: string } = {},
): QuickTrade {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    pair: row.pair,
    dir: row.dir,
    entry: Number(row.entry),
    tp: row.tp == null ? null : Number(row.tp),
    sl: row.sl == null ? null : Number(row.sl),
    currentPrice: Number(row.current_price),
    pnlPercent: Number(row.pnl_percent ?? 0),
    status: row.status,
    source: row.source || options.defaultSource || 'manual',
    note: row.note || '',
    openedAt: new Date(row.opened_at).getTime(),
    closedAt: row.closed_at ? new Date(row.closed_at).getTime() : null,
    closePnl: row.close_pnl == null ? null : Number(row.close_pnl),
  };
}
