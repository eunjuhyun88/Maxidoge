import { clampRoundPrice } from '$lib/chart/chartCoordinates';
import { clampRatio } from '$lib/chart/chartHelpers';
import { computeRiskPercent, sanitizeRewardRatio } from '$lib/chart/chartTradePlannerMath';
import type {
  LineEntryTradeDraft,
  PlannedTradeOrder,
  TradePlanDraft,
  TradePreviewData,
} from '$lib/chart/chartTypes';

export function buildLineEntryTradeDraft(options: {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  stopHint: number;
  rr?: number;
}): LineEntryTradeDraft | null {
  const pair = options.pair || 'BTC/USDT';
  const dir = options.dir;
  const entry = clampRoundPrice(options.entry);
  let sl = clampRoundPrice(options.stopHint);
  if (dir === 'LONG' && sl >= entry) sl = clampRoundPrice(entry * 0.995);
  if (dir === 'SHORT' && sl <= entry) sl = clampRoundPrice(entry * 1.005);

  const risk = Math.abs(entry - sl);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(risk) || risk <= 0) return null;

  const rr = sanitizeRewardRatio(options.rr);
  const tp = clampRoundPrice(dir === 'LONG' ? entry + risk * rr : entry - risk * rr);
  if (!Number.isFinite(tp) || tp <= 0) return null;

  return { pair, dir, entry, sl, tp, rr };
}

export function buildTradePlanDraftFromPreview(
  preview: Pick<TradePreviewData, 'dir' | 'entry' | 'sl' | 'tp' | 'rr' | 'riskPct'>,
  pair: string,
): TradePlanDraft {
  const entry = clampRoundPrice(preview.entry);
  const sl = clampRoundPrice(preview.sl);
  return {
    pair: pair || 'BTC/USDT',
    previewDir: preview.dir,
    entry,
    sl,
    tp: clampRoundPrice(preview.tp),
    rr: sanitizeRewardRatio(preview.rr),
    riskPct: Number.isFinite(preview.riskPct) && preview.riskPct > 0
      ? preview.riskPct
      : computeRiskPercent(entry, sl),
    longRatio: preview.dir === 'LONG' ? 70 : 30,
  };
}

export function withTradePlanRatio(plan: TradePlanDraft, nextLongRatio: number): TradePlanDraft {
  const longRatio = clampRatio(nextLongRatio);
  if (plan.longRatio === longRatio) return plan;
  return { ...plan, longRatio };
}

export function getPlannedTradeOrder(plan: TradePlanDraft): PlannedTradeOrder {
  const dir: 'LONG' | 'SHORT' = plan.longRatio >= 50 ? 'LONG' : 'SHORT';
  const rr = sanitizeRewardRatio(plan.rr);
  const risk = Math.max(Math.abs(plan.entry - plan.sl), Math.max(0.0001, Math.abs(plan.entry) * 0.001));
  const entry = clampRoundPrice(plan.entry);
  const sl = clampRoundPrice(dir === 'LONG' ? entry - risk : entry + risk);
  const tp = clampRoundPrice(dir === 'LONG' ? entry + risk * rr : entry - risk * rr);
  return {
    pair: plan.pair,
    dir,
    entry,
    sl,
    tp,
    rr,
    riskPct: computeRiskPercent(entry, sl),
    longRatio: clampRatio(plan.longRatio),
    shortRatio: 100 - clampRatio(plan.longRatio),
  };
}
