// ═══════════════════════════════════════════════════════════════
// Stockclaw — Parallel Channel Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Two parallel lines defined by p1→p2 direction + p3 for channel width.
// Simplified as 2-point: p1→p2 for base line, channel width is half the
// vertical distance (above and below the base line).

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
  drawAnchorCircle,
  colorWithAlpha,
} from './drawingPrimitiveTypes';

// ── Renderer ─────────────────────────────────────────────────

class ChannelRenderer implements IPrimitivePaneRenderer {
  private _p1: ViewPoint;
  private _p2: ViewPoint;
  private _channelWidth: number; // in price units
  private _channelWidthPx: number; // in media pixels
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;

  constructor(
    p1: ViewPoint, p2: ViewPoint,
    channelWidthPx: number,
    options: DrawingStyleOptions, selection: SelectionState,
  ) {
    this._p1 = p1;
    this._p2 = p2;
    this._channelWidthPx = channelWidthPx;
    this._channelWidth = 0;
    this._options = options;
    this._selection = selection;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this._p1.x === null || this._p1.y === null || this._p2.x === null || this._p2.y === null) return;

      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      const x1 = this._p1.x as number;
      const y1 = this._p1.y as number;
      const x2 = this._p2.x as number;
      const y2 = this._p2.y as number;

      // Channel width in pixels (half above, half below)
      const halfW = this._channelWidthPx;

      // Direction perpendicular to line
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;

      const nx = -dy / len; // perpendicular normal x
      const ny = dx / len;  // perpendicular normal y

      const sx1 = Math.round(x1 * hr);
      const sy1 = Math.round(y1 * vr);
      const sx2 = Math.round(x2 * hr);
      const sy2 = Math.round(y2 * vr);

      const offX = Math.round(nx * halfW * hr);
      const offY = Math.round(ny * halfW * vr);

      // Fill between the two parallel lines
      ctx.fillStyle = colorWithAlpha(this._options.fillColor ?? this._options.lineColor, this._options.fillOpacity ?? 0.08);
      ctx.beginPath();
      ctx.moveTo(sx1 + offX, sy1 + offY);
      ctx.lineTo(sx2 + offX, sy2 + offY);
      ctx.lineTo(sx2 - offX, sy2 - offY);
      ctx.lineTo(sx1 - offX, sy1 - offY);
      ctx.closePath();
      ctx.fill();

      // Draw both parallel lines
      ctx.strokeStyle = this._options.lineColor;
      ctx.lineWidth = (this._selection.hovered ? this._options.lineWidth + 1 : this._options.lineWidth) * hr;
      applyLineStyle(ctx, this._options.lineStyle, hr);

      // Upper line
      ctx.beginPath();
      ctx.moveTo(sx1 + offX, sy1 + offY);
      ctx.lineTo(sx2 + offX, sy2 + offY);
      ctx.stroke();

      // Lower line
      ctx.beginPath();
      ctx.moveTo(sx1 - offX, sy1 - offY);
      ctx.lineTo(sx2 - offX, sy2 - offY);
      ctx.stroke();

      // Center line (dashed, lighter)
      ctx.strokeStyle = colorWithAlpha(this._options.lineColor, 0.4);
      ctx.lineWidth = 1 * hr;
      ctx.setLineDash([4 * hr, 4 * hr]);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchor circles at endpoints
      drawAnchorCircle(ctx, sx1, sy1, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, sx2, sy2, hr, this._options.lineColor, this._selection.selected, this._selection.hovered);
    });
  }
}

// ── PaneView ─────────────────────────────────────────────────

class ChannelPaneView implements IPrimitivePaneView {
  private _source: ChannelPrimitive;
  private _p1: ViewPoint = { x: null, y: null };
  private _p2: ViewPoint = { x: null, y: null };
  private _channelWidthPx = 0;

  constructor(source: ChannelPrimitive) { this._source = source; }

