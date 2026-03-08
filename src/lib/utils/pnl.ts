// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — PnL Calculation Utility (Single Source of Truth)
// Used by: quickTradeStore, positionStore, close/+server.ts
// ═══════════════════════════════════════════════════════════════

export type PnlDirection = 'LONG' | 'SHORT';

/**
 * Calculate unrealized PnL percentage for a trade.
 * @param dir    - Trade direction ('LONG' | 'SHORT')
 * @param entry  - Entry price
 * @param current - Current / close price
 * @param decimals - Decimal places to round to (default: 2)
 * @returns PnL percentage (positive = profit, negative = loss)
 */
export function calcPnlPercent(
  dir: PnlDirection,
  entry: number,
  current: number,
  decimals: number = 2
): number {
  if (entry <= 0) return 0;
  const raw = dir === 'LONG'
    ? ((current - entry) / entry) * 100
    : ((entry - current) / entry) * 100;
  return +raw.toFixed(decimals);
}

/**
 * Calculate ROE (Return on Equity) percentage with leverage.
 * @param dir       - Trade direction
 * @param entry     - Entry price
 * @param current   - Current price
 * @param leverage  - Leverage multiplier (default: 1)
 * @returns ROE percentage
 */
export function calcRoePercent(
  dir: PnlDirection,
  entry: number,
  current: number,
  leverage: number = 1
): number {
  if (entry <= 0 || leverage <= 0) return 0;
  const pnl = calcPnlPercent(dir, entry, current, 8);
  return +(pnl * leverage).toFixed(2);
}

/**
 * Calculate liquidation price (simplified, no funding/fees).
 * @param dir       - Trade direction
 * @param entry     - Entry price
 * @param leverage  - Leverage multiplier
 * @returns Estimated liquidation price
 */
export function calcLiquidationPrice(
  dir: PnlDirection,
  entry: number,
  leverage: number
): number {
  if (entry <= 0 || leverage <= 0) return 0;
  if (dir === 'LONG') {
    return +(entry * (1 - 1 / leverage)).toFixed(8);
  }
  return +(entry * (1 + 1 / leverage)).toFixed(8);
}
