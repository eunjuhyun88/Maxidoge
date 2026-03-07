// ═══════════════════════════════════════════════════════════════
// Stockclaw — Rectangle Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Rectangle defined by two diagonal corners (time+price).

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
  applyLineStyle,
  drawAnchorCircle,
  colorWithAlpha,
} from './drawingPrimitiveTypes';

// ── Renderer ─────────────────────────────────────────────────

class RectRenderer implements IPrimitivePaneRenderer {
  private _p1: ViewPoint;
  private _p2: ViewPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;

  constructor(p1: ViewPoint, p2: ViewPoint, options: DrawingStyleOptions, selection: SelectionState) {
    this._p1 = p1;
    this._p2 = p2;
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

      // Fill
      const fillColor = this._options.fillColor ?? this._options.lineColor;
      const fillOpacity = this._options.fillOpacity ?? 0.1;
      ctx.fillStyle = colorWithAlpha(fillColor, fillOpacity);
      ctx.fillRect(left, top, w, h);

      // Stroke
      ctx.beginPath();
      ctx.strokeStyle = this._options.lineColor;
      ctx.lineWidth = (this._selection.hovered ? this._options.lineWidth + 1 : this._options.lineWidth) * hr;
      applyLineStyle(ctx, this._options.lineStyle, hr);
      ctx.strokeRect(left, top, w, h);
      ctx.setLineDash([]);

      // Anchor circles at all 4 corners (always visible)
      drawAnchorCircle(ctx, x1, y1, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, x2, y1, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, x1, y2, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, x2, y2, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── PaneView ─────────────────────────────────────────────────

class RectPaneView implements IPrimitivePaneView {
  private _source: RectanglePrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };

  constructor(source: RectanglePrimitive) { this._source = source; }

  update(): void {
    const s = this._source.series;
    const ts = this._source.chart.timeScale();
    this._p1 = { x: ts.timeToCoordinate(this._source.p1.time), y: s.priceToCoordinate(this._source.p1.price) };
    this._p2 = { x: ts.timeToCoordinate(this._source.p2.time), y: s.priceToCoordinate(this._source.p2.price) };
  }

  zOrder(): PrimitivePaneViewZOrder { return 'normal'; }

  renderer(): IPrimitivePaneRenderer {
    return new RectRenderer(this._p1, this._p2, this._source.options, this._source.selection);
  }

  get viewP1(): ViewPoint { return this._p1; }
  get viewP2(): ViewPoint { return this._p2; }
}

// ── Primitive ────────────────────────────────────────────────

export class RectanglePrimitive extends PluginBase {
  private _id: string;
  private _p1: AnchorPoint;
  private _p2: AnchorPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: RectPaneView;

  constructor(id: string, p1: AnchorPoint, p2: AnchorPoint, options?: Partial<DrawingStyleOptions>) {
    super();
    this._id = id;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...DEFAULT_DRAWING_STYLE, fillOpacity: 0.1, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new RectPaneView(this);
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
      return { cursorStyle: this._selection.selected ? 'move' : 'pointer', externalId: this._id, zOrder: 'normal' };
    }
    return null;
  }

  toJSON() {
    return { id: this._id, type: 'rect' as const, p1: { ...this._p1 }, p2: { ...this._p2 }, options: { ...this._options } };
  }
}
