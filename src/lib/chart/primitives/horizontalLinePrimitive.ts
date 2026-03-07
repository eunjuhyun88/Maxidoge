// ═══════════════════════════════════════════════════════════════
// Stockclaw — Horizontal Line Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Full-width horizontal line at a given price level.

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

class HLinePaneRenderer implements IPrimitivePaneRenderer {
  private _y: Coordinate | null;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;

  constructor(y: Coordinate | null, options: DrawingStyleOptions, selection: SelectionState) {
    this._y = y;
    this._options = options;
    this._selection = selection;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this._y === null) return;

      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const width = scope.bitmapSize.width;

      const pos = positionsLine(this._y, vr, this._selection.hovered ? this._options.lineWidth + 1 : this._options.lineWidth);

      applyLineStyle(ctx, this._options.lineStyle, hr);
      ctx.fillStyle = this._options.lineColor;
      ctx.fillRect(0, pos.position, width, pos.length);
      ctx.setLineDash([]);

      // Anchor circles at edges (always visible)
      const yScaled = Math.round(this._y * vr);
      drawAnchorCircle(ctx, Math.round(40 * hr), yScaled, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, width - Math.round(40 * hr), yScaled, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── Price Axis Label ─────────────────────────────────────────

class HLinePriceAxisView implements ISeriesPrimitiveAxisView {
  private _source: HorizontalLinePrimitive;

  constructor(source: HorizontalLinePrimitive) {
    this._source = source;
  }

  coordinate(): number {
    try {
      return this._source.series.priceToCoordinate(this._source.price) ?? -1000;
    } catch {
      return -1000;
    }
  }

  text(): string {
    return this._source.price.toFixed(2);
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

class HLinePaneView implements IPrimitivePaneView {
  private _source: HorizontalLinePrimitive;
  private _y: Coordinate | null = null;

  constructor(source: HorizontalLinePrimitive) {
    this._source = source;
  }

  update(): void {
    this._y = this._source.series.priceToCoordinate(this._source.price);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return new HLinePaneRenderer(this._y, this._source.options, this._source.selection);
  }

  get viewY(): Coordinate | null {
    return this._y;
  }
}

// ── Primitive ────────────────────────────────────────────────

export class HorizontalLinePrimitive extends PluginBase {
  private _id: string;
  private _price: number;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: HLinePaneView;
  private _priceAxisView: HLinePriceAxisView;

  constructor(id: string, price: number, options?: Partial<DrawingStyleOptions>) {
    super();
    this._id = id;
    this._price = price;
    this._options = { ...DEFAULT_DRAWING_STYLE, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new HLinePaneView(this);
    this._priceAxisView = new HLinePriceAxisView(this);
  }

  get id(): string { return this._id; }
  get price(): number { return this._price; }
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

  updatePrice(price: number): void {
    this._price = price;
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

  priceAxisViews(): ISeriesPrimitiveAxisView[] {
    return [this._priceAxisView];
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const viewY = this._paneView.viewY;
    if (viewY === null) return null;

    if (Math.abs(y - (viewY as number)) <= HIT_THRESHOLD) {
      return {
        cursorStyle: this._selection.selected ? 'ns-resize' : 'pointer',
        externalId: this._id,
        zOrder: 'top',
      };
    }
    return null;
  }

  anchorHitTest(x: number, y: number): AnchorHitResult | null {
    const viewY = this._paneView.viewY;
    if (viewY === null) return null;
    if (Math.abs(y - (viewY as number)) <= ANCHOR_HIT_RADIUS) {
      return { anchorIndex: 0, cursorStyle: 'ns-resize' };
    }
    return null;
  }

  toJSON() {
    return {
      id: this._id,
      type: 'hline' as const,
      price: this._price,
      options: { ...this._options },
    };
  }
}
