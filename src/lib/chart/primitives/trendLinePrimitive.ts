// ═══════════════════════════════════════════════════════════════
// Stockclaw — TrendLine Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// 2-point line segment. Follows TV official TrendLine example.

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
  pointToSegmentDistance,
  applyLineStyle,
  drawSelectionHandle,
  drawAnchorCircle,
  type AnchorHitResult,
  isNearAnchor,
} from './drawingPrimitiveTypes';

// ── Renderer ─────────────────────────────────────────────────

class TrendLineRenderer implements IPrimitivePaneRenderer {
  private _p1: ViewPoint;
  private _p2: ViewPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;

  constructor(
    p1: ViewPoint,
    p2: ViewPoint,
    options: DrawingStyleOptions,
    selection: SelectionState,
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._options = options;
    this._selection = selection;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (
        this._p1.x === null ||
        this._p1.y === null ||
        this._p2.x === null ||
        this._p2.y === null
      )
        return;

      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      const x1 = Math.round(this._p1.x * hr);
      const y1 = Math.round(this._p1.y * vr);
      const x2 = Math.round(this._p2.x * hr);
      const y2 = Math.round(this._p2.y * vr);

      // Line
      ctx.beginPath();
      ctx.strokeStyle = this._options.lineColor;
      ctx.lineWidth = (this._selection.hovered ? this._options.lineWidth + 1 : this._options.lineWidth) * hr;
      applyLineStyle(ctx, this._options.lineStyle, hr);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchor circles (always visible)
      drawAnchorCircle(ctx, x1, y1, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, x2, y2, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── PaneView ─────────────────────────────────────────────────

class TrendLinePaneView implements IPrimitivePaneView {
  private _source: TrendLinePrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };

  constructor(source: TrendLinePrimitive) {
    this._source = source;
  }

  update(): void {
    const series = this._source.series;
    const timeScale = this._source.chart.timeScale();
    this._p1 = {
      x: timeScale.timeToCoordinate(this._source.p1.time),
      y: series.priceToCoordinate(this._source.p1.price),
    };
    this._p2 = {
      x: timeScale.timeToCoordinate(this._source.p2.time),
      y: series.priceToCoordinate(this._source.p2.price),
    };
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return new TrendLineRenderer(
      this._p1,
      this._p2,
      this._source.options,
      this._source.selection,
    );
  }

  // Expose computed coords for hit-testing
  get viewP1(): ViewPoint {
    return this._p1;
  }
  get viewP2(): ViewPoint {
    return this._p2;
  }
}

// ── Primitive ────────────────────────────────────────────────

export class TrendLinePrimitive extends PluginBase {
  private _id: string;
  private _p1: AnchorPoint;
  private _p2: AnchorPoint;
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: TrendLinePaneView;

  constructor(
    id: string,
    p1: AnchorPoint,
    p2: AnchorPoint,
    options?: Partial<DrawingStyleOptions>,
  ) {
    super();
    this._id = id;
    this._p1 = p1;
    this._p2 = p2;
    this._options = { ...DEFAULT_DRAWING_STYLE, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new TrendLinePaneView(this);
  }

  // ── Public API ───────────────────────────────────
  get id(): string {
    return this._id;
  }
  get p1(): AnchorPoint {
    return this._p1;
  }
  get p2(): AnchorPoint {
    return this._p2;
  }
  get options(): DrawingStyleOptions {
    return this._options;
  }
  get selection(): SelectionState {
    return this._selection;
  }

  setSelected(selected: boolean): void {
    this._selection.selected = selected;
    this.requestUpdate();
  }

  setHovered(hovered: boolean): void {
    this._selection.hovered = hovered;
    this.requestUpdate();
  }

  updatePoints(p1: AnchorPoint, p2: AnchorPoint): void {
    this._p1 = p1;
    this._p2 = p2;
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

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const vp1 = this._paneView.viewP1;
    const vp2 = this._paneView.viewP2;
    if (
      vp1.x === null ||
      vp1.y === null ||
      vp2.x === null ||
      vp2.y === null
    )
      return null;

    const dist = pointToSegmentDistance(
      x,
      y,
      vp1.x as number,
      vp1.y as number,
      vp2.x as number,
      vp2.y as number,
    );

    if (dist <= HIT_THRESHOLD) {
      return {
        cursorStyle: this._selection.selected ? 'grab' : 'pointer',
        externalId: this._id,
        zOrder: 'top',
      };
    }
    return null;
  }

  anchorHitTest(x: number, y: number): AnchorHitResult | null {
    const vp1 = this._paneView.viewP1;
    const vp2 = this._paneView.viewP2;
    if (vp1.x === null || vp1.y === null || vp2.x === null || vp2.y === null) return null;
    if (isNearAnchor(x, y, vp1.x as number, vp1.y as number)) return { anchorIndex: 0, cursorStyle: 'crosshair' };
    if (isNearAnchor(x, y, vp2.x as number, vp2.y as number)) return { anchorIndex: 1, cursorStyle: 'crosshair' };
    return null;
  }

  // ── Serialization ────────────────────────────────
  toJSON(): {
    id: string;
    type: 'trendline';
    p1: AnchorPoint;
    p2: AnchorPoint;
    options: DrawingStyleOptions;
  } {
    return {
      id: this._id,
      type: 'trendline',
      p1: { ...this._p1 },
      p2: { ...this._p2 },
      options: { ...this._options },
    };
  }
}
