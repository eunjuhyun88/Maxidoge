import { LINE_ENTRY_DEFAULT_RR } from '$lib/chart/chartIndicators';

export function sanitizeRewardRatio(rr: number | null | undefined): number {
  return Number.isFinite(rr) && rr! > 0 ? rr! : LINE_ENTRY_DEFAULT_RR;
}

export function computeRiskPercent(entry: number, sl: number): number {
  const risk = Math.abs(entry - sl);
  return (risk / Math.max(Math.abs(entry), 1)) * 100;
}
