import type { AgentTradeSetup, DrawingMode } from '$lib/chart/chartTypes';
import {
  createChartActionRuntime,
  type CreateChartActionRuntimeOptions,
} from './chartActionRuntime';
import {
  createChartDrawingRuntime,
  type CreateChartDrawingRuntimeOptions,
} from './chartDrawingRuntime';
import {
  createChartOverlayRuntime,
  type CreateChartOverlayRuntimeOptions,
} from './chartOverlayRuntime';
import {
  createChartPriceRuntime,
  type CreateChartPriceRuntimeOptions,
} from './chartPriceRuntime';
import {
  createChartTradePlanRuntime,
  type CreateChartTradePlanRuntimeOptions,
} from './chartTradePlanRuntime';
import {
  createChartViewportRuntime,
  type CreateChartViewportRuntimeOptions,
} from './chartViewportRuntime';

export interface ChartPanelSupportRuntimeController {
  renderDrawings(): void;
  resizeDrawingCanvas(): void;
  applyAgentTradeSetup(setup: AgentTradeSetup | null): void;
  applyIndicatorVisibility(): void;
  applyTimeScale(): void;
  zoomChart(direction: 1 | -1): void;
  fitChartRange(): void;
  toggleAutoScaleY(): void;
  resetChartScale(): void;
  syncTradePlan(): void;
  setTradePlanRatio(nextLongRatio: number): void;
  openTradeFromPlan(): void;
  cancelTradePlan(): void;
  handleRatioPointerDown(event: PointerEvent): void;
  setDrawingMode(mode: DrawingMode): void;
  toggleDrawingsVisible(): void;
  clearAllDrawings(): void;
  cancelCurrentAction(): void;
  deleteSelectedDrawing(): void;
  handleDrawingMouseDown(event: MouseEvent): void;
  handleDrawingMouseMove(event: MouseEvent): void;
  handleDrawingMouseUp(event: MouseEvent): void;
  changePair(pair: string): void;
  changeTimeframe(timeframe: string): void;
  requestAgentScan(): void;
  publishCommunitySignal(
    dir: 'LONG' | 'SHORT',
    options?: { openCopyTrade?: boolean; sourceContext?: string },
  ): void;
  requestChatAssist(): Promise<void>;
  activateTradeDrawing(dir?: 'LONG' | 'SHORT'): Promise<void>;
  flushPriceUpdate(price: number, pairBase: string): void;
  throttledPriceUpdate(price: number, pairBase: string): void;
  update24hStats(next: {
    priceChange24h?: number;
    high24h?: number;
    low24h?: number;
    quoteVolume24h?: number;
  }): void;
  resetTransientState(): void;
  getFallbackLivePrice(): number | null;
  dispose(): void;
}

export interface CreateChartPanelSupportRuntimeOptions {
  overlay: CreateChartOverlayRuntimeOptions;
  viewport: CreateChartViewportRuntimeOptions;
  tradePlan: CreateChartTradePlanRuntimeOptions;
  drawing: CreateChartDrawingRuntimeOptions;
  action: CreateChartActionRuntimeOptions;
  price: CreateChartPriceRuntimeOptions;
}

export function createChartPanelSupportRuntime(
  options: CreateChartPanelSupportRuntimeOptions,
): ChartPanelSupportRuntimeController {
  const overlayRuntime = createChartOverlayRuntime(options.overlay);
  const viewportRuntime = createChartViewportRuntime(options.viewport);
  const tradePlanRuntime = createChartTradePlanRuntime(options.tradePlan);
  const drawingRuntime = createChartDrawingRuntime(options.drawing);
  const actionRuntime = createChartActionRuntime(options.action);
  const priceRuntime = createChartPriceRuntime(options.price);

  function dispose() {
    tradePlanRuntime.dispose();
    priceRuntime.dispose();
    actionRuntime.dispose();
    viewportRuntime.dispose();
    overlayRuntime.dispose();
    drawingRuntime.dispose();
  }

  return {
    renderDrawings: () => overlayRuntime.render(),
    resizeDrawingCanvas: () => overlayRuntime.resizeCanvas(),
    applyAgentTradeSetup: (setup) => overlayRuntime.applyAgentTradeSetup(setup),
    applyIndicatorVisibility: () => viewportRuntime.applyIndicatorVisibility(),
    applyTimeScale: () => viewportRuntime.applyTimeScale(),
    zoomChart: (direction) => viewportRuntime.zoomChart(direction),
    fitChartRange: () => viewportRuntime.fitChartRange(),
    toggleAutoScaleY: () => viewportRuntime.toggleAutoScaleY(),
    resetChartScale: () => viewportRuntime.resetChartScale(),
    syncTradePlan: () => tradePlanRuntime.sync(),
    setTradePlanRatio: (nextLongRatio) => tradePlanRuntime.setTradePlanRatio(nextLongRatio),
    openTradeFromPlan: () => tradePlanRuntime.openTradeFromPlan(),
    cancelTradePlan: () => tradePlanRuntime.cancelTradePlan(),
    handleRatioPointerDown: (event) => tradePlanRuntime.handleRatioPointerDown(event),
    setDrawingMode: (mode) => drawingRuntime.setDrawingMode(mode),
    toggleDrawingsVisible: () => drawingRuntime.toggleDrawingsVisible(),
    clearAllDrawings: () => drawingRuntime.clearAllDrawings(),
    cancelCurrentAction: () => drawingRuntime.cancelCurrentAction(),
    deleteSelectedDrawing: () => drawingRuntime.deleteSelectedDrawing(),
    handleDrawingMouseDown: (event) => drawingRuntime.handleMouseDown(event),
    handleDrawingMouseMove: (event) => drawingRuntime.handleMouseMove(event),
    handleDrawingMouseUp: (event) => drawingRuntime.handleMouseUp(event),
    changePair: (pair) => actionRuntime.changePair(pair),
    changeTimeframe: (timeframe) => actionRuntime.changeTimeframe(timeframe),
    requestAgentScan: () => actionRuntime.requestAgentScan(),
    publishCommunitySignal: (dir, runtimeOptions) =>
      actionRuntime.publishCommunitySignal(dir, runtimeOptions),
    requestChatAssist: () => actionRuntime.requestChatAssist(),
    activateTradeDrawing: (dir) => actionRuntime.activateTradeDrawing(dir),
    flushPriceUpdate: (price, pairBase) => priceRuntime.flushPriceUpdate(price, pairBase),
    throttledPriceUpdate: (price, pairBase) => priceRuntime.throttledPriceUpdate(price, pairBase),
    update24hStats: (next) => priceRuntime.update24hStats(next),
    resetTransientState: () => priceRuntime.resetTransientState(),
    getFallbackLivePrice: () => priceRuntime.getFallbackLivePrice(),
    dispose,
  };
}
