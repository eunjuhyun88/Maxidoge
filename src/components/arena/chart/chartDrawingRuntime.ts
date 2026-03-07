import type { ChartTheme } from '../ChartTheme';
import type { DrawingItem, DrawingMode, TradePlanDraft } from '$lib/chart/chartTypes';
import { formatPrice } from '$lib/chart/chartCoordinates';
import { MAX_DRAWINGS } from '$lib/chart/chartIndicators';
import {
  makeTradeBoxDrawing as buildTradeBoxDrawing,
  type TradePreview,
} from './chartDrawingEngine';
import {
  drawTrendlineGhost,
  isTradePreviewMode,
  resolveTradePreview,
} from './chartOverlayRenderer';
import {
  appendDrawingWithLimit,
  buildHorizontalLineDrawing,
  completeTrendlineDraft,
  finalizeTradePreview,
  startTradePreviewDraft,
  startTrendlineDraft,
  updateTradePreviewDraft,
  type TradePreviewDraft,
  type TrendlineDraft,
} from './chartDrawingSession';

export interface ChartDrawingRuntimeController {
  setDrawingMode(mode: DrawingMode): void;
  toggleDrawingsVisible(): void;
  clearAllDrawings(): void;
  handleMouseDown(event: MouseEvent): void;
  handleMouseMove(event: MouseEvent): void;
  handleMouseUp(event: MouseEvent): void;
  dispose(): void;
}