  update(): void {
    const s = this._source.series;
    const ts = this._source.chart.timeScale();
    this._p1 = { x: ts.timeToCoordinate(this._source.p1.time), y: s.priceToCoordinate(this._source.p1.price) };
    this._p2 = { x: ts.timeToCoordinate(this._source.p2.time), y: s.priceToCoordinate(this._source.p2.price) };

    // Convert channel width from price units to pixels
    const midPrice = (this._source.p1.price + this._source.p2.price) / 2;
    const midY = s.priceToCoordinate(midPrice);
    const topY = s.priceToCoordinate(midPrice + this._source.channelWidth / 2);
    if (midY !== null && topY !== null) {
      this._channelWidthPx = Math.abs((midY as number) - (topY as number));
    } else {
      this._channelWidthPx = 20; // fallback
    }
  }

  zOrder(): PrimitivePaneViewZOrder { return 'normal'; }

  renderer(): IPrimitivePaneRenderer {
    return new ChannelRenderer(
      this._p1, this._p2,
      this._channelWidthPx,
      this._source.options, this._source.selection,
    );
  }

  get viewP1(): ViewPoint { return this._p1; }
  get viewP2(): ViewPoint { return this._p2; }
}

// ── Primitive ────────────────────────────────────────────────

export class ChannelPrimitive extends PluginBase {
  private _id: string;
  private _p1: AnchorPoint;
  private _p2: AnchorPoint;
  private _channelWidth: number; // in price units
  private _options: DrawingStyleOptions;
  private _selection: SelectionState;
  private _paneView: ChannelPaneView;

  constructor(
    id: string,
    p1: AnchorPoint,
    p2: AnchorPoint,
    channelWidth?: number,
    options?: Partial<DrawingStyleOptions>,
  ) {
    super();
    this._id = id;
    this._p1 = p1;
    this._p2 = p2;
    // Default channel width: 20% of the price difference between p1 and p2
    this._channelWidth = channelWidth ?? Math.abs(p2.price - p1.price) * 0.3;
    this._options = { ...DEFAULT_DRAWING_STYLE, fillOpacity: 0.08, ...options };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new ChannelPaneView(this);
  }

  get id(): string { return this._id; }
  get p1(): AnchorPoint { return this._p1; }
  get p2(): AnchorPoint { return this._p2; }
  get channelWidth(): number { return this._channelWidth; }
  get options(): DrawingStyleOptions { return this._options; }
  get selection(): SelectionState { return this._selection; }

  setSelected(s: boolean): void { this._selection.selected = s; this.requestUpdate(); }
  setHovered(h: boolean): void { this._selection.hovered = h; this.requestUpdate(); }

  updatePoints(p1: AnchorPoint, p2: AnchorPoint): void {
    this._p1 = p1;
    this._p2 = p2;
    this._channelWidth = Math.abs(p2.price - p1.price) * 0.3;
    this.requestUpdate();
  }

  updateChannelWidth(width: number): void {
    this._channelWidth = width;
    this.requestUpdate();
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

    // Hit test: check distance to center line, upper line, or lower line
    const dist = pointToSegmentDistance(x, y, vp1.x as number, vp1.y as number, vp2.x as number, vp2.y as number);

    // Check if within the channel area (center line dist < channelWidth/2 + threshold)
    // Using a simplified approach: just check distance to center line
    const maxDist = this._channelWidth > 0 ? HIT_THRESHOLD * 3 : HIT_THRESHOLD;
    if (dist <= maxDist) {
      return { cursorStyle: this._selection.selected ? 'grab' : 'pointer', externalId: this._id, zOrder: 'normal' };
    }
    return null;
  }

  toJSON() {
    return {
      id: this._id,
      type: 'channel' as const,
      p1: { ...this._p1 },
      p2: { ...this._p2 },
      channelWidth: this._channelWidth,
      options: { ...this._options },
    };
  }
}
