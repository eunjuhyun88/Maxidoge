// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Position Sizer Engine
// ═══════════════════════════════════════════════════════════════
// Risk-based position sizing: Fixed Fractional / ATR / Kelly
// Pure calculation — no API calls, no side effects.

export type SizingMethod = 'fixed_fractional' | 'atr' | 'kelly';

export interface PositionSizeInput {
  method: SizingMethod;
  accountSize: number;       // Total account equity (USD)
  entry: number;             // Entry price
  stop: number;              // Stop-loss price
  takeProfit?: number;       // Optional take-profit price for RR calculation
  riskPct?: number;          // Risk per trade (default 1%)
  atr?: number;              // ATR value (for ATR method)
  atrMultiplier?: number;    // ATR stop multiplier (default 2.0)
  winRate?: number;          // Historical win rate (Kelly: 0-1)
  avgWin?: number;           // Average win size (Kelly)
  avgLoss?: number;          // Average loss size (Kelly)
  maxPositionPct?: number;   // Max position as % of account (default 25%)
  leverageMax?: number;      // Max leverage allowed (default 10)
}

export type PositionSizeWarningCode =
  | 'invalid_account_size'
  | 'invalid_entry_price'
  | 'invalid_stop_distance'
  | 'kelly_no_edge'
  | 'position_cap'
  | 'leverage_cap'
  | 'high_leverage'
  | 'tight_stop'
  | 'wide_stop';

export interface PositionSizeWarning {
  code: PositionSizeWarningCode;
  maxPositionPct?: number;
  maxPositionValue?: number;
  leverageMax?: number;
}

export interface PositionSizeResult {
  method: SizingMethod;
  quantity: number;          // Recommended quantity (contracts/coins)
  positionValue: number;     // Total position value (USD)
  riskAmount: number;        // Dollar risk per trade
  riskPct: number;           // Actual risk percentage
  stopDistance: number;       // Price distance to stop
  stopDistancePct: number;   // Stop distance as %
  rr: number;                // Risk:Reward ratio (if TP provided)
  leverage: number;          // Effective leverage
  marginRequired: number;    // Margin needed (positionValue / leverageMax)
  warnings: PositionSizeWarning[]; // Structured risk warnings
}

const DEFAULTS = {
  riskPct: 1,
  atrMultiplier: 2.0,
  maxPositionPct: 25,
  leverageMax: 10,
} as const;

/**
 * Core position sizing calculator.
 * Returns quantity, risk metrics, and warnings.
 */
export function calculatePositionSize(input: PositionSizeInput): PositionSizeResult {
  const warnings: PositionSizeWarning[] = [];
  const riskPct = input.riskPct ?? DEFAULTS.riskPct;
  const maxPosPct = input.maxPositionPct ?? DEFAULTS.maxPositionPct;
  const levMax = input.leverageMax ?? DEFAULTS.leverageMax;

  // ── Validate inputs ──
  if (input.accountSize <= 0) {
    return emptyResult('fixed_fractional', [{ code: 'invalid_account_size' }]);
  }
  if (input.entry <= 0) {
    return emptyResult('fixed_fractional', [{ code: 'invalid_entry_price' }]);
  }

  // ── Calculate stop distance ──
  let stopDistance: number;

  if (input.method === 'atr' && input.atr && input.atr > 0) {
    const mult = input.atrMultiplier ?? DEFAULTS.atrMultiplier;
    stopDistance = input.atr * mult;
  } else {
    stopDistance = Math.abs(input.entry - input.stop);
  }

  if (stopDistance <= 0 || !Number.isFinite(stopDistance)) {
    return emptyResult(input.method, [{ code: 'invalid_stop_distance' }]);
  }

  const stopDistancePct = (stopDistance / input.entry) * 100;

  // ── Determine risk amount ──
  let effectiveRiskPct = riskPct;

  if (input.method === 'kelly' && input.winRate != null && input.avgWin != null && input.avgLoss != null) {
    const kelly = kellyFraction(input.winRate, input.avgWin, input.avgLoss);
    // Half-Kelly for safety
    effectiveRiskPct = Math.min(kelly * 100 * 0.5, riskPct * 3);
    if (effectiveRiskPct <= 0) {
      warnings.push({ code: 'kelly_no_edge' });
      effectiveRiskPct = riskPct;
    }
  }

  const riskAmount = input.accountSize * (effectiveRiskPct / 100);

  // ── Calculate quantity ──
  let quantity = riskAmount / stopDistance;

  // ── Apply position limits ──
  const positionValue = quantity * input.entry;
  const maxPosValue = input.accountSize * (maxPosPct / 100);

  if (positionValue > maxPosValue) {
    quantity = maxPosValue / input.entry;
    warnings.push({
      code: 'position_cap',
      maxPositionPct: maxPosPct,
      maxPositionValue: maxPosValue,
    });
  }

  // ── Leverage check ──
  const finalPosValue = quantity * input.entry;
  const leverage = finalPosValue / input.accountSize;

  if (leverage > levMax) {
    quantity = (input.accountSize * levMax) / input.entry;
    warnings.push({
      code: 'leverage_cap',
      leverageMax: levMax,
    });
  }

  if (leverage > 5) {
    warnings.push({ code: 'high_leverage' });
  }

  if (stopDistancePct < 0.3) {
    warnings.push({ code: 'tight_stop' });
  }

  if (stopDistancePct > 10) {
    warnings.push({ code: 'wide_stop' });
  }

  // ── Round quantity ──
  quantity = Math.max(0, quantity);
  const normalizedPositionValue = quantity * input.entry;
  const normalizedStopRisk = quantity * stopDistance;

  return {
    method: input.method,
    quantity,
    positionValue: normalizedPositionValue,
    riskAmount: normalizedStopRisk,
    riskPct: effectiveRiskPct,
    stopDistance,
    stopDistancePct,
    rr: calculateRiskReward(input.entry, input.stop, input.takeProfit),
    leverage: normalizedPositionValue / Math.max(input.accountSize, 1),
    marginRequired: normalizedPositionValue / levMax,
    warnings,
  };
}

