import { clampRoundPrice } from '$lib/chart/chartCoordinates';
import type { AgentTradeSetup, CommunitySignalDraft } from '$lib/chart/chartTypes';
import { sanitizeRewardRatio } from '$lib/chart/chartTradePlannerMath';
import { normalizeTimeframe } from '$lib/utils/timeframe';

function clampSignalConfidence(value: number, fallback = 68): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function buildCommunitySignalDraft(options: {
  pair: string;
  dir: 'LONG' | 'SHORT';
  livePrice: number;
  activeTradeSetup: AgentTradeSetup | null;
  timeframe: string;
  chatTradeReady: boolean;
  chatTradeDir: 'LONG' | 'SHORT';
}): CommunitySignalDraft | null {
  const pair = options.pair || 'BTC/USDT';
  const setup = options.activeTradeSetup
    && options.activeTradeSetup.dir === options.dir
    && options.activeTradeSetup.pair === pair
      ? options.activeTradeSetup
      : null;
  const liveEntry = Number.isFinite(options.livePrice) && options.livePrice > 0 ? options.livePrice : null;
  const entry = clampRoundPrice(setup?.entry ?? liveEntry ?? 0);
  if (!Number.isFinite(entry) || entry <= 0) return null;

  const rr = sanitizeRewardRatio(setup?.rr);
  let risk = setup ? Math.abs(setup.entry - setup.sl) : entry * 0.01;
  if (!Number.isFinite(risk) || risk <= 0) {
    risk = Math.max(entry * 0.008, Math.max(entry * 0.0005, 0.0001));
  }

  const sl = clampRoundPrice(options.dir === 'LONG' ? entry - risk : entry + risk);
  const tp = clampRoundPrice(options.dir === 'LONG' ? entry + risk * rr : entry - risk * rr);
  if (!Number.isFinite(sl) || !Number.isFinite(tp) || sl <= 0 || tp <= 0) return null;

  const source = setup ? 'CHART SETUP' : 'CHART VIEW';
  const reason = setup
    ? `Overlay based ${options.dir} setup (${setup.source === 'consensus' ? 'consensus' : setup.agentName || 'agent'})`
    : `Manual ${options.dir} perspective from chart (${normalizeTimeframe(options.timeframe).toUpperCase()})`;
  const conf = setup
    ? clampSignalConfidence(setup.conf)
    : clampSignalConfidence(options.chatTradeReady && options.chatTradeDir === options.dir ? 74 : 68);

  return {
    pair,
    dir: options.dir,
    entry,
    tp,
    sl,
    rr,
    conf,
    source,
    reason,
  };
}
