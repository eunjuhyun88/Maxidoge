// ═══════════════════════════════════════════════════════════════
// Stockclaw — Price Range Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Vertical price measurement tool showing price diff & percentage.

import type {
  Coordinate,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
  Time,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import { PluginBase } from './pluginBase';
import {
  type AnchorPoint,
  type DrawingStyleOptions,
  type SelectionState,
  type ViewPoint,
  DEFAULT_DRAWING_STYLE,
  DEFAULT_SELECTION,
  HIT_THRESHOLD,
  isPointInBBox,
  drawAnchorCircle,
  colorWithAlpha,
} from './drawingPrimitiveTypes';

// ── Renderer ─────────────────────────────────────────────────

class PriceRangeRenderer implements IPrimitivePaneRenderer {
  private _p1: ViewPoint;
  private _p2: ViewPoint;
  private _price1: number;
  private _price2: number;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;

  constructor(
    p1: ViewPoint, p2: ViewPoint,
    price1: number, price2: number,
    options: DrawingStyleOptions, selection: SelectionState,
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._price1 = price1;
    this._price2 = price2;
    this._options = options;
    this._selection = selection;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this._p1.x === null || this._p1.y === null || this._p2.x === null || this._p2.y === null) return;

      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      const x1 = Math.round((this._p1.x as number) * hr);
      const y1 = Math.round((this._p1.y as number) * vr);
      const x2 = Math.round((this._p2.x as number) * hr);
      const y2 = Math.round((this._p2.y as number) * vr);

      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);

      // Determine up or down
      const diff = this._price2 - this._price1;
      const pct = this._price1 !== 0 ? (diff / this._price1) * 100 : 0;
      const isUp = diff >= 0;
      const color = isUp ? '#26a69a' : '#ef5350';

      // Shaded region
      ctx.fillStyle = colorWithAlpha(color, 0.12);
      ctx.fillRect(left, top, w, h);

      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 * hr;
      ctx.strokeRect(left, top, w, h);

      // Connecting vertical line
      const midX = (x1 + x2) / 2;
      ctx.beginPath();
      ctx.setLineDash([3 * hr, 3 * hr]);
      ctx.moveTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      const labelX = Math.max(x1, x2) + Math.round(6 * hr);
      const labelY = (y1 + y2) / 2;
      const sign = diff >= 0 ? '+' : '';
      const label = `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;

      ctx.font = `bold ${Math.round(11 * hr)}px "JetBrains Mono", monospace`;
      const textMetrics = ctx.measureText(label);
      const padding = 4 * hr;

      // Label background
      ctx.fillStyle = colorWithAlpha('#131722', 0.9);
      ctx.fillRect(
        labelX - padding,
        labelY - 7 * vr,
        textMetrics.width + padding * 2,
        14 * vr,
      );

      // Label text
      ctx.fillStyle = color;
      ctx.fillText(label, labelX, labelY + 4 * vr);

      // Anchor circles at p1 and p2 (always visible)
      drawAnchorCircle(ctx, x1, y1, hr, color, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, x2, y2, hr, color, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── PaneView ─────────────────────────────────────────────────

class PriceRangePaneView implements IPrimitivePaneView {
  private _source: PriceRangePrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };

  constructor(source: PriceRangePrimitive) { this._source = source; }

  update(): void {
    const s = this._source.series;
    const ts = this._source.chart.timeScale();
    this._p1 = { x: ts.timeToCoordinate(this._source.p1.time), y: s.priceToCoordinate(this._source.p1.price) };
    this._p2 = { x: ts.timeToCoordinate(this._source.p2.time), y: s.priceToCoordinate(this._source.p2.price) };
  }

  zOrder(): PrimitivePaneViewZOrder { return 'top'; }

  renderer(): IPrimitivePaneRenderer {
    return new PriceRangeRenderer(this._p1, this._p2, this._source.p1.price, this._source.p2.price, this._source.options, this._source.selection);
  }

  get viewP1(): ViewPoint { return this._p1; }
  get viewP2(): ViewPoint { return this._p2; }
}

// ── Primitive ────────────────────────────────────────────────

export class PriceRangePrimitive extends PluginBase {
  private _id: string;
  private _p1: AnchorPoint;
  private _p2: AnchorPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: PriceRangePaneView;

  constructor(id: string, p1: AnchorPoint, p2: AnchorPoint, options?: Partial<DrawingStyleOptions>) {
    super();
    this._id = id;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...DEFAULT_DRAWING_STYLE, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new PriceRangePaneView(this);
  }

  get id(): string { return this._id; }
  get p1(): AnchorPoint { return this._p1; }
  get p2(): AnchorPoint { return this._p2; }
  get options(): DrawingStyleOptions { return this._options; }
  get selection(): SelectionState { return this._selection; }

  setSelected(s: boolean): void { this._selection.selected = s; this.requestUpdate(); }
  setHovered(h: boolean): void { this._selection.hovered = h; this.requestUpdate(); }

  updatePoints(p1: AnchorPoint, p2: AnchorPoint): void {
    this._p1 = p1; this._p2 = p2; this.requestUpdate();
  }

  updateOptions(o: Partial<DrawingStyleOptions>): void {
    this._options = { ...this._options, ...o }; this.requestUpdate();
  }

  updateAllViews(): void { this._paneView.update(); }
  paneViews(): IPrimitivePaneView[] { return [this._paneView]; }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const vp1 = this._paneView.viewP1;
    const vp2 = this._paneView.viewP2;
    if (vp1.x === null || vp1.y === null || vp2.x === null || vp2.y === null) return null;

    if (isPointInBBox(x, y, vp1.x as number, vp1.y as number, vp2.x as number, vp2.y as number, HIT_THRESHOLD)) {
      return { cursorStyle: 'pointer', externalId: this._id, zOrder: 'top' };
    }
    return null;
  }

  toJSON() {
    return { id: this._id, type: 'price_range' as const, p1: { ...this._p1 }, p2: { ...this._p2 }, options: { ...this._options } };
  }
}
