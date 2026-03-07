// ═══════════════════════════════════════════════════════════════
// Stockclaw — Ray Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Line from p1, through p2, extended to canvas edge.

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
  pointToRayDistance,
  applyLineStyle,
  drawSelectionHandle,
  drawAnchorCircle,
} from './drawingPrimitiveTypes';

// ── Compute ray endpoint at canvas edge ──────────────────────

function computeRayEnd(
  x1: number, y1: number,
  x2: number, y2: number,
  canvasW: number, canvasH: number,
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x: x2, y: y2 };

  let tMax = Infinity;

  // Find t where ray hits each canvas boundary
  if (dx > 0) tMax = Math.min(tMax, (canvasW - x1) / dx);
  else if (dx < 0) tMax = Math.min(tMax, -x1 / dx);

  if (dy > 0) tMax = Math.min(tMax, (canvasH - y1) / dy);
  else if (dy < 0) tMax = Math.min(tMax, -y1 / dy);

  // Must extend at least to p2
  tMax = Math.max(tMax, 1);

  return { x: x1 + dx * tMax, y: y1 + dy * tMax };
}

// ── Renderer ─────────────────────────────────────────────────

class RayRenderer implements IPrimitivePaneRenderer {
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
      const cw = scope.bitmapSize.width;
      const ch = scope.bitmapSize.height;

      const x1 = this._p1.x as number;
      const y1 = this._p1.y as number;
      const x2 = this._p2.x as number;
      const y2 = this._p2.y as number;

      // Extend to canvas edge
      const end = computeRayEnd(x1, y1, x2, y2, cw / hr, ch / vr);

      const sx1 = Math.round(x1 * hr);
      const sy1 = Math.round(y1 * vr);
      const sxEnd = Math.round(end.x * hr);
      const syEnd = Math.round(end.y * vr);

      ctx.beginPath();
      ctx.strokeStyle = this._options.lineColor;
      ctx.lineWidth = (this._selection.hovered ? this._options.lineWidth + 1 : this._options.lineWidth) * hr;
      applyLineStyle(ctx, this._options.lineStyle, hr);
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sxEnd, syEnd);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchor circles (always visible)
      drawAnchorCircle(ctx, sx1, sy1, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, Math.round(x2 * hr), Math.round(y2 * vr), hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── PaneView ─────────────────────────────────────────────────

class RayPaneView implements IPrimitivePaneView {
  private _source: RayPrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };

  constructor(source: RayPrimitive) { this._source = source; }

  update(): void {
    const s = this._source.series;
    const ts = this._source.chart.timeScale();
    this._p1 = { x: ts.timeToCoordinate(this._source.p1.time), y: s.priceToCoordinate(this._source.p1.price) };
    this._p2 = { x: ts.timeToCoordinate(this._source.p2.time), y: s.priceToCoordinate(this._source.p2.price) };
  }

  zOrder(): PrimitivePaneViewZOrder { return 'top'; }

  renderer(): IPrimitivePaneRenderer {
    return new RayRenderer(this._p1, this._p2, this._source.options, this._source.selection);
  }

  get viewP1(): ViewPoint { return this._p1; }
  get viewP2(): ViewPoint { return this._p2; }
}

// ── Primitive ────────────────────────────────────────────────

export class RayPrimitive extends PluginBase {
  private _id: string;
  private _p1: AnchorPoint;
  private _p2: AnchorPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: RayPaneView;

  constructor(id: string, p1: AnchorPoint, p2: AnchorPoint, options?: Partial<DrawingStyleOptions>) {
    super();
    this._id = id;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...DEFAULT_DRAWING_STYLE, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new RayPaneView(this);
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

    const dist = pointToRayDistance(x, y, vp1.x as number, vp1.y as number, vp2.x as number, vp2.y as number);
    if (dist <= HIT_THRESHOLD) {
      return { cursorStyle: this._selection.selected ? 'grab' : 'pointer', externalId: this._id, zOrder: 'top' };
    }
    return null;
  }

  toJSON() {
    return { id: this._id, type: 'ray' as const, p1: { ...this._p1 }, p2: { ...this._p2 }, options: { ...this._options } };
  }
}