/**
 * Kelly Criterion: f* = (bp - q) / b
 * where b = avgWin/avgLoss, p = winRate, q = 1-p
 */
export function kellyFraction(winRate: number, avgWin: number, avgLoss: number): number {
  if (avgLoss <= 0 || winRate <= 0 || winRate >= 1) return 0;
  const b = avgWin / avgLoss;
  const p = winRate;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return Math.max(0, f);
}

/**
 * Quick position size from entry/stop/account.
 * Most common use case — fixed fractional 1%.
 */
export function quickSize(
  accountSize: number,
  entry: number,
  stop: number,
  riskPct = 1,
): PositionSizeResult {
  return calculatePositionSize({
    method: 'fixed_fractional',
    accountSize,
    entry,
    stop,
    riskPct,
  });
}

/**
 * Format quantity for display (crypto precision).
 */
export function formatQuantity(qty: number, price: number): string {
  if (price >= 10000) return qty.toFixed(4);    // BTC
  if (price >= 100) return qty.toFixed(3);       // ETH, SOL
  if (price >= 1) return qty.toFixed(2);         // Mid-caps
  return qty.toFixed(0);                         // Low-cap tokens
}

export function formatPositionSizeWarning(warning: PositionSizeWarning): string {
  switch (warning.code) {
    case 'invalid_account_size':
      return 'Account size must be greater than 0.';
    case 'invalid_entry_price':
      return 'Entry price must be greater than 0.';
    case 'invalid_stop_distance':
      return 'Stop distance must be greater than 0. Check that entry and stop differ.';
    case 'kelly_no_edge':
      return 'Kelly sizing found no edge. Falling back to fixed risk.';
    case 'position_cap':
      return `Position capped at ${warning.maxPositionPct ?? DEFAULTS.maxPositionPct}% of account ($${Math.round(warning.maxPositionValue ?? 0)})`;
    case 'leverage_cap':
      return `Leverage capped at ${warning.leverageMax ?? DEFAULTS.leverageMax}x.`;
    case 'high_leverage':
      return 'High leverage. Consider reducing position size.';
    case 'tight_stop':
      return 'Very tight stop. Premature stop-out risk is elevated.';
    case 'wide_stop':
      return 'Wide stop. Potential loss per trade is elevated.';
  }
}

function calculateRiskReward(entry: number, stop: number, takeProfit?: number): number {
  if (!takeProfit || takeProfit <= 0) return 0;
  const reward = Math.abs(takeProfit - entry);
  const risk = Math.abs(entry - stop);
  if (risk <= 0 || !Number.isFinite(reward)) return 0;
  return reward / risk;
}

function emptyResult(method: SizingMethod, warnings: PositionSizeWarning[]): PositionSizeResult {
  return {
    method,
    quantity: 0,
    positionValue: 0,
    riskAmount: 0,
    riskPct: 0,
    stopDistance: 0,
    stopDistancePct: 0,
    rr: 0,
    leverage: 0,
    marginRequired: 0,
    warnings,
  };
}
