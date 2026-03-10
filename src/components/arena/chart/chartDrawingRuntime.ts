import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { ChartTheme } from '../ChartTheme';
import type { DrawingItem, DrawingMode, TradePlanDraft } from '$lib/chart/chartTypes';
import { formatPrice } from '$lib/chart/chartCoordinates';
import { MAX_DRAWINGS } from '$lib/chart/chartIndicators';
import {
  makeTradeBoxDrawing as buildTradeBoxDrawing,
} from './chartDrawingEngine';
import {
  isTradePreviewMode,
  resolveTradePreview,
} from './chartOverlayRenderer';
import {
  appendDrawingWithLimit,
  finalizeTradePreview,
  startTradePreviewDraft,
  updateTradePreviewDraft,
  type TradePreviewDraft,
  type TrendlineDraft,
} from './chartDrawingSession';
import type { DrawingData } from '$lib/chart/primitives/drawingManager';
import type { DrawingStyleOptions } from '$lib/chart/primitives/drawingPrimitiveTypes';
import { createChartDrawingPersistenceRuntime } from './chartDrawingPersistenceRuntime';

const PRIMITIVE_DRAWING_MODES: Set<DrawingMode> = new Set([
  'none',
  'hline',
  'vline',
  'trendline',
  'ray',
  'fib_retracement',
  'rect',
  'price_range',
  'eraser',
  'longentry',
  'shortentry',
  'channel',
  'extended_line',
]);

function isPrimitiveDrawingMode(mode: DrawingMode): boolean {
  return PRIMITIVE_DRAWING_MODES.has(mode);
}

// ── Controller interface ─────────────────────────────────────

export interface ChartDrawingRuntimeController {
  preload(): Promise<void>;
  setDrawingMode(mode: DrawingMode): void;
  toggleDrawingsVisible(): void;
  clearAllDrawings(): void;
  handleMouseDown(event: MouseEvent): void;
  handleMouseMove(event: MouseEvent): void;
  handleMouseUp(event: MouseEvent): void;
  /** Cancel current drawing operation or deselect */
  cancelCurrentAction(): void;
  /** Delete the currently selected drawing */
  deleteSelectedDrawing(): void;
  /** Toggle magnet snap to candle OHLC */
  toggleMagnet(): void;
  /** Get magnet enabled state */
  getMagnetEnabled(): boolean;
  /** Undo last drawing action */
  undo(): void;
  /** Redo last undone action */
  redo(): void;
  /** Update style options on the selected drawing (context menu) */
  updateSelectedOptions(opts: Partial<DrawingStyleOptions>): void;
  /** Duplicate the selected drawing */
  duplicateSelected(): void;
  /** Toggle lock on the selected drawing */
  toggleLockSelected(): void;
  /** Check if selected drawing is locked */
  isSelectedLocked(): boolean;
  /** Get serialized data for selected drawing */
  getSelectedDrawingData(): DrawingData | null;
  /** Export all drawings */
  exportDrawings(): DrawingData[];
  /** Import drawings */
  importDrawings(drawings: DrawingData[]): void;
  /** Call when pair or timeframe changes — saves current, loads new */
  syncPairTimeframe(): Promise<void>;
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
  getSelectedDrawingId: () => string | null;
  setSelectedDrawingId: (id: string | null) => void;
  getLivePrice: () => number;
  getPair: () => string;
  getTimeframe: () => string;
  getRequireTradeConfirm: () => boolean;
  getToChartPrice: () => (y: number) => number | null;
  getToChartY: () => (price: number) => number | null;
  getToChartX: () => (time: number) => number | null;
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
  // ── NEW: chart/series for DrawingManager ──
  getChart: () => IChartApi | null;
  getSeries: () => ISeriesApi<'Candlestick'> | null;
  getPrimitiveDrawingCount: () => number;
  setPrimitiveDrawingCount: (count: number) => void;
  getKlines: () => Array<{ time: unknown; open: number; high: number; low: number; close: number }>;
  /** Callback when context menu should be shown on a drawing */
  onContextMenu?: (x: number, y: number, drawingId: string) => void;
}

