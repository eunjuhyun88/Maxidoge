// ═══════════════════════════════════════════════════════════════
// Stockclaw — Drawing Manager (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Orchestrates drawing tool interaction, preview, and state.
// Replaces the canvas overlay approach with Series Primitives.
//
// Interaction model:
//   - drawingMode === 'none': subscribeClick handles selection/deselection
//     (canvas has pointer-events: none, clicks pass through to chart)
//   - drawingMode !== 'none': canvas has pointer-events: auto, captures events
//     All tool handling goes through handleMouseDown/Move/Up.

import type {
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  SeriesType,
  Time,
} from 'lightweight-charts';
import type { DrawingMode } from '$lib/chart/chartTypes';
import { generateDrawingId } from '$lib/chart/chartTypes';
import { PluginBase } from './pluginBase';
import { HorizontalLinePrimitive } from './horizontalLinePrimitive';
import { VerticalLinePrimitive } from './verticalLinePrimitive';
import { TrendLinePrimitive } from './trendLinePrimitive';
import { RayPrimitive } from './rayPrimitive';
import { FibRetracementPrimitive } from './fibRetracementPrimitive';
import { RectanglePrimitive } from './rectanglePrimitive';
import { PriceRangePrimitive } from './priceRangePrimitive';
import { PositionPrimitive, type PositionData, type PositionStyleOptions } from './positionPrimitive';
import { ExtendedLinePrimitive } from './extendedLinePrimitive';
import { ChannelPrimitive } from './channelPrimitive';
import type { AnchorPoint, AnchorHitResult, DrawingStyleOptions } from './drawingPrimitiveTypes';
import { DEFAULT_DRAWING_STYLE, constrainAnchor } from './drawingPrimitiveTypes';
import { DrawingUndoStack, type DrawingAction } from './drawingUndoStack';

// ── Types ────────────────────────────────────────────────────

/** Serializable drawing data (for state persistence) */
export interface DrawingData {
  id: string;
  type: 'hline' | 'vline' | 'trendline' | 'ray' | 'fib_retracement' | 'rect' | 'price_range' | 'position' | 'extended_line' | 'channel';
  anchors: AnchorPoint[];
  options: DrawingStyleOptions;
  /** Position-specific data (only for type='position') */
  positionData?: PositionData;
  positionStyle?: Partial<PositionStyleOptions>;
}

/** Modes that stay active after completing a drawing */
const STICKY_MODES: Set<DrawingMode> = new Set([
  'hline', 'vline', 'trendline', 'ray',
  'fib_retracement', 'rect', 'eraser', 'channel', 'extended_line',
]);

/** Modes that use 2-point drag (mousedown→drag→mouseup) */
const DRAG_MODES: Set<DrawingMode> = new Set([
  'trendline', 'ray', 'fib_retracement', 'rect', 'price_range',
  'longentry', 'shortentry', 'channel', 'extended_line',
]);

/** Modes managed by DrawingManager (not trade preview modes) */
const PRIMITIVE_MODES: Set<DrawingMode> = new Set([
  'none', 'hline', 'vline', 'trendline', 'ray',
  'fib_retracement', 'rect', 'price_range', 'eraser',
  'longentry', 'shortentry', 'channel', 'extended_line',
]);

export function isPrimitiveDrawingMode(mode: DrawingMode): boolean {
  return PRIMITIVE_MODES.has(mode);
}

/** Minimal OHLC candle data for magnet snapping */
export interface CandleOHLC {
  time: unknown;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DrawingManagerCallbacks {
  onDrawingModeChanged: (mode: DrawingMode) => void;
  onDrawingsChanged: (count: number) => void;
  onSelectedChanged: (id: string | null) => void;
  getDrawingColor: () => string;
  /** Return kline data for magnet snap (optional — snap disabled if null) */
  getKlines?: () => CandleOHLC[];
  /** Fired when user right-clicks a selected drawing (context menu) */
  onContextMenu?: (x: number, y: number, drawingId: string) => void;
}

// ── Manager ──────────────────────────────────────────────────

export class DrawingManager {
  private _chart: IChartApi;
  private _series: ISeriesApi<SeriesType>;
  private _callbacks: DrawingManagerCallbacks;

  // All attached drawing primitives
  private _primitives: Map<string, PluginBase & { id: string; setSelected: (s: boolean) => void; setHovered: (h: boolean) => void }> = new Map();

  // Drawing state
  private _drawingMode: DrawingMode = 'none';
  private _isDrawing = false;
  private _drawingsVisible = true;
  private _selectedId: string | null = null;
  private _hoveredId: string | null = null;
  private _magnetEnabled = true;

  // Drag state
  private _dragStart: AnchorPoint | null = null;
  private _previewPrimitive: PluginBase | null = null;

  // Undo/Redo stack
  private _undoStack = new DrawingUndoStack();

  // Drag-to-move / drag-to-resize state
  private _dragState: {
    mode: 'move' | 'resize';
    primitiveId: string;
    startPaneX: number;
    startPaneY: number;
    originalP1: AnchorPoint;
    originalP2: AnchorPoint;
    /** Which anchor is being resized (only for mode='resize') */
    resizeAnchorIndex?: number;
  } | null = null;
  /** Snapshot of dragged drawing before move/resize, for undo */
  private _dragSnapshotBefore: DrawingData | null = null;
  /** Suppress the next subscribeClick so auto-select in mousedown doesn't get toggled off */
  private _suppressNextClick = false;
  private _shiftHeld = false;
  private _chartEl: HTMLElement | null = null;
  /** Suppress wheel events during drag to prevent zoom */
  private _wheelSuppressBound: ((e: WheelEvent) => void) | null = null;

