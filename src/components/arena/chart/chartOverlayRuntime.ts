import type { IChartApi, IPriceLine, ISeriesApi } from 'lightweight-charts';
import type { AgentTradeSetup, DrawingItem, DrawingMode } from '$lib/chart/chartTypes';
import type { ChartPatternDetection } from '$lib/engine/patternDetector';
import type { ChartTheme } from '../ChartTheme';
import { renderChartOverlay } from './chartOverlayRenderer';
import type { TradePreviewDraft } from './chartDrawingSession';

export interface AgentPriceLines {
  tp: IPriceLine | null;
  entry: IPriceLine | null;
  sl: IPriceLine | null;
}

export interface ChartOverlayRuntimeController {
  render(): void;
  resizeCanvas(): void;
  applyAgentTradeSetup(setup: AgentTradeSetup | null): void;
  dispose(): void;
}

export interface CreateChartOverlayRuntimeOptions {
  getChart: () => IChartApi | null;
  getSeries: () => ISeriesApi<'Candlestick'> | null;
  getChartContainer: () => HTMLDivElement | null;
  getDrawingCanvas: () => HTMLCanvasElement | null;
  getChartMode: () => 'agent' | 'trading';
  getOverlayPatterns: () => ChartPatternDetection[];
  getActiveTradeSetup: () => AgentTradeSetup | null;
  getDrawingsVisible: () => boolean;
  getDrawings: () => DrawingItem[];
  getDrawingMode: () => DrawingMode;
  getTradePreview: () => TradePreviewDraft | null;
  getChartTheme: () => ChartTheme;
  getLivePrice: () => number;
  getToChartX: () => (time: number) => number | null;
  getToChartY: () => (price: number) => number | null;
  getToChartPrice: () => (y: number) => number | null;
  getSelectedDrawingId: () => string | null;
  getAgentPriceLines: () => AgentPriceLines;
  setAgentPriceLines: (lines: AgentPriceLines) => void;
}

export function createChartOverlayRuntime(
  options: CreateChartOverlayRuntimeOptions,
): ChartOverlayRuntimeController {
  let drawCtx: CanvasRenderingContext2D | null = null;

  function toOverlayPoint(time: number, price: number): { x: number; y: number } | null {
    const chart = options.getChart();
    const drawingCanvas = options.getDrawingCanvas();
    if (!chart || !drawingCanvas) return null;
    if (!Number.isFinite(time) || !Number.isFinite(price)) return null;

    try {
      const x = chart.timeScale().timeToCoordinate(time as any) as number | null;
      const y = options.getToChartY()(price);
      if (x === null || !Number.isFinite(x) || y === null || !Number.isFinite(y)) return null;
      return { x, y };
    } catch {
      return null;
    }
  }

  function render() {
    const drawingCanvas = options.getDrawingCanvas();
    if (!drawingCanvas) return;
    if (!drawCtx) drawCtx = drawingCanvas.getContext('2d');
    const ctx = drawCtx;
    if (!ctx) return;

    renderChartOverlay({
      ctx,
      canvasW: drawingCanvas.width,
      canvasH: drawingCanvas.height,
      chartMode: options.getChartMode(),
      overlayPatterns: options.getOverlayPatterns(),
      activeTradeSetup: options.getActiveTradeSetup(),
      drawingsVisible: options.getDrawingsVisible(),
      drawings: options.getDrawings(),
      drawingMode: options.getDrawingMode(),
      tradePreview: options.getTradePreview(),
      chartTheme: options.getChartTheme(),
      livePrice: options.getLivePrice(),
      selectedDrawingId: options.getSelectedDrawingId(),
      coord: {
        toChartX: options.getToChartX(),
        toChartY: options.getToChartY(),
        toChartPrice: options.getToChartPrice(),
        toOverlayPoint,
      },
    });
  }

  function resizeCanvas() {
    const drawingCanvas = options.getDrawingCanvas();
    const chartContainer = options.getChartContainer();
    if (!drawingCanvas || !chartContainer) return;
    drawingCanvas.width = chartContainer.clientWidth;
    drawingCanvas.height = chartContainer.clientHeight;
    drawCtx = null;
    render();
  }

  function applyAgentTradeSetup(setup: AgentTradeSetup | null) {
    const series = options.getSeries();
    const agentPriceLines = options.getAgentPriceLines();

    if (agentPriceLines.tp && series) {
      try {
        series.removePriceLine(agentPriceLines.tp);
      } catch {}
    }
    if (agentPriceLines.entry && series) {
      try {
        series.removePriceLine(agentPriceLines.entry);
      } catch {}
    }
    if (agentPriceLines.sl && series) {
      try {
        series.removePriceLine(agentPriceLines.sl);
      } catch {}
    }

    options.setAgentPriceLines({ tp: null, entry: null, sl: null });
    render();
  }

  function dispose() {
    drawCtx = null;
  }

  return {
    render,
    resizeCanvas,
    applyAgentTradeSetup,
    dispose,
  };
}
