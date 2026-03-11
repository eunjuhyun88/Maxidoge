// ═══════════════════════════════════════════════════════════════
// Stockclaw — Chart Overlay Renderer (Canvas Orchestration)
// ═══════════════════════════════════════════════════════════════
// This layer decides what the overlay canvas should render.
// Basic drawing tools (hline, trendline, fib, etc.) are now handled
// by Series Primitives (see primitives/). This canvas only renders:
//   - Pattern overlays
//   - Agent trade overlays
//   - Trade preview (longentry/shortentry/trade)
//   - Tradebox drawings (legacy — until tradebox primitive exists)

import type { AgentTradeSetup, DrawingItem, DrawingMode } from '$lib/chart/chartTypes';
import type { ChartPatternDetection } from '$lib/engine/patternDetector';
import type { ChartTheme } from '../ChartTheme';
import {
  computeTradePreview,
  drawAgentTradeOverlay,
  drawDrawingItems,
  drawPatternOverlays,
  drawTradePreview,
  type CoordProvider,
  type TradePreview,
} from './chartDrawingEngine';
import type { TradePreviewDraft } from './chartDrawingSession';

export function isTradePreviewMode(
  mode: DrawingMode,
): mode is Extract<DrawingMode, 'longentry' | 'shortentry' | 'trade'> {
  return mode === 'longentry' || mode === 'shortentry' || mode === 'trade';
}

export function resolveTradePreview(options: {
  tradePreview: TradePreviewDraft | null;
  drawingMode: DrawingMode;
  cursor?: { x: number; y: number };
  canvasW: number;
  canvasH: number;
  coord: Pick<CoordProvider, 'toChartPrice' | 'toChartY'>;
  livePrice: number;
}): TradePreview | null {
  if (!options.tradePreview || !isTradePreviewMode(options.drawingMode)) return null;

  return computeTradePreview(
    options.tradePreview.mode,
    options.tradePreview.startX,
    options.tradePreview.startY,
    options.cursor?.x ?? options.tradePreview.cursorX,
    options.cursor?.y ?? options.tradePreview.cursorY,
    options.canvasW,
    options.canvasH,
    options.coord,
    options.livePrice,
  );
}

export function renderChartOverlay(options: {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  chartMode: 'agent' | 'trading';
  overlayPatterns: ChartPatternDetection[];
  activeTradeSetup: AgentTradeSetup | null;
  drawingsVisible: boolean;
  drawings: DrawingItem[];
  drawingMode: DrawingMode;
  tradePreview: TradePreviewDraft | null;
  chartTheme: ChartTheme;
  livePrice: number;
  selectedDrawingId?: string | null;
  coord: Pick<
    CoordProvider,
    'toChartX' | 'toChartY' | 'toChartPrice' | 'toOverlayPoint'
  >;
}): void {
  const {
    ctx,
    canvasW,
    canvasH,
    chartMode,
    overlayPatterns,
    activeTradeSetup,
    drawingsVisible,
    drawings,
    drawingMode,
    tradePreview,
    chartTheme,
    livePrice,
    selectedDrawingId,
    coord,
  } = options;

  ctx.clearRect(0, 0, canvasW, canvasH);

  if (chartMode === 'agent' && overlayPatterns.length > 0) {
    drawPatternOverlays(ctx, overlayPatterns, canvasW, canvasH, {
      toOverlayPoint: coord.toOverlayPoint,
    });
  }

  if (activeTradeSetup && drawingsVisible) {
    drawAgentTradeOverlay(
      ctx,
      activeTradeSetup,
      canvasW,
      { toChartY: coord.toChartY },
      chartTheme,
      livePrice,
    );
  }

  const preview = resolveTradePreview({
    tradePreview,
    drawingMode,
    canvasW,
    canvasH,
    coord: { toChartPrice: coord.toChartPrice, toChartY: coord.toChartY },
    livePrice,
  });

  if (!drawingsVisible) {
    if (preview) drawTradePreview(ctx, preview, chartTheme, canvasW);
    return;
  }

  // Only render tradebox drawings on canvas overlay.
  // Basic drawing tools (hline, trendline, fib, etc.) are now Series Primitives.
  const tradeboxDrawings = drawings.filter((d) => d.type === 'tradebox');
  if (tradeboxDrawings.length > 0) {
    drawDrawingItems(
      ctx,
      tradeboxDrawings,
      { toChartX: coord.toChartX, toChartY: coord.toChartY },
      chartTheme,
      selectedDrawingId,
    );
  }

  if (preview) drawTradePreview(ctx, preview, chartTheme, canvasW);
}
