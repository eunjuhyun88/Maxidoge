import type { ChartTheme } from '../ChartTheme';
import type { DrawingItem, DrawingMode, TradePlanDraft } from '$lib/chart/chartTypes';
import { formatPrice } from '$lib/chart/chartCoordinates';
import { MAX_DRAWINGS } from '$lib/chart/chartIndicators';
import { makeTradeBoxDrawing as buildTradeBoxDrawing } from './chartDrawingEngine';
import { finalizeTradePreview, type TradePreviewDraft } from './chartDrawingSession';
import { resolveTradePreview } from './chartOverlayRenderer';

export interface FinalizeChartTradePreviewOptions {
  tradePreview: TradePreviewDraft;
  drawingMode: DrawingMode;
  cursor: { x: number; y: number };
  canvasW: number;
  canvasH: number;
  pair: string;
  livePrice: number;
  requireTradeConfirm: boolean;
  drawings: DrawingItem[];
  chartTheme: ChartTheme;
  toChartPrice: (y: number) => number | null;
  toChartY: (price: number) => number | null;
  toChartTime: (x: number) => number | null;
  setDrawings: (drawings: DrawingItem[]) => void;
  setPendingTradePlan: (plan: TradePlanDraft | null) => void;
  openQuickTrade: (detail: {
    pair: string;
    dir: 'LONG' | 'SHORT';
    entry: number;
    tp: number;
    sl: number;
    source: string;
    note: string;
  }) => void;
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  pushChartNotice: (message: string) => void;
}

export function finalizeChartTradePreview(options: FinalizeChartTradePreviewOptions) {
  const preview = resolveTradePreview({
    tradePreview: options.tradePreview,
    drawingMode: options.drawingMode,
    cursor: options.cursor,
    canvasW: options.canvasW,
    canvasH: options.canvasH,
    coord: { toChartPrice: options.toChartPrice, toChartY: options.toChartY },
    livePrice: options.livePrice,
  });

  if (!preview) {
    options.pushChartNotice('라인 진입 계산 실패');
    return;
  }

  const nextDrawing = buildTradeBoxDrawing(preview, options.toChartTime, options.chartTheme);
  const finalized = finalizeTradePreview({
    drawings: options.drawings,
    nextDrawing,
    preview,
    pair: options.pair,
    requireTradeConfirm: options.requireTradeConfirm,
    maxDrawings: MAX_DRAWINGS,
  });

  options.setDrawings(finalized.drawings);

  if (finalized.pendingTradePlan) {
    options.setPendingTradePlan(finalized.pendingTradePlan);
    options.pushChartNotice('Drag complete — adjust ratio and confirm');
    return;
  }

  if (!finalized.lineTrade) {
    options.pushChartNotice('라인 기준 가격 계산 실패');
    return;
  }

  options.openQuickTrade({
    pair: finalized.lineTrade.pair,
    dir: finalized.lineTrade.dir,
    entry: finalized.lineTrade.entry,
    tp: finalized.lineTrade.tp,
    sl: finalized.lineTrade.sl,
    source: 'chart-line',
    note: `${finalized.lineTrade.dir} line-entry`,
  });
  options.emitGtm('terminal_line_entry_open', {
    pair: finalized.lineTrade.pair,
    dir: finalized.lineTrade.dir,
    entry: finalized.lineTrade.entry,
    tp: finalized.lineTrade.tp,
    sl: finalized.lineTrade.sl,
    rr: finalized.lineTrade.rr,
  });
  options.pushChartNotice(
    `${finalized.lineTrade.dir} 진입 생성 · ENTRY ${formatPrice(finalized.lineTrade.entry)} · TP ${formatPrice(finalized.lineTrade.tp)} · SL ${formatPrice(finalized.lineTrade.sl)} · RR 1:${finalized.lineTrade.rr.toFixed(1)}`,
  );
}
