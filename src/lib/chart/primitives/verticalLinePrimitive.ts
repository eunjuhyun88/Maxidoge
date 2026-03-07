// ═══════════════════════════════════════════════════════════════
// Stockclaw — Vertical Line Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Full-height vertical line at a given time.

import type {
  Coordinate,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitiveAxisView,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
  Time,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import { PluginBase } from './pluginBase';
import {
  type DrawingStyleOptions,
  type SelectionState,
  DEFAULT_DRAWING_STYLE,
  DEFAULT_SELECTION,
  HIT_THRESHOLD,
  ANCHOR_HIT_RADIUS,
  positionsLine,
  applyLineStyle,
  drawAnchorCircle,
  type AnchorHitResult,
} from './drawingPrimitiveTypes';

// ── Renderer ─────────────────────────────────────────────────

class VLinePaneRenderer implements IPrimitivePaneRenderer {
  private _x: Coordinate | null;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;

  constructor(x: Coordinate | null, options: DrawingStyleOptions, selection: SelectionState) {
    this._x = x;
    this._options = options;
    this._selection = selection;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this._x === null) return;

      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const height = scope.bitmapSize.height;

      const pos = positionsLine(this._x, hr, this._selection.hovered ? this._options.lineWidth + 1 : this._options.lineWidth);

      applyLineStyle(ctx, this._options.lineStyle, hr);
      ctx.fillStyle = this._options.lineColor;
      ctx.fillRect(pos.position, 0, pos.length, height);
      ctx.setLineDash([]);

      // Anchor circles at edges (always visible)
      const xScaled = Math.round(this._x * hr);
      drawAnchorCircle(ctx, xScaled, Math.round(30 * vr), hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, xScaled, height - Math.round(30 * vr), hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── Time Axis Label ──────────────────────────────────────────

class VLineTimeAxisView implements ISeriesPrimitiveAxisView {
  private _source: VerticalLinePrimitive;

  constructor(source: VerticalLinePrimitive) {
    this._source = source;
  }

  coordinate(): number {
    try {
      return this._source.chart.timeScale().timeToCoordinate(this._source.time) ?? -1000;
    } catch {
      return -1000;
    }
  }

  text(): string {
    const t = this._source.time;
    if (typeof t === 'number') {
      const d = new Date(t * 1000);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return String(t);
  }

  textColor(): string {
    return this._source.options.labelTextColor ?? '#d1d4dc';
  }

  backColor(): string {
    return this._source.options.lineColor;
  }

  visible(): boolean {
    return this._source.options.showLabels ?? true;
  }
}

// ── PaneView ─────────────────────────────────────────────────

class VLinePaneView implements IPrimitivePaneView {
  private _source: VerticalLinePrimitive;
  private _x: Coordinate | null = null;

  constructor(source: VerticalLinePrimitive) {
    this._source = source;
  }

  update(): void {
    this._x = this._source.chart.timeScale().timeToCoordinate(this._source.time);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return new VLinePaneRenderer(this._x, this._source.options, this._source.selection);
  }

  get viewX(): Coordinate | null {
    return this._x;
  }
}

// ── Primitive ────────────────────────────────────────────────

export class VerticalLinePrimitive extends PluginBase {
  private _id: string;
  private _time: Time;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: VLinePaneView;
  private _timeAxisView: VLineTimeAxisView;

  constructor(id: string, time: Time, options?: Partial<DrawingStyleOptions>) {
    super();
    this._id = id;
    this._time = time;
    this._options = { ...DEFAULT_DRAWING_STYLE, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new VLinePaneView(this);
    this._timeAxisView = new VLineTimeAxisView(this);
  }

  get id(): string { return this._id; }
  get time(): Time { return this._time; }
  get options(): DrawingStyleOptions { return this._options; }
  get selection(): SelectionState { return this._selection; }

  setSelected(selected: boolean): void {
    this._selection.selected = selected;
    this.requestUpdate();
  }

  setHovered(hovered: boolean): void {
    this._selection.hovered = hovered;
    this.requestUpdate();
  }

  updateTime(time: Time): void {
    this._time = time;
    this.requestUpdate();
  }

  updateOptions(options: Partial<DrawingStyleOptions>): void {
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  // ── ISeriesPrimitive ─────────────────────────────
  updateAllViews(): void {
    this._paneView.update();
  }

  paneViews(): IPrimitivePaneView[] {
    return [this._paneView];
  }

  timeAxisViews(): ISeriesPrimitiveAxisView[] {
    return [this._timeAxisView];
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const viewX = this._paneView.viewX;
    if (viewX === null) return null;

    if (Math.abs(x - (viewX as number)) <= HIT_THRESHOLD) {
      return {
        cursorStyle: this._selection.selected ? 'ew-resize' : 'pointer',
        externalId: this._id,
        zOrder: 'top',
      };
    }
    return null;
  }

  anchorHitTest(x: number, y: number): AnchorHitResult | null {
    const viewX = this._paneView.viewX;
    if (viewX === null) return null;
    if (Math.abs(x - (viewX as number)) <= ANCHOR_HIT_RADIUS) {
      return { anchorIndex: 0, cursorStyle: 'ew-resize' };
    }
    return null;
  }

  toJSON() {
    return {
      id: this._id,
      type: 'vline' as const,
      time: this._time,
      options: { ...this._options },
    };
  }
}