export function createChartDrawingRuntime(
  options: CreateChartDrawingRuntimeOptions,
): ChartDrawingRuntimeController {
  let globalDrawingMouseUpBound = false;
  let drawRaf: number | null = null;
  const persistenceRuntime = createChartDrawingPersistenceRuntime({
    getPair: () => options.getPair(),
    getTimeframe: () => options.getTimeframe(),
    getChart: () => options.getChart(),
    getSeries: () => options.getSeries(),
    createDrawingManagerCallbacks: () => ({
      onDrawingModeChanged: (mode) => {
        options.setDrawingModeState(mode);
      },
      onDrawingsChanged: (count) => {
        options.setPrimitiveDrawingCount(count);
      },
      onSelectedChanged: (id) => {
        options.setSelectedDrawingId(id);
      },
      getDrawingColor: () => options.getChartTheme().draw,
      getKlines: () => options.getKlines(),
      onContextMenu: options.onContextMenu,
    }),
  });

  function ensureDrawingManager() {
    return persistenceRuntime.getDrawingManager();
  }

  async function preload() {
    await persistenceRuntime.preload();
  }

  async function syncPairTimeframe(): Promise<void> {
    await persistenceRuntime.syncPairTimeframe();
  }

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
    const dm = ensureDrawingManager();
    const primitiveMode = isPrimitiveDrawingMode(mode);

    // Primitive modes → delegate to DrawingManager
    if (primitiveMode) {
      if (dm) {
        dm.setDrawingMode(mode);
      } else {
        options.setDrawingModeState(mode);
        if (mode !== 'none') {
          void preload().then(() => {
            const loadedDrawingManager = ensureDrawingManager();
            loadedDrawingManager?.setDrawingMode(mode);
          });
        }
      }
      resetTransientDrawingState();
      unbindGlobalDrawingMouseUp();
      if (mode !== 'none') {
        options.setPendingTradePlan(null);
      }
      options.renderDrawings();
      return;
    }

    // Trade modes → old system
    options.setDrawingModeState(mode);
    if (dm) dm.setDrawingMode('none'); // deactivate DM for trade modes
    resetTransientDrawingState();
    if (mode !== 'none') {
      options.setPendingTradePlan(null);
      options.setSelectedDrawingId(null);
    }
    unbindGlobalDrawingMouseUp();
    options.renderDrawings();
  }

  function toggleDrawingsVisible() {
    const dm = ensureDrawingManager();
    const nextVisible = !options.getDrawingsVisible();
    if (dm) {
      dm.toggleDrawingsVisible();
    } else if (nextVisible) {
      void syncPairTimeframe().then(() => {
        options.renderDrawings();
      });
    }
    options.setDrawingsVisible(nextVisible);
    options.renderDrawings();
  }

  function clearAllDrawings() {
    const dm = ensureDrawingManager();
    if (dm) {
      dm.clearAllDrawings();
    }
    // Also clear tradebox drawings from old system
    options.setDrawings([]);
    options.setPendingTradePlan(null);
    options.setDrawingModeState('none');
    options.setSelectedDrawingId(null);
    resetTransientDrawingState();
    unbindGlobalDrawingMouseUp();
    options.renderDrawings();
  }

  function deleteSelectedDrawing() {
    const dm = ensureDrawingManager();
    if (dm && dm.selectedId) {
      dm.deleteSelectedDrawing();
      return;
    }
    // Fallback: check old drawings (tradebox)
    const selectedId = options.getSelectedDrawingId();
    if (!selectedId) return;
    options.setDrawings(options.getDrawings().filter((d) => d.id !== selectedId));
    options.setSelectedDrawingId(null);
    options.renderDrawings();
  }

  function cancelCurrentAction() {
    const dm = ensureDrawingManager();
    const drawingMode = options.getDrawingMode();

    // If DM is in drawing state, cancel that
    if (dm && dm.isDrawing) {
      dm.cancelCurrentAction();
      unbindGlobalDrawingMouseUp();
      return;
    }

    // If DM owns the mode, delegate
    if (dm && isPrimitiveDrawingMode(drawingMode) && drawingMode !== 'none') {
      dm.cancelCurrentAction();
      unbindGlobalDrawingMouseUp();
      options.renderDrawings();
      return;
    }

    // Trade preview in progress
    if (options.getIsDrawing()) {
      resetTransientDrawingState();
      unbindGlobalDrawingMouseUp();
      options.renderDrawings();
      return;
    }

    // Trade mode active
    if (drawingMode !== 'none') {
      options.setDrawingModeState('none');
      if (dm) dm.setDrawingMode('none');
      resetTransientDrawingState();
      unbindGlobalDrawingMouseUp();
      options.renderDrawings();
      return;
    }

    // Deselect
    if (dm && dm.selectedId) {
      dm.cancelCurrentAction();
      return;
    }
    if (options.getSelectedDrawingId()) {
      options.setSelectedDrawingId(null);
      options.renderDrawings();
    }
  }

  // ── Mouse handlers ─────────────────────────────────────────

  function handleMouseDown(event: MouseEvent) {
    const rect = getCanvasRect();
    if (!rect) return;
    const drawingMode = options.getDrawingMode();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const dm = ensureDrawingManager();

    // ── Primitive modes → DrawingManager ──
    if (isPrimitiveDrawingMode(drawingMode) && drawingMode !== 'none') {
      if (!dm) {
        void preload();
        return;
      }
      dm.handleMouseDown(x, y);
      // Bind global mouseup for drag modes
      if (dm.isDrawing) {
        bindGlobalDrawingMouseUp();
      }
      return;
    }

    // ── mode=none → selection handled by subscribeClick (canvas has no pointer-events) ──
    if (drawingMode === 'none') {
      return;
    }

    // ── trade modes → old system ──
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
    if (!drawingCanvas) return;

    const rect = drawingCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const drawingMode = options.getDrawingMode();

    const dm = ensureDrawingManager();

    // ── Primitive drag modes → DrawingManager ──
    if (dm && dm.isDrawing) {
      dm.handleMouseUp(x, y);
      unbindGlobalDrawingMouseUp();
      return;
    }

    // ── trade preview modes → old system ──
    if (!options.getIsDrawing()) return;

    const tradePreview = options.getTradePreview();
    if (!tradePreview || !isTradePreviewMode(drawingMode)) return;

    const preview = resolveTradePreview({
      tradePreview,
      drawingMode,
      cursor: { x, y },
      canvasW: rect.width,
      canvasH: rect.height,
      coord: { toChartPrice: options.getToChartPrice(), toChartY: options.getToChartY() },
      livePrice: options.getLivePrice(),
    });

    if (!preview) {
      options.pushChartNotice('\ub77c\uc778 \uc9c4\uc785 \uacc4\uc0b0 \uc2e4\ud328');
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
        options.pushChartNotice('Drag complete \u2014 adjust ratio and confirm');
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
          `${finalized.lineTrade.dir} \uc9c4\uc785 \uc0dd\uc131 \u00b7 ENTRY ${formatPrice(finalized.lineTrade.entry)} \u00b7 TP ${formatPrice(finalized.lineTrade.tp)} \u00b7 SL ${formatPrice(finalized.lineTrade.sl)} \u00b7 RR 1:${finalized.lineTrade.rr.toFixed(1)}`,
        );
      } else {
        options.pushChartNotice('\ub77c\uc778 \uae30\uc900 \uac00\uaca9 \uacc4\uc0b0 \uc2e4\ud328');
      }
    }

    // Trade modes are NOT sticky — reset to 'none'
    options.setDrawingModeState('none');
    if (dm) dm.setDrawingMode('none');
    resetTransientDrawingState();
    unbindGlobalDrawingMouseUp();
    options.renderDrawings();
  }

  function handleMouseMove(event: MouseEvent) {
    const drawingCanvas = options.getDrawingCanvas();
    if (!drawingCanvas) return;

    const dm = ensureDrawingManager();

    // ── Primitive drag in progress → DrawingManager ──
    if (dm && dm.isDrawing) {
      if (drawRaf) return;
      drawRaf = requestAnimationFrame(() => {
        drawRaf = null;
        const canvas = options.getDrawingCanvas();
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        dm.handleMouseMove(event.clientX - rect.left, event.clientY - rect.top);
      });
      return;
    }

    // ── Trade preview drag → old system ──
    if (!options.getIsDrawing()) return;
    if (drawRaf) return;

    drawRaf = requestAnimationFrame(() => {
      drawRaf = null;
      const canvas = options.getDrawingCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const tradePreview = options.getTradePreview();
      const currentDrawingMode = options.getDrawingMode();

      if (tradePreview && isTradePreviewMode(currentDrawingMode)) {
        options.setTradePreview(
          updateTradePreviewDraft(tradePreview, event.clientX - rect.left, event.clientY - rect.top),
        );
        options.renderDrawings();
      }
    });
  }

  function dispose() {
    if (drawRaf) {
      cancelAnimationFrame(drawRaf);
      drawRaf = null;
    }
    unbindGlobalDrawingMouseUp();
    persistenceRuntime.dispose();
  }

  function toggleMagnet() {
    const dm = ensureDrawingManager();
    if (dm) {
      dm.setMagnetEnabled(!dm.magnetEnabled);
    }
  }

  function getMagnetEnabled(): boolean {
    return persistenceRuntime.getDrawingManager()?.magnetEnabled ?? true;
  }

  function undo() {
    const dm = ensureDrawingManager();
    if (dm) dm.undo();
  }

  function redo() {
    const dm = ensureDrawingManager();
    if (dm) dm.redo();
  }

  function updateSelectedOptions(opts: Partial<DrawingStyleOptions>) {
    const dm = ensureDrawingManager();
    if (dm) dm.updateSelectedOptions(opts);
  }

  function duplicateSelected() {
    const dm = ensureDrawingManager();
    if (dm) dm.duplicateSelected();
  }

  function toggleLockSelected() {
    const dm = ensureDrawingManager();
    if (dm) dm.toggleLockSelected();
  }

  function isSelectedLocked(): boolean {
    return persistenceRuntime.getDrawingManager()?.isSelectedLocked() ?? false;
  }

  function getSelectedDrawingData() {
    return persistenceRuntime.getDrawingManager()?.getSelectedDrawingData() ?? null;
  }

  function exportDrawings() {
    return persistenceRuntime.getDrawingManager()?.exportDrawings() ?? [];
  }

  function importDrawings(drawings: DrawingData[]) {
    const dm = ensureDrawingManager();
    if (dm) {
      dm.importDrawings(drawings);
      return;
    }
    void persistenceRuntime.ensureDrawingManagerReady().then((loadedDrawingManager) => {
      loadedDrawingManager?.importDrawings(drawings);
    });
  }

  return {
    preload,
    setDrawingMode,
    toggleDrawingsVisible,
    clearAllDrawings,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    cancelCurrentAction,
    deleteSelectedDrawing,
    toggleMagnet,
    getMagnetEnabled,
    undo,
    redo,
    updateSelectedOptions,
    duplicateSelected,
    toggleLockSelected,
    isSelectedLocked,
    getSelectedDrawingData,
    exportDrawings,
    importDrawings,
    syncPairTimeframe,
    dispose,
  };
}