  // Event handlers (bound for unsubscribe)
  private _onClickBound: (param: MouseEventParams<Time>) => void;
  private _onCrosshairMoveBound: (param: MouseEventParams<Time>) => void;
  private _onKeyDownBound: (e: KeyboardEvent) => void;
  private _onKeyUpBound: (e: KeyboardEvent) => void;
  private _onChartMouseDownBound: (e: MouseEvent) => void;
  private _onContextMenuBound: (e: MouseEvent) => void;
  private _onDragMoveBound: (e: MouseEvent) => void;
  private _onDragEndBound: (e: MouseEvent) => void;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    callbacks: DrawingManagerCallbacks,
  ) {
    this._chart = chart;
    this._series = series;
    this._callbacks = callbacks;

    // Chart event subscriptions
    this._onClickBound = this._onClick.bind(this);
    this._onCrosshairMoveBound = this._onCrosshairMove.bind(this);
    this._chart.subscribeClick(this._onClickBound);
    this._chart.subscribeCrosshairMove(this._onCrosshairMoveBound);

    // Keyboard handler (Delete / Escape / Shift tracking)
    this._onKeyDownBound = this._onKeyDown.bind(this);
    this._onKeyUpBound = this._onKeyUp.bind(this);
    document.addEventListener('keydown', this._onKeyDownBound);
    document.addEventListener('keyup', this._onKeyUpBound);

    // Drag-to-move: intercept mousedown on chart container
    this._onChartMouseDownBound = this._onChartMouseDown.bind(this);
    this._onContextMenuBound = this._onContextMenu.bind(this);
    this._onDragMoveBound = this._onDragMove.bind(this);
    this._onDragEndBound = this._onDragEnd.bind(this);
    try {
      this._chartEl = (chart as any).chartElement?.() ?? null;
      if (this._chartEl) {
        this._chartEl.addEventListener('mousedown', this._onChartMouseDownBound, true);
        this._chartEl.addEventListener('contextmenu', this._onContextMenuBound, true);
      }
    } catch { /* chartElement not available */ }
  }

  // ══ Public API ═════════════════════════════════════════════

  get drawingMode(): DrawingMode { return this._drawingMode; }
  get selectedId(): string | null { return this._selectedId; }
  get drawingCount(): number { return this._primitives.size; }
  get drawingsVisible(): boolean { return this._drawingsVisible; }
  get isDrawing(): boolean { return this._isDrawing; }
  get magnetEnabled(): boolean { return this._magnetEnabled; }

  setMagnetEnabled(enabled: boolean): void {
    this._magnetEnabled = enabled;
  }

  setDrawingMode(mode: DrawingMode): void {
    // Cancel in-progress drawing
    this._cancelPreview();
    this._isDrawing = false;
    this._dragStart = null;

    // Deselect
    if (mode !== 'none') {
      this._setSelected(null);
    }

    this._drawingMode = mode;
    this._setCursor(mode === 'none' ? 'default' : 'crosshair');
    this._callbacks.onDrawingModeChanged(mode);
  }

  toggleDrawingsVisible(): void {
    this._drawingsVisible = !this._drawingsVisible;
    // Detach/attach all primitives to toggle visibility
    if (this._drawingsVisible) {
      this._primitives.forEach((p) => {
        this._series.attachPrimitive(p as unknown as PluginBase);
      });
    } else {
      this._primitives.forEach((p) => {
        this._series.detachPrimitive(p as unknown as PluginBase);
      });
    }
  }

  clearAllDrawings(): void {
    this._cancelPreview();

    // Snapshot all for undo
    const before = this.exportDrawings();

    this._primitives.forEach((p) => {
      try { this._series.detachPrimitive(p as unknown as PluginBase); } catch { /* already detached */ }
    });
    this._primitives.clear();
    this._selectedId = null;
    this._callbacks.onSelectedChanged(null);
    this._callbacks.onDrawingsChanged(0);

    if (before.length > 0) {
      this._undoStack.push({ type: 'clear', before, after: [] });
    }
  }

  cancelCurrentAction(): void {
    if (this._isDrawing) {
      this._cancelPreview();
      this._isDrawing = false;
      this._dragStart = null;
      return;
    }
    if (this._drawingMode !== 'none') {
      this.setDrawingMode('none');
      return;
    }
    if (this._selectedId !== null) {
      this._setSelected(null);
    }
  }

  deleteSelectedDrawing(): void {
    if (this._selectedId === null) return;
    if (this.isSelectedLocked()) return; // Can't delete locked drawings

    const before = this._snapshotDrawing(this._selectedId);
    this._removeDrawing(this._selectedId);

    if (before) {
      this._undoStack.push({ type: 'delete', before: [before], after: [] });
    }

    this._selectedId = null;
    this._callbacks.onSelectedChanged(null);
  }

  // ══ Context Menu API ═════════════════════════════════════════

  /** Get serialized data for the currently selected drawing */
  getSelectedDrawingData(): DrawingData | null {
    if (this._selectedId === null) return null;
    const p = this._primitives.get(this._selectedId);
    if (!p || !('toJSON' in p)) return null;
    const json = (p as any).toJSON();
    return this._primitiveJsonToDrawingData(json);
  }

  /** Update visual options on the selected drawing */
  updateSelectedOptions(opts: Partial<DrawingStyleOptions>): void {
    if (this._selectedId === null) return;
    const p = this._primitives.get(this._selectedId);
    if (!p || !('updateOptions' in p)) return;

    // Snapshot before for undo
    const before = this._snapshotDrawing(this._selectedId);
    (p as any).updateOptions(opts);
    const after = this._snapshotDrawing(this._selectedId);

    if (before && after) {
      this._undoStack.push({ type: 'style', before: [before], after: [after] });
    }
    this._callbacks.onDrawingsChanged(this._primitives.size);
  }

  /** Duplicate the currently selected drawing */
  duplicateSelected(): void {
    if (this._selectedId === null) return;
    const data = this.getSelectedDrawingData();
    if (!data) return;

    const newId = generateDrawingId();
    const newData = { ...data, id: newId };
    this.addDrawingFromData(newData);

    // Record as create action for undo
    const after = this._snapshotDrawing(newId);
    if (after) {
      this._undoStack.push({ type: 'create', before: [], after: [after] });
    }

    // Select the duplicate
    this._setSelected(newId);
  }

