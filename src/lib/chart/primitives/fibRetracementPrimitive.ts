// ═══════════════════════════════════════════════════════════════
// Stockclaw — Fibonacci Retracement Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// 7-level retracement lines between two anchor prices.

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

// ── Fibonacci levels & colors ────────────────────────────────

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = [
  '#787b86', // 0
  '#f44336', // 0.236
  '#ff9800', // 0.382
  '#4caf50', // 0.5
  '#2196f3', // 0.618
  '#9c27b0', // 0.786
  '#787b86', // 1
];

// ── Renderer ─────────────────────────────────────────────────

class FibRenderer implements IPrimitivePaneRenderer {
  private _p1: ViewPoint;
  private _p2: ViewPoint;
  private _price1: number;
  private _price2: number;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _levelYs: (Coordinate | null)[];

  constructor(
    p1: ViewPoint,
    p2: ViewPoint,
    price1: number,
    price2: number,
    options: DrawingStyleOptions,
    selection: SelectionState,
    levelYs: (Coordinate | null)[],
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._price1 = price1;
    this._price2 = price2;
    this._options = options;
    this._selection = selection;
    this._levelYs = levelYs;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this._p1.x === null || this._p2.x === null) return;

      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const cw = scope.bitmapSize.width;

      const x1 = Math.round((this._p1.x as number) * hr);
      const x2 = Math.round((this._p2.x as number) * hr);
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const priceDiff = this._price1 - this._price2;

      // Draw each fibonacci level
      for (let i = 0; i < FIB_LEVELS.length; i++) {
        const y = this._levelYs[i];
        if (y === null) continue;

        const yScaled = Math.round((y as number) * vr);
        const color = FIB_COLORS[i] ?? this._options.lineColor;
        const level = FIB_LEVELS[i];
        const levelPrice = this._price2 + priceDiff * level;

        // Fill between current and next level
        if (i < FIB_LEVELS.length - 1) {
          const nextY = this._levelYs[i + 1];
          if (nextY !== null) {
            const nextYScaled = Math.round((nextY as number) * vr);
            ctx.fillStyle = colorWithAlpha(color, 0.06);
            ctx.fillRect(left, Math.min(yScaled, nextYScaled), right - left, Math.abs(nextYScaled - yScaled));
          }
        }

        // Level line (bounded to drawn area)
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 * hr;
        ctx.moveTo(left, yScaled);
        ctx.lineTo(right, yScaled);
        ctx.stroke();

        // Label
        ctx.font = `${Math.round(10 * hr)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = color;
        const label = `${level.toFixed(3)} (${levelPrice.toFixed(2)})`;
        ctx.fillText(label, right + Math.round(4 * hr), yScaled - Math.round(3 * vr));
      }

      // Anchor circles at p1 and p2 (always visible)
      if (this._p1.y !== null) drawAnchorCircle(ctx, x1, Math.round((this._p1.y as number) * vr), hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      if (this._p2.y !== null) drawAnchorCircle(ctx, x2, Math.round((this._p2.y as number) * vr), hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── PaneView ─────────────────────────────────────────────────

class FibPaneView implements IPrimitivePaneView {
  private _source: FibRetracementPrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };
  private _levelYs: (Coordinate | null)[] = [];

  constructor(source: FibRetracementPrimitive) { this._source = source; }

  update(): void {
    const s = this._source.series;
    const ts = this._source.chart.timeScale();
    this._p1 = { x: ts.timeToCoordinate(this._source.p1.time), y: s.priceToCoordinate(this._source.p1.price) };
    this._p2 = { x: ts.timeToCoordinate(this._source.p2.time), y: s.priceToCoordinate(this._source.p2.price) };

    const priceDiff = this._source.p1.price - this._source.p2.price;
    this._levelYs = FIB_LEVELS.map((level) => {
      const levelPrice = this._source.p2.price + priceDiff * level;
      return s.priceToCoordinate(levelPrice);
    });
  }

  zOrder(): PrimitivePaneViewZOrder { return 'normal'; }

  renderer(): IPrimitivePaneRenderer {
    return new FibRenderer(
      this._p1, this._p2,
      this._source.p1.price, this._source.p2.price,
      this._source.options, this._source.selection,
      this._levelYs,
    );
  }

  get viewP1(): ViewPoint { return this._p1; }
  get viewP2(): ViewPoint { return this._p2; }
  get levelYs(): (Coordinate | null)[] { return this._levelYs; }
}

// ── Primitive ────────────────────────────────────────────────

export class FibRetracementPrimitive extends PluginBase {
  private _id: string;
  private _p1: AnchorPoint;
  private _p2: AnchorPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: FibPaneView;

  constructor(id: string, p1: AnchorPoint, p2: AnchorPoint, options?: Partial<DrawingStyleOptions>) {
    super();
    this._id = id;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...DEFAULT_DRAWING_STYLE, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new FibPaneView(this);
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

    // Hit-test within the fib bounding box
    if (isPointInBBox(x, y, vp1.x as number, vp1.y as number, vp2.x as number, vp2.y as number, HIT_THRESHOLD)) {
      return { cursorStyle: this._selection.selected ? 'move' : 'pointer', externalId: this._id, zOrder: 'normal' };
    }
    return null;
  }

  toJSON() {
    return { id: this._id, type: 'fib_retracement' as const, p1: { ...this._p1 }, p2: { ...this._p2 }, options: { ...this._options } };
  }
}