export interface CreateChartDrawingRuntimeOptions {
  getDrawingCanvas: () => HTMLCanvasElement | null;
  getChartTheme: () => ChartTheme;
  getDrawingMode: () => DrawingMode;
  setDrawingModeState: (mode: DrawingMode) => void;
  getDrawings: () => DrawingItem[];
  setDrawings: (drawings: DrawingItem[]) => void;
  getCurrentDrawing: () => TrendlineDraft | null;
  setCurrentDrawing: (drawing: TrendlineDraft | null) => void;
  getTradePreview: () => TradePreviewDraft | null;
  setTradePreview: (preview: TradePreviewDraft | null) => void;
  getPendingTradePlan: () => TradePlanDraft | null;
  setPendingTradePlan: (plan: TradePlanDraft | null) => void;
  getIsDrawing: () => boolean;
  setIsDrawing: (drawing: boolean) => void;
  getDrawingsVisible: () => boolean;
  setDrawingsVisible: (visible: boolean) => void;
  getLivePrice: () => number;
  getPair: () => string;
  getRequireTradeConfirm: () => boolean;
  getToChartPrice: () => (y: number) => number | null;
  getToChartY: () => (price: number) => number | null;
  getToChartTime: () => (x: number) => number | null;
  getToDrawingAnchor: () => (x: number, y: number) => { time: number; price: number } | null;
  renderDrawings: () => void;
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

export function createChartDrawingRuntime(
  options: CreateChartDrawingRuntimeOptions,
): ChartDrawingRuntimeController {
  let globalDrawingMouseUpBound = false;
  let drawRaf: number | null = null;

  function getCanvasRect() {
    const drawingCanvas = options.getDrawingCanvas();
    if (!drawingCanvas) return null;
    return drawingCanvas.getBoundingClientRect();
  }

  function unbindGlobalDrawingMouseUp() {
    if (!globalDrawingMouseUpBound || typeof window === 'undefined') return;
    window.removeEventListener('mouseup', handleMouseUp);
    globalDrawingMouseUpBound = false;
  }

  function bindGlobalDrawingMouseUp() {
    if (globalDrawingMouseUpBound || typeof window === 'undefined') return;
    window.addEventListener('mouseup', handleMouseUp);
    globalDrawingMouseUpBound = true;
  }

  function resetTransientDrawingState() {
    options.setIsDrawing(false);
    options.setCurrentDrawing(null);
    options.setTradePreview(null);
  }

  function setDrawingMode(mode: DrawingMode) {
    options.setDrawingModeState(mode);
    resetTransientDrawingState();
    if (mode !== 'none') options.setPendingTradePlan(null);
    unbindGlobalDrawingMouseUp();
    options.renderDrawings();
  }

  function toggleDrawingsVisible() {
    options.setDrawingsVisible(!options.getDrawingsVisible());
    options.renderDrawings();
  }

  function clearAllDrawings() {
    options.setDrawings([]);
    options.setPendingTradePlan(null);
    options.setDrawingModeState('none');
    resetTransientDrawingState();
    unbindGlobalDrawingMouseUp();
    options.renderDrawings();
  }

  function handleMouseDown(event: MouseEvent) {
    const rect = getCanvasRect();
    if (!rect) return;
    const drawingMode = options.getDrawingMode();
    if (drawingMode === 'none') return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const chartTheme = options.getChartTheme();

    if (drawingMode === 'hline') {
      const linePrice = options.getToChartPrice()(y);
      options.setDrawings(
        appendDrawingWithLimit(
          options.getDrawings(),
          buildHorizontalLineDrawing({
            y,
            width: rect.width,
            linePrice,
            color: chartTheme.draw,
          }),
          MAX_DRAWINGS,
        ),
      );
      options.renderDrawings();
      options.setDrawingModeState('none');
      return;
    }

    if (drawingMode === 'trendline') {
      const currentDrawing = options.getCurrentDrawing();
      if (!options.getIsDrawing()) {
        options.setCurrentDrawing(startTrendlineDraft(x, y));
        options.setIsDrawing(true);
      } else if (currentDrawing) {
        const startPoint = currentDrawing.points[0];
        const endPoint = { x, y };
        const toDrawingAnchor = options.getToDrawingAnchor();
        options.setDrawings(
          appendDrawingWithLimit(
            options.getDrawings(),
            completeTrendlineDraft({
              draft: currentDrawing,
              endPoint,
              startAnchor: toDrawingAnchor(startPoint.x, startPoint.y),
              endAnchor: toDrawingAnchor(endPoint.x, endPoint.y),
              color: chartTheme.draw,
            }),
            MAX_DRAWINGS,
          ),
        );
        options.setCurrentDrawing(null);
        options.setIsDrawing(false);
        options.setDrawingModeState('none');
        options.renderDrawings();
      }
      return;
    }

    if (isTradePreviewMode(drawingMode)) {
      options.setTradePreview(startTradePreviewDraft(drawingMode, x, y));
      options.setCurrentDrawing(null);
      options.setIsDrawing(true);
      bindGlobalDrawingMouseUp();
      options.renderDrawings();
    }
  }

  function handleMouseUp(event: MouseEvent) {
    const drawingCanvas = options.getDrawingCanvas();
    if (!drawingCanvas || !options.getIsDrawing()) return;
    const tradePreview = options.getTradePreview();
    const drawingMode = options.getDrawingMode();
    if (!tradePreview || !isTradePreviewMode(drawingMode)) return;

    const rect = drawingCanvas.getBoundingClientRect();
    const preview = resolveTradePreview({
      tradePreview,
      drawingMode,
      cursor: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      canvasW: rect.width,
      canvasH: rect.height,
      coord: { toChartPrice: options.getToChartPrice(), toChartY: options.getToChartY() },
      livePrice: options.getLivePrice(),
    });

    if (!preview) {
      options.pushChartNotice('라인 진입 계산 실패');
    } else {
      const nextDrawing = buildTradeBoxDrawing(preview, options.getToChartTime(), options.getChartTheme());
      const finalized = finalizeTradePreview({
        drawings: options.getDrawings(),
        nextDrawing,
        preview,
        pair: options.getPair(),
        requireTradeConfirm: options.getRequireTradeConfirm(),
        maxDrawings: MAX_DRAWINGS,
      });
      options.setDrawings(finalized.drawings);

      if (finalized.pendingTradePlan) {
        options.setPendingTradePlan(finalized.pendingTradePlan);
        options.pushChartNotice('Drag complete — adjust ratio and confirm');
      } else if (finalized.lineTrade) {
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
      } else {
        options.pushChartNotice('라인 기준 가격 계산 실패');
      }
    }

    options.setDrawingModeState('none');
    resetTransientDrawingState();
    unbindGlobalDrawingMouseUp();
    options.renderDrawings();
  }

  function handleMouseMove(event: MouseEvent) {
    const drawingCanvas = options.getDrawingCanvas();
    if (!drawingCanvas || !options.getIsDrawing()) return;
    if (drawRaf) return;

    drawRaf = requestAnimationFrame(() => {
      drawRaf = null;
      const canvas = options.getDrawingCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const tradePreview = options.getTradePreview();
      const drawingMode = options.getDrawingMode();

      if (tradePreview && isTradePreviewMode(drawingMode)) {
        options.setTradePreview(
          updateTradePreviewDraft(tradePreview, event.clientX - rect.left, event.clientY - rect.top),
        );
        options.renderDrawings();
        return;
      }

      const currentDrawing = options.getCurrentDrawing();
      if (!currentDrawing) return;

      options.renderDrawings();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawTrendlineGhost(
        ctx,
        currentDrawing,
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        options.getChartTheme().drawGhost,
      );
    });
  }

  function dispose() {
    if (drawRaf) {
      cancelAnimationFrame(drawRaf);
      drawRaf = null;
    }
    unbindGlobalDrawingMouseUp();
  }

  return {
    setDrawingMode,
    toggleDrawingsVisible,
    clearAllDrawings,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    dispose,
  };
}