  /** Toggle lock state on the selected drawing */
  toggleLockSelected(): void {
    if (this._selectedId === null) return;
    const data = this.getSelectedDrawingData();
    if (!data) return;
    const isLocked = data.options.locked ?? false;
    this.updateSelectedOptions({ locked: !isLocked });
  }

  /** Check if the selected drawing is locked */
  isSelectedLocked(): boolean {
    const data = this.getSelectedDrawingData();
    return data?.options.locked ?? false;
  }

  // ══ Undo / Redo API ════════════════════════════════════════

  get canUndo(): boolean { return this._undoStack.canUndo; }
  get canRedo(): boolean { return this._undoStack.canRedo; }

  undo(): void {
    const action = this._undoStack.popUndo();
    if (!action) return;
    this._applyUndoAction(action);
  }

  redo(): void {
    const action = this._undoStack.popRedo();
    if (!action) return;
    this._applyRedoAction(action);
  }

  /** Add a drawing from serialized data (e.g. restore from storage) */
  addDrawingFromData(data: DrawingData): void {
    const primitive = this._createPrimitiveFromData(data);
    if (!primitive) return;
    this._primitives.set(data.id, primitive);
    if (this._drawingsVisible) {
      this._series.attachPrimitive(primitive as unknown as PluginBase);
    }
    this._callbacks.onDrawingsChanged(this._primitives.size);
  }

  /** Export all drawings as serializable data */
  exportDrawings(): DrawingData[] {
    const result: DrawingData[] = [];
    this._primitives.forEach((p) => {
      if ('toJSON' in p && typeof (p as any).toJSON === 'function') {
        const json = (p as any).toJSON();
        const data = this._primitiveJsonToDrawingData(json);
        if (data) result.push(data);
      }
    });
    return result;
  }

  /** Import drawings (non-destructive: updates existing, creates new) */
  importDrawings(drawings: DrawingData[]): void {
    this.clearAllDrawings();
    for (const d of drawings) {
      this.addDrawingFromData(d);
    }
  }

  dispose(): void {
    this._cancelPreview();

    // Clean up drag state
    if (this._dragState) {
      window.removeEventListener('mousemove', this._onDragMoveBound);
      window.removeEventListener('mouseup', this._onDragEndBound);
      this._unbindWheelSuppress();
      this._dragState = null;
    }

    // Remove keyboard listeners
    document.removeEventListener('keydown', this._onKeyDownBound);
    document.removeEventListener('keyup', this._onKeyUpBound);

    // Remove chart container listeners
    if (this._chartEl) {
      this._chartEl.removeEventListener('mousedown', this._onChartMouseDownBound, true);
      this._chartEl.removeEventListener('contextmenu', this._onContextMenuBound, true);
      this._chartEl = null;
    }

    // Remove chart subscriptions
    try { this._chart.unsubscribeClick(this._onClickBound); } catch { /* */ }
    try { this._chart.unsubscribeCrosshairMove(this._onCrosshairMoveBound); } catch { /* */ }

    // Detach all primitives
    this._primitives.forEach((p) => {
      try { this._series.detachPrimitive(p as unknown as PluginBase); } catch { /* */ }
    });
    this._primitives.clear();
  }

  // ══ Mouse handlers (from canvas overlay events) ═════════════
  // When drawingMode !== 'none', the drawing canvas has pointer-events: auto
  // and captures all mouse events. These are forwarded here.
  // subscribeClick only fires when drawingMode === 'none' (selection).

  handleMouseDown(x: number, y: number): void {
    // ── Single-click tools: create immediately on mousedown ──

    if (this._drawingMode === 'hline') {
      const price = this._series.coordinateToPrice(y as any);
      if (price === null) return;
      const id = generateDrawingId();
      const color = this._callbacks.getDrawingColor();
      const p = new HorizontalLinePrimitive(id, price as number, { lineColor: color });
      this._primitives.set(id, p);
      if (this._drawingsVisible) {
        this._series.attachPrimitive(p);
      }
      this._callbacks.onDrawingsChanged(this._primitives.size);
      // Undo: record creation
      const after = this._snapshotDrawing(id);
      if (after) this._undoStack.push({ type: 'create', before: [], after: [after] });
      return;
    }

    if (this._drawingMode === 'vline') {
      const time = this._chart.timeScale().coordinateToTime(x as any);
      if (time === null) return;
      const id = generateDrawingId();
      const color = this._callbacks.getDrawingColor();
      const p = new VerticalLinePrimitive(id, time as Time, { lineColor: color });
      this._primitives.set(id, p);
      if (this._drawingsVisible) {
        this._series.attachPrimitive(p);
      }
      this._callbacks.onDrawingsChanged(this._primitives.size);
      // Undo: record creation
      const after = this._snapshotDrawing(id);
      if (after) this._undoStack.push({ type: 'create', before: [], after: [after] });
      return;
    }

    // ── Eraser: hit-test → delete ──

    if (this._drawingMode === 'eraser') {
      const hit = this._hitTestAll(x, y);
      if (hit) {
        const before = this._snapshotDrawing(hit);
        this._removeDrawing(hit);
        if (before) this._undoStack.push({ type: 'delete', before: [before], after: [] });
      }
      return;
    }

    // ── Drag tools: start drag preview ──

    if (!DRAG_MODES.has(this._drawingMode)) return;

    const anchor = this._coordToAnchor(x, y);
    if (!anchor) return;

    this._isDrawing = true;
    this._dragStart = anchor;

    // Create preview primitive
    const color = this._callbacks.getDrawingColor();
    const previewOptions: Partial<DrawingStyleOptions> = {
      lineColor: color,
      lineStyle: 'dashed',
      fillOpacity: 0.05,
    };

    const previewId = '__preview__';
    let preview: PluginBase | null = null;

    switch (this._drawingMode) {
      case 'trendline':
        preview = new TrendLinePrimitive(previewId, anchor, anchor, previewOptions);
        break;
      case 'ray':
        preview = new RayPrimitive(previewId, anchor, anchor, previewOptions);
        break;
      case 'fib_retracement':
        preview = new FibRetracementPrimitive(previewId, anchor, anchor, previewOptions);
        break;
      case 'rect':
        preview = new RectanglePrimitive(previewId, anchor, anchor, previewOptions);
        break;
      case 'price_range':
        preview = new PriceRangePrimitive(previewId, anchor, anchor, previewOptions);
        break;
      case 'channel':
        preview = new ChannelPrimitive(previewId, anchor, anchor, 0, previewOptions);
        break;
      case 'extended_line':
        preview = new ExtendedLinePrimitive(previewId, anchor, anchor, previewOptions);
        break;
      case 'longentry':
      case 'shortentry': {
        const side = this._drawingMode === 'longentry' ? 'long' : 'short';
        const defaultRR = 2;
        const entryPrice = anchor.price;
        // Initial TP/SL at entry (will spread during drag)
        preview = new PositionPrimitive(previewId, {
          side,
          entryPrice,
          entryTime: anchor.time,
          exitTime: anchor.time,
          takeProfitPrice: entryPrice,
          stopLossPrice: entryPrice,
          quantity: 0,
        });
        break;
      }
    }

    if (preview) {
      this._previewPrimitive = preview;
      this._series.attachPrimitive(preview);
    }
  }

