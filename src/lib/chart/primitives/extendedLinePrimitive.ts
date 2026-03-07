// ═══════════════════════════════════════════════════════════════
// Stockclaw — Extended Line Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Line through p1 and p2, extended to canvas edges in BOTH directions.

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
  applyLineStyle,
  drawAnchorCircle,
} from './drawingPrimitiveTypes';

// ── Compute extended line endpoints at canvas edges ──────────

function computeExtendedEnds(
  x1: number, y1: number,
  x2: number, y2: number,
  canvasW: number, canvasH: number,
): { startX: number; startY: number; endX: number; endY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { startX: x1, startY: y1, endX: x2, endY: y2 };

  // Forward direction (t > 0, beyond p2)
  let tMaxFwd = Infinity;
  if (dx > 0) tMaxFwd = Math.min(tMaxFwd, (canvasW - x1) / dx);
  else if (dx < 0) tMaxFwd = Math.min(tMaxFwd, -x1 / dx);
  if (dy > 0) tMaxFwd = Math.min(tMaxFwd, (canvasH - y1) / dy);
  else if (dy < 0) tMaxFwd = Math.min(tMaxFwd, -y1 / dy);
  tMaxFwd = Math.max(tMaxFwd, 1);

  // Backward direction (t < 0, beyond p1)
  let tMaxBwd = Infinity;
  if (dx > 0) tMaxBwd = Math.min(tMaxBwd, x1 / dx);
  else if (dx < 0) tMaxBwd = Math.min(tMaxBwd, (x1 - canvasW) / dx);
  if (dy > 0) tMaxBwd = Math.min(tMaxBwd, y1 / dy);
  else if (dy < 0) tMaxBwd = Math.min(tMaxBwd, (y1 - canvasH) / dy);
  tMaxBwd = Math.max(tMaxBwd, 0);

  return {
    startX: x1 - dx * tMaxBwd,
    startY: y1 - dy * tMaxBwd,
    endX: x1 + dx * tMaxFwd,
    endY: y1 + dy * tMaxFwd,
  };
}

// ── Point-to-infinite-line distance ──────────────────────────

function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  // No clamping — infinite line
  const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ── Renderer ─────────────────────────────────────────────────

class ExtendedLineRenderer implements IPrimitivePaneRenderer {
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

      const ends = computeExtendedEnds(x1, y1, x2, y2, cw / hr, ch / vr);

      const sx = Math.round(ends.startX * hr);
      const sy = Math.round(ends.startY * vr);
      const ex = Math.round(ends.endX * hr);
      const ey = Math.round(ends.endY * vr);

      ctx.beginPath();
      ctx.strokeStyle = this._options.lineColor;
      ctx.lineWidth = (this._selection.hovered ? this._options.lineWidth + 1 : this._options.lineWidth) * hr;
      applyLineStyle(ctx, this._options.lineStyle, hr);
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchor circles
      drawAnchorCircle(ctx, Math.round(x1 * hr), Math.round(y1 * vr), hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, Math.round(x2 * hr), Math.round(y2 * vr), hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── PaneView ─────────────────────────────────────────────────

class ExtendedLinePaneView implements IPrimitivePaneView {
  private _source: ExtendedLinePrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };

  constructor(source: ExtendedLinePrimitive) { this._source = source; }

  update(): void {
    const s = this._source.series;
    const ts = this._source.chart.timeScale();
    this._p1 = { x: ts.timeToCoordinate(this._source.p1.time), y: s.priceToCoordinate(this._source.p1.price) };
    this._p2 = { x: ts.timeToCoordinate(this._source.p2.time), y: s.priceToCoordinate(this._source.p2.price) };
  }

  zOrder(): PrimitivePaneViewZOrder { return 'top'; }

  renderer(): IPrimitivePaneRenderer {
    return new ExtendedLineRenderer(this._p1, this._p2, this._source.options, this._source.selection);
  }

  get viewP1(): ViewPoint { return this._p1; }
  get viewP2(): ViewPoint { return this._p2; }
}

// ── Primitive ────────────────────────────────────────────────

export class ExtendedLinePrimitive extends PluginBase {
  private _id: string;
  private _p1: AnchorPoint;
  private _p2: AnchorPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: ExtendedLinePaneView;

  constructor(id: string, p1: AnchorPoint, p2: AnchorPoint, options?: Partial<DrawingStyleOptions>) {
    super();
    this._id = id;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...DEFAULT_DRAWING_STYLE, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new ExtendedLinePaneView(this);
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

    const dist = pointToLineDistance(x, y, vp1.x as number, vp1.y as number, vp2.x as number, vp2.y as number);
    if (dist <= HIT_THRESHOLD) {
      return { cursorStyle: this._selection.selected ? 'grab' : 'pointer', externalId: this._id, zOrder: 'top' };
    }
    return null;
  }

  toJSON() {
    return { id: this._id, type: 'extended_line' as const, p1: { ...this._p1 }, p2: { ...this._p2 }, options: { ...this._options } };
  }
}