  handleMouseMove(x: number, y: number): void {
    if (!this._isDrawing || !this._previewPrimitive || !this._dragStart) return;

    const anchor = this._coordToAnchorConstrained(x, y, this._dragStart);
    if (!anchor) return;

    // Special handling for position preview
    if (this._previewPrimitive instanceof PositionPrimitive) {
      this._updatePositionPreview(this._previewPrimitive, anchor);
      return;
    }

    // Update preview endpoint
    const p = this._previewPrimitive as any;
    if ('updatePoints' in p) {
      p.updatePoints(this._dragStart, anchor);
    }
  }

  handleMouseUp(x: number, y: number): void {
    if (!this._isDrawing || !this._dragStart) return;

    const anchor = this._coordToAnchorConstrained(x, y, this._dragStart);
    if (!anchor) {
      this._cancelPreview();
      this._isDrawing = false;
      this._dragStart = null;
      return;
    }

    // Check minimum drag distance
    const ts = this._chart.timeScale();
    const startX = ts.timeToCoordinate(this._dragStart.time);
    const endX = ts.timeToCoordinate(anchor.time);
    const startY = this._series.priceToCoordinate(this._dragStart.price);
    const endY = this._series.priceToCoordinate(anchor.price);

    if (startX !== null && endX !== null && startY !== null && endY !== null) {
      const dist = Math.hypot(
        (endX as number) - (startX as number),
        (endY as number) - (startY as number),
      );
      if (dist < 4) {
        // Too small — cancel
        this._cancelPreview();
        this._isDrawing = false;
        this._dragStart = null;
        return;
      }
    }

    // ── Position tools: finalize from preview data ──
    if ((this._drawingMode === 'longentry' || this._drawingMode === 'shortentry') && this._previewPrimitive instanceof PositionPrimitive) {
      const previewData = this._previewPrimitive.positionData;
      this._cancelPreview();

      const id = generateDrawingId();
      const finalPrimitive = new PositionPrimitive(id, { ...previewData });
      this._primitives.set(id, finalPrimitive);
      if (this._drawingsVisible) {
        this._series.attachPrimitive(finalPrimitive as unknown as PluginBase);
      }
      this._callbacks.onDrawingsChanged(this._primitives.size);
      // Undo: record creation
      const after = this._snapshotDrawing(id);
      if (after) this._undoStack.push({ type: 'create', before: [], after: [after] });

      this._isDrawing = false;
      this._dragStart = null;

      // Position tools are not sticky
      this.setDrawingMode('none');
      return;
    }

    // Remove preview
    this._cancelPreview();

    // Create final drawing
    const id = generateDrawingId();
    const color = this._callbacks.getDrawingColor();
    const opts: Partial<DrawingStyleOptions> = { lineColor: color };

    this._createAndAttach(this._drawingMode, id, this._dragStart, anchor, opts);
    // Undo: record creation
    const afterDraw = this._snapshotDrawing(id);
    if (afterDraw) this._undoStack.push({ type: 'create', before: [], after: [afterDraw] });

    // Reset drag state
    this._isDrawing = false;
    this._dragStart = null;

    // Sticky or reset
    if (!STICKY_MODES.has(this._drawingMode)) {
      this.setDrawingMode('none');
    }
  }

  // ══ Private: Event Handlers ════════════════════════════════

  /**
   * subscribeClick fires only when drawingMode === 'none'
   * (canvas overlay has pointer-events: none in that state).
   * Used solely for selection/deselection.
   */
  private _onClick(param: MouseEventParams<Time>): void {
    if (!param.point || param.sourceEvent === undefined) return;

    // If mousedown already handled selection+drag, skip this click
    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }

    // Selection mode only
    if (this._drawingMode === 'none') {
      const hit = this._hitTestAll(param.point.x, param.point.y);
      this._setSelected(hit);
    }
  }

  private _onCrosshairMove(param: MouseEventParams<Time>): void {
    if (!param.point) {
      if (this._hoveredId !== null) {
        this._setHovered(null);
      }
      this._setCursor('default');
      return;
    }

    // Only handle hover in 'none' mode (pointer passes through canvas)
    if (this._drawingMode !== 'none') {
      this._setCursor('crosshair');
      return;
    }

    const hit = this._hitTestAll(param.point.x, param.point.y);
    if (hit !== this._hoveredId) {
      this._setHovered(hit);
    }

    // Update cursor based on hover/selection/anchor state
    if (this._dragState) {
      this._setCursor(this._dragState.mode === 'resize' ? 'crosshair' : 'grabbing');
    } else if (this._selectedId !== null) {
      // Check anchor hover on selected primitive
      const anchorHit = this._anchorHitTestSelected(param.point.x, param.point.y);
      if (anchorHit) {
        this._setCursor(anchorHit.cursorStyle);
      } else if (hit) {
        this._setCursor(this._selectedId === hit ? 'grab' : 'pointer');
      } else {
        this._setCursor('default');
      }
    } else if (hit) {
      this._setCursor('pointer');
    } else {
      this._setCursor('default');
    }
  }

  // ══ Private: Keyboard ══════════════════════════════════════

  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Shift') { this._shiftHeld = true; return; }

    // Ignore if user is typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Ctrl+Z / Cmd+Z = Undo, Ctrl+Shift+Z / Cmd+Shift+Z = Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }
    // Ctrl+Y = Redo (Windows convention)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this._selectedId !== null) {
        e.preventDefault();
        this.deleteSelectedDrawing();
      }
    } else if (e.key === 'Escape') {
      this.cancelCurrentAction();
    }
  }

  private _onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Shift') { this._shiftHeld = false; }
  }

  // ══ Private: Drag-to-Move ═════════════════════════════════

  private _onChartMouseDown(e: MouseEvent): void {
    if (this._drawingMode !== 'none') return;
    if (!this._chartEl) return;

    const rect = this._chartEl.getBoundingClientRect();
    const paneX = e.clientX - rect.left;
    const paneY = e.clientY - rect.top;

    // ── Priority 1: Anchor resize on already-selected primitive ──
    if (this._selectedId !== null) {
      // Block all interaction on locked drawings
      if (this.isSelectedLocked()) return;

      const anchorHit = this._anchorHitTestSelected(paneX, paneY);
      if (anchorHit) {
        const p = this._primitives.get(this._selectedId);
        if (p) {
          const origAnchors = this._extractAnchors(p);
          if (origAnchors) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._suppressNextClick = true;
            this._setCursor(anchorHit.cursorStyle);

            // Snapshot before resize for undo
            this._dragSnapshotBefore = this._snapshotDrawing(this._selectedId);

            this._dragState = {
              mode: 'resize',
              primitiveId: this._selectedId,
              startPaneX: paneX,
              startPaneY: paneY,
              originalP1: origAnchors.p1,
              originalP2: origAnchors.p2,
              resizeAnchorIndex: anchorHit.anchorIndex,
            };

            window.addEventListener('mousemove', this._onDragMoveBound);
            window.addEventListener('mouseup', this._onDragEndBound);
            this._bindWheelSuppress();
            return;
          }
        }
      }
    }

    // ── Priority 2: Regular hit-test → auto-select + move ──
    const hit = this._hitTestAll(paneX, paneY);
    if (!hit) return;

    // Auto-select on mousedown (enables one-click select+drag)
    if (this._selectedId !== hit) {
      this._setSelected(hit);
    }

    // Get original anchors from the selected primitive
    const p = this._primitives.get(hit);
    if (!p) return;

    const origAnchors = this._extractAnchors(p);
    if (!origAnchors) return;

    // Prevent chart from panning
    e.preventDefault();
    e.stopImmediatePropagation();

    // Block move on locked drawings
    const hitData = this.getSelectedDrawingData();
    if (hitData?.options.locked) return;

    // Suppress the subscribeClick that will fire after this mousedown
    this._suppressNextClick = true;
    this._setCursor('grabbing');

    // Snapshot before move for undo
    this._dragSnapshotBefore = this._snapshotDrawing(hit);

    this._dragState = {
      mode: 'move',
      primitiveId: hit,
      startPaneX: paneX,
      startPaneY: paneY,
      originalP1: origAnchors.p1,
      originalP2: origAnchors.p2,
    };

    window.addEventListener('mousemove', this._onDragMoveBound);
    window.addEventListener('mouseup', this._onDragEndBound);
    this._bindWheelSuppress();
  }

  /** Extract p1/p2 anchors from a primitive's toJSON */
  private _extractAnchors(p: any): { p1: AnchorPoint; p2: AnchorPoint } | null {
    const json = 'toJSON' in p && typeof p.toJSON === 'function' ? p.toJSON() : null;
    if (!json) return null;

    if (json.type === 'hline') {
      return {
        p1: { time: 0 as unknown as Time, price: json.price },
        p2: { time: 0 as unknown as Time, price: json.price },
      };
    } else if (json.type === 'vline') {
      return {
        p1: { time: json.time, price: 0 },
        p2: { time: json.time, price: 0 },
      };
    } else if (json.type === 'position') {
      return {
        p1: { time: json.entryTime, price: json.entryPrice },
        p2: { time: json.exitTime, price: json.entryPrice },
      };
    } else if (json.p1 && json.p2) {
      return { p1: { ...json.p1 }, p2: { ...json.p2 } };
    }
    return null;
  }

  /** Anchor hit-test on the currently selected primitive */
  private _anchorHitTestSelected(x: number, y: number): AnchorHitResult | null {
    if (this._selectedId === null) return null;
    const p = this._primitives.get(this._selectedId);
    if (!p) return null;
    if ('anchorHitTest' in p && typeof (p as any).anchorHitTest === 'function') {
      return (p as any).anchorHitTest(x, y) as AnchorHitResult | null;
    }
    return null;
  }

  private _onDragMove(e: MouseEvent): void {
    if (!this._dragState || !this._chartEl) return;

    const rect = this._chartEl.getBoundingClientRect();
    const paneX = e.clientX - rect.left;
    const paneY = e.clientY - rect.top;

    const p = this._primitives.get(this._dragState.primitiveId);
    if (!p) return;

    // ── Resize mode: move only the targeted anchor ──
    if (this._dragState.mode === 'resize') {
      this._handleResizeDrag(p, paneX, paneY);
      return;
    }

    // ── Move mode: translate entire drawing ──
    const dx = paneX - this._dragState.startPaneX;
    const dy = paneY - this._dragState.startPaneY;

    const { originalP1, originalP2 } = this._dragState;
    const json = (p as any).toJSON?.();
    if (!json) return;

    if (json.type === 'hline') {
      const origY = this._series.priceToCoordinate(originalP1.price);
      if (origY === null) return;
      const newPrice = this._series.coordinateToPrice((origY as number + dy) as any);
      if (newPrice === null) return;
      (p as any).updatePrice(newPrice as number);
    } else if (json.type === 'vline') {
      const origX = this._chart.timeScale().timeToCoordinate(originalP1.time);
      if (origX === null) return;
      const newTime = this._chart.timeScale().coordinateToTime((origX as number + dx) as any);
      if (newTime === null) return;
      (p as any).updateTime(newTime as Time);
    } else {
      const origP1X = this._chart.timeScale().timeToCoordinate(originalP1.time);
      const origP1Y = this._series.priceToCoordinate(originalP1.price);
      const origP2X = this._chart.timeScale().timeToCoordinate(originalP2.time);
      const origP2Y = this._series.priceToCoordinate(originalP2.price);

      if (origP1X === null || origP1Y === null || origP2X === null || origP2Y === null) return;

      const newP1 = this._coordToAnchor(
        (origP1X as number) + dx,
        (origP1Y as number) + dy,
      );
      const newP2 = this._coordToAnchor(
        (origP2X as number) + dx,
        (origP2Y as number) + dy,
      );

      if (!newP1 || !newP2) return;
      (p as any).updatePoints(newP1, newP2);
    }
  }

  /** Handle resize drag: move only the targeted anchor point */
  private _handleResizeDrag(p: any, paneX: number, paneY: number): void {
    if (!this._dragState || this._dragState.mode !== 'resize') return;

    const anchorIdx = this._dragState.resizeAnchorIndex ?? 0;
    // Constrain relative to the fixed anchor (the one NOT being resized)
    const fixedAnchor = anchorIdx === 0 ? this._dragState.originalP2 : this._dragState.originalP1;
    const newAnchor = this._coordToAnchorConstrained(paneX, paneY, fixedAnchor);
    if (!newAnchor) return;

    const json = p.toJSON?.();
    if (!json) return;

    // ── hline: resize = change price ──
    if (json.type === 'hline') {
      p.updatePrice(newAnchor.price);
      return;
    }

    // ── vline: resize = change time ──
    if (json.type === 'vline') {
      p.updateTime(newAnchor.time);
      return;
    }

    // ── position: 3 anchors (entry=0, TP=1, SL=2) ──
    if (json.type === 'position' && p instanceof PositionPrimitive) {
      const data = p.positionData;
      if (anchorIdx === 0) {
        // Move entry → TP and SL move by same delta
        const entryDelta = newAnchor.price - data.entryPrice;
        p.updatePrices(newAnchor.price, data.takeProfitPrice + entryDelta, data.stopLossPrice + entryDelta);
      } else if (anchorIdx === 1) {
        // Move TP only
        p.updatePrices(data.entryPrice, newAnchor.price, data.stopLossPrice);
      } else if (anchorIdx === 2) {
        // Move SL only
        p.updatePrices(data.entryPrice, data.takeProfitPrice, newAnchor.price);
      }
      return;
    }

    // ── 2-point primitives: move only the targeted anchor ──
    if ('updatePoints' in p) {
      const { originalP1, originalP2 } = this._dragState;
      if (anchorIdx === 0) {
        p.updatePoints(newAnchor, originalP2);
      } else {
        p.updatePoints(originalP1, newAnchor);
      }
    }
  }

  private _onDragEnd(_e: MouseEvent): void {
    // Record undo action for the completed move/resize
    if (this._dragState && this._dragSnapshotBefore) {
      const after = this._snapshotDrawing(this._dragState.primitiveId);
      if (after) {
        const actionType = this._dragState.mode === 'resize' ? 'resize' : 'move';
        this._undoStack.push({
          type: actionType,
          before: [this._dragSnapshotBefore],
          after: [after],
        });
      }
      this._callbacks.onDrawingsChanged(this._primitives.size);
    }
    this._dragSnapshotBefore = null;
    this._dragState = null;
    this._setCursor('default');
    window.removeEventListener('mousemove', this._onDragMoveBound);
    window.removeEventListener('mouseup', this._onDragEndBound);
    this._unbindWheelSuppress();
  }

  /** Bind wheel event suppression during drag to prevent zoom */
  private _bindWheelSuppress(): void {
    if (this._wheelSuppressBound || !this._chartEl) return;
    this._wheelSuppressBound = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    this._chartEl.addEventListener('wheel', this._wheelSuppressBound, { passive: false });
  }

  /** Unbind wheel event suppression */
  private _unbindWheelSuppress(): void {
    if (!this._wheelSuppressBound || !this._chartEl) return;
    this._chartEl.removeEventListener('wheel', this._wheelSuppressBound);
    this._wheelSuppressBound = null;
  }

  /** Set cursor on the chart container element */
  private _setCursor(cursor: string): void {
    if (!this._chartEl) return;
    this._chartEl.style.cursor = cursor;
  }

  // ══ Private: Context Menu ════════════════════════════════════

  private _onContextMenu(e: MouseEvent): void {
    if (this._drawingMode !== 'none') return;
    if (!this._chartEl) return;

    const rect = this._chartEl.getBoundingClientRect();
    const paneX = e.clientX - rect.left;
    const paneY = e.clientY - rect.top;

    // Only show menu if right-clicking on a drawing
    const hit = this._hitTestAll(paneX, paneY);
    if (!hit) return;

    e.preventDefault();
    e.stopPropagation();

    // Auto-select the drawing
    if (this._selectedId !== hit) {
      this._setSelected(hit);
    }

    this._callbacks.onContextMenu?.(e.clientX, e.clientY, hit);
  }

  // ══ Private: Undo/Redo Helpers ═════════════════════════════

  /** Snapshot a single drawing by id */
  private _snapshotDrawing(id: string): DrawingData | null {
    const p = this._primitives.get(id);
    if (!p || !('toJSON' in p)) return null;
    const json = (p as any).toJSON();
    return this._primitiveJsonToDrawingData(json);
  }

  /** Apply an undo action (reverse: after → before) */
  private _applyUndoAction(action: DrawingAction): void {
    switch (action.type) {
      case 'create':
        // Undo create = delete
        for (const d of action.after) {
          this._removeDrawing(d.id);
        }
        break;
      case 'delete':
        // Undo delete = re-create
        for (const d of action.before) {
          this.addDrawingFromData(d);
        }
        break;
      case 'move':
      case 'resize':
      case 'style':
        // Restore before state
        for (const d of action.before) {
          this._restoreDrawingState(d);
        }
        break;
      case 'clear':
        // Restore all drawings
        for (const d of action.before) {
          this.addDrawingFromData(d);
        }
        break;
    }
    this._setSelected(null);
    this._callbacks.onDrawingsChanged(this._primitives.size);
  }

  /** Apply a redo action (forward: before → after) */
  private _applyRedoAction(action: DrawingAction): void {
    switch (action.type) {
      case 'create':
        // Redo create = re-create
        for (const d of action.after) {
          this.addDrawingFromData(d);
        }
        break;
      case 'delete':
        // Redo delete = delete again
        for (const d of action.before) {
          this._removeDrawing(d.id);
        }
        break;
      case 'move':
      case 'resize':
      case 'style':
        // Restore after state
        for (const d of action.after) {
          this._restoreDrawingState(d);
        }
        break;
      case 'clear':
        // Re-clear: remove all drawings in before list
        for (const d of action.before) {
          this._removeDrawing(d.id);
        }
        break;
    }
    this._setSelected(null);
    this._callbacks.onDrawingsChanged(this._primitives.size);
  }

  /** Restore a drawing to a specific state (remove + re-create) */
  private _restoreDrawingState(data: DrawingData): void {
    // Remove existing if present
    const existing = this._primitives.get(data.id);
    if (existing) {
      try { this._series.detachPrimitive(existing as unknown as PluginBase); } catch { /* */ }
      this._primitives.delete(data.id);
    }
    // Re-create from data
    const primitive = this._createPrimitiveFromData(data);
    if (primitive) {
      this._primitives.set(data.id, primitive);
      if (this._drawingsVisible) {
        this._series.attachPrimitive(primitive as unknown as PluginBase);
      }
    }
  }

  // ══ Private: Position Preview ═══════════════════════════════

  private _updatePositionPreview(preview: PositionPrimitive, cursor: AnchorPoint): void {
    if (!this._dragStart) return;

    const entryPrice = this._dragStart.price;
    const cursorPrice = cursor.price;
    const side = preview.positionData.side;
    const defaultRR = 2;

    // SL is where the cursor is; TP is calculated from RR
    let slPrice: number;
    let tpPrice: number;

    if (side === 'long') {
      // Long: SL below entry, TP above
      slPrice = Math.min(cursorPrice, entryPrice - 0.0001);
      const risk = entryPrice - slPrice;
      tpPrice = entryPrice + risk * defaultRR;
    } else {
      // Short: SL above entry, TP below
      slPrice = Math.max(cursorPrice, entryPrice + 0.0001);
      const risk = slPrice - entryPrice;
      tpPrice = entryPrice - risk * defaultRR;
    }

    preview.updatePrices(entryPrice, tpPrice, slPrice);
    preview.updateTimes(this._dragStart.time, cursor.time);
  }

  // ══ Private: Helpers ═══════════════════════════════════════

  /**
   * Convert pixel coords to anchor, optionally applying Shift constraint
   * relative to an origin anchor.
   */
  private _coordToAnchorConstrained(x: number, y: number, origin?: AnchorPoint): AnchorPoint | null {
    const anchor = this._coordToAnchor(x, y);
    if (!anchor || !origin || !this._shiftHeld) return anchor;

    // Get origin pixel coords
    const originPxX = this._chart.timeScale().timeToCoordinate(origin.time);
    const originPxY = this._series.priceToCoordinate(origin.price);
    if (originPxX === null || originPxY === null) return anchor;

    return constrainAnchor(
      origin, anchor,
      { x: originPxX as number, y: originPxY as number },
      { x, y },
    );
  }

  private _coordToAnchor(x: number, y: number): AnchorPoint | null {
    try {
      const time = this._chart.timeScale().coordinateToTime(x as any);
      const price = this._series.coordinateToPrice(y as any);
      if (time === null || price === null) return null;

      // ── Magnet snap to nearest OHLC value ──
      if (this._magnetEnabled && this._callbacks.getKlines) {
        const snapped = this._magnetSnap(time as Time, price as number, y);
        if (snapped) return snapped;
      }

      return { time: time as Time, price: price as number };
    } catch {
      return null;
    }
  }

  /** Snap price to the nearest OHLC value of the candle at the given time */
  private _magnetSnap(time: Time, price: number, pixelY: number): AnchorPoint | null {
    const klines = this._callbacks.getKlines?.();
    if (!klines || klines.length === 0) return null;

    // Find the candle closest to this time
    const timeNum = time as unknown as number;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = klines.length - 1; i >= 0; i--) {
      const d = Math.abs((klines[i].time as number) - timeNum);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
      // Early exit if we're moving further away
      if (d > bestDist) break;
    }
    if (bestIdx < 0) return null;

    const candle = klines[bestIdx];
    const ohlcValues = [candle.open, candle.high, candle.low, candle.close];

    // Find the OHLC value closest in pixel space (not price space)
    const SNAP_THRESHOLD_PX = 12;
    let bestPrice = price;
    let bestPxDist = Infinity;

    for (const val of ohlcValues) {
      const valY = this._series.priceToCoordinate(val);
      if (valY === null) continue;
      const pxDist = Math.abs(pixelY - (valY as number));
      if (pxDist < bestPxDist) {
        bestPxDist = pxDist;
        bestPrice = val;
      }
    }

    // Only snap if within threshold
    if (bestPxDist <= SNAP_THRESHOLD_PX) {
      return { time: candle.time as Time, price: bestPrice };
    }

    return null;
  }

  private _hitTestAll(x: number, y: number): string | null {
    // Reverse order (most recently added on top)
    const entries = Array.from(this._primitives.entries()).reverse();
    for (const [id, p] of entries) {
      if ('hitTest' in p && typeof (p as any).hitTest === 'function') {
        const result = (p as any).hitTest(x, y);
        if (result) return id;
      }
    }
    return null;
  }

  private _setSelected(id: string | null): void {
    if (this._selectedId === id) return;

    if (this._selectedId !== null) {
      const prev = this._primitives.get(this._selectedId);
      prev?.setSelected(false);
    }

    this._selectedId = id;
    if (id !== null) {
      const next = this._primitives.get(id);
      next?.setSelected(true);
    }

    this._callbacks.onSelectedChanged(id);
  }

  private _setHovered(id: string | null): void {
    if (this._hoveredId === id) return;

    if (this._hoveredId !== null) {
      const prev = this._primitives.get(this._hoveredId);
      prev?.setHovered(false);
    }

    this._hoveredId = id;
    if (id !== null) {
      const next = this._primitives.get(id);
      next?.setHovered(true);
    }
  }

  private _removeDrawing(id: string): void {
    const p = this._primitives.get(id);
    if (p) {
      try { this._series.detachPrimitive(p as unknown as PluginBase); } catch { /* */ }
      this._primitives.delete(id);
      this._callbacks.onDrawingsChanged(this._primitives.size);
    }
  }

  private _cancelPreview(): void {
    if (this._previewPrimitive) {
      try { this._series.detachPrimitive(this._previewPrimitive); } catch { /* */ }
      this._previewPrimitive = null;
    }
  }

  private _createAndAttach(
    mode: DrawingMode,
    id: string,
    p1: AnchorPoint,
    p2: AnchorPoint,
    opts: Partial<DrawingStyleOptions>,
  ): void {
    let primitive: (PluginBase & { id: string; setSelected: (s: boolean) => void; setHovered: (h: boolean) => void }) | null = null;

    switch (mode) {
      case 'trendline':
        primitive = new TrendLinePrimitive(id, p1, p2, opts);
        break;
      case 'ray':
        primitive = new RayPrimitive(id, p1, p2, opts);
        break;
      case 'fib_retracement':
        primitive = new FibRetracementPrimitive(id, p1, p2, opts);
        break;
      case 'rect':
        primitive = new RectanglePrimitive(id, p1, p2, opts);
        break;
      case 'price_range':
        primitive = new PriceRangePrimitive(id, p1, p2, opts);
        break;
      case 'channel':
        primitive = new ChannelPrimitive(id, p1, p2, undefined, opts);
        break;
      case 'extended_line':
        primitive = new ExtendedLinePrimitive(id, p1, p2, opts);
        break;
    }

    if (primitive) {
      this._primitives.set(id, primitive);
      if (this._drawingsVisible) {
        this._series.attachPrimitive(primitive as unknown as PluginBase);
      }
      this._callbacks.onDrawingsChanged(this._primitives.size);
    }
  }

  private _createPrimitiveFromData(data: DrawingData): (PluginBase & { id: string; setSelected: (s: boolean) => void; setHovered: (h: boolean) => void }) | null {
    const { id, type, anchors, options } = data;

    switch (type) {
      case 'hline':
        return anchors[0] ? new HorizontalLinePrimitive(id, anchors[0].price, options) : null;
      case 'vline':
        return anchors[0] ? new VerticalLinePrimitive(id, anchors[0].time, options) : null;
      case 'trendline':
        return anchors[0] && anchors[1] ? new TrendLinePrimitive(id, anchors[0], anchors[1], options) : null;
      case 'ray':
        return anchors[0] && anchors[1] ? new RayPrimitive(id, anchors[0], anchors[1], options) : null;
      case 'fib_retracement':
        return anchors[0] && anchors[1] ? new FibRetracementPrimitive(id, anchors[0], anchors[1], options) : null;
      case 'rect':
        return anchors[0] && anchors[1] ? new RectanglePrimitive(id, anchors[0], anchors[1], options) : null;
      case 'price_range':
        return anchors[0] && anchors[1] ? new PriceRangePrimitive(id, anchors[0], anchors[1], options) : null;
      case 'position':
        return data.positionData ? new PositionPrimitive(id, data.positionData, data.positionStyle) : null;
      case 'extended_line':
        return anchors[0] && anchors[1] ? new ExtendedLinePrimitive(id, anchors[0], anchors[1], options) : null;
      case 'channel':
        return anchors[0] && anchors[1] ? new ChannelPrimitive(id, anchors[0], anchors[1], undefined, options) : null;
      default:
        return null;
    }
  }

  private _primitiveJsonToDrawingData(json: any): DrawingData | null {
    if (!json || !json.id || !json.type) return null;

    const type = json.type as DrawingData['type'];
    const options = json.options ?? { ...DEFAULT_DRAWING_STYLE };
    let anchors: AnchorPoint[] = [];

    switch (type) {
      case 'hline':
        anchors = [{ time: 0 as unknown as Time, price: json.price ?? 0 }];
        break;
      case 'vline':
        anchors = [{ time: json.time ?? (0 as unknown as Time), price: 0 }];
        break;
      case 'position':
        anchors = [
          { time: json.entryTime, price: json.entryPrice ?? 0 },
          { time: json.exitTime, price: json.entryPrice ?? 0 },
        ];
        return {
          id: json.id, type, anchors, options,
          positionData: {
            side: json.side ?? 'long',
            entryPrice: json.entryPrice ?? 0,
            entryTime: json.entryTime,
            exitTime: json.exitTime,
            takeProfitPrice: json.takeProfitPrice ?? 0,
            stopLossPrice: json.stopLossPrice ?? 0,
            quantity: json.quantity ?? 0,
          },
          positionStyle: json.style,
        };
      default:
        if (json.p1 && json.p2) {
          anchors = [json.p1, json.p2];
        }
        break;
    }

    return { id: json.id, type, anchors, options };
  }
}
