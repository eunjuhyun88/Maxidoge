// ═══════════════════════════════════════════════════════════════
// Stockclaw — Position Primitive (lightweight-charts v5)
// ═══════════════════════════════════════════════════════════════
// Long/Short position tool: Entry, Take Profit, Stop Loss with
// rich labels showing P&L, percentage, and Risk:Reward ratio.

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
import type { AnchorPoint, SelectionState, AnchorHitResult, DrawingStyleOptions } from './drawingPrimitiveTypes';
import {
  DEFAULT_SELECTION,
  HIT_THRESHOLD,
  ANCHOR_HIT_RADIUS,
  drawAnchorCircle,
  colorWithAlpha,
  isNearAnchor,
} from './drawingPrimitiveTypes';

// ── Position data ────────────────────────────────────────────

export interface PositionData {
  side: 'long' | 'short';
  entryPrice: number;
  entryTime: Time;
  exitTime: Time;
  takeProfitPrice: number;
  stopLossPrice: number;
  quantity: number;
}

export interface PositionStyleOptions {
  gainColor: string;
  lossColor: string;
  entryColor: string;
  gainFillAlpha: number;
  lossFillAlpha: number;
}

const DEFAULT_POSITION_STYLE: PositionStyleOptions = {
  gainColor: '#26a69a',
  lossColor: '#ef5350',
  entryColor: '#2962ff',
  gainFillAlpha: 0.15,
  lossFillAlpha: 0.15,
};

// ── View data passed to renderer ─────────────────────────────

interface PositionViewData {
  entryY: Coordinate | null;
  tpY: Coordinate | null;
  slY: Coordinate | null;
  leftX: Coordinate | null;
  rightX: Coordinate | null;
}

// ── Renderer ─────────────────────────────────────────────────

class PositionRenderer implements IPrimitivePaneRenderer {
  private _view: PositionViewData;
  private _data: PositionData;
  private _style: PositionStyleOptions;
  private _selection: SelectionState;

  constructor(
    view: PositionViewData,
    data: PositionData,
    style: PositionStyleOptions,
    selection: SelectionState,
  ) {
    this._view = view;
    this._data = data;
    this._style = style;
    this._selection = selection;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const { entryY, tpY, slY, leftX, rightX } = this._view;
      if (entryY === null || tpY === null || slY === null || leftX === null || rightX === null) return;

      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      const eY = Math.round((entryY as number) * vr);
      const tY = Math.round((tpY as number) * vr);
      const sY = Math.round((slY as number) * vr);
      const lX = Math.round((leftX as number) * hr);
      const rX = Math.round((rightX as number) * hr);
      const w = rX - lX;

      // ── Gain zone fill ──
      const gainTop = Math.min(eY, tY);
      const gainH = Math.abs(tY - eY);
      ctx.fillStyle = colorWithAlpha(this._style.gainColor, this._style.gainFillAlpha);
      ctx.fillRect(lX, gainTop, w, gainH);

      // ── Loss zone fill ──
      const lossTop = Math.min(eY, sY);
      const lossH = Math.abs(sY - eY);
      ctx.fillStyle = colorWithAlpha(this._style.lossColor, this._style.lossFillAlpha);
      ctx.fillRect(lX, lossTop, w, lossH);

      // ── Dashed lines: Entry, TP, SL ──
      ctx.setLineDash([5 * hr, 4 * hr]);
      ctx.lineWidth = 1.2 * hr;

      // Entry line
      ctx.strokeStyle = colorWithAlpha(this._style.entryColor, 0.9);
      ctx.beginPath();
      ctx.moveTo(lX, eY);
      ctx.lineTo(rX, eY);
      ctx.stroke();

      // TP line
      ctx.strokeStyle = colorWithAlpha(this._style.gainColor, 0.9);
      ctx.beginPath();
      ctx.moveTo(lX, tY);
      ctx.lineTo(rX, tY);
      ctx.stroke();

      // SL line
      ctx.strokeStyle = colorWithAlpha(this._style.lossColor, 0.9);
      ctx.beginPath();
      ctx.moveTo(lX, sY);
      ctx.lineTo(rX, sY);
      ctx.stroke();

      ctx.setLineDash([]);

      // ── Price labels on the right side ──
      const fontSize = Math.round(10 * hr);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      const labelX = rX + Math.round(6 * hr);

      // Entry label
      this._drawPriceLabel(ctx, labelX, eY, this._style.entryColor, hr, vr,
        `Entry ${this._formatPrice(this._data.entryPrice)}`);

      // TP label with P&L
      const tpPnl = this._computePnl(this._data.entryPrice, this._data.takeProfitPrice);
      this._drawPriceLabel(ctx, labelX, tY, this._style.gainColor, hr, vr,
        `TP ${this._formatPrice(this._data.takeProfitPrice)} (${tpPnl.sign}${tpPnl.pct}%${this._data.quantity > 0 ? ` $${tpPnl.usd}` : ''})`);

      // SL label with P&L
      const slPnl = this._computePnl(this._data.entryPrice, this._data.stopLossPrice);
      this._drawPriceLabel(ctx, labelX, sY, this._style.lossColor, hr, vr,
        `SL ${this._formatPrice(this._data.stopLossPrice)} (${slPnl.sign}${slPnl.pct}%${this._data.quantity > 0 ? ` $${slPnl.usd}` : ''})`);

      // ── Summary label (RR ratio, direction) ──
      const rr = this._computeRR();
      const sideLabel = this._data.side === 'long' ? 'LONG' : 'SHORT';
      const summaryColor = this._data.side === 'long' ? this._style.gainColor : this._style.lossColor;
      const summaryText = `${sideLabel} · R:R 1:${rr.toFixed(1)}${this._data.quantity > 0 ? ` · Qty ${this._data.quantity}` : ''}`;

      const summaryY = Math.min(eY, tY, sY) - Math.round(8 * vr);
      const tw = ctx.measureText(summaryText).width;
      const padX = Math.round(5 * hr);
      const boxW = tw + padX * 2;
      const boxH = Math.round(16 * vr);
      const boxX = lX;
      const boxY = Math.max(Math.round(2 * vr), summaryY - boxH);

      ctx.fillStyle = colorWithAlpha('#000000', 0.7);
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = colorWithAlpha(summaryColor, 0.8);
      ctx.lineWidth = 1 * hr;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = colorWithAlpha('#f5f7fa', 0.95);
      ctx.fillText(summaryText, boxX + padX, boxY + Math.round(11 * vr));

      // ── Anchor circles ──
      const midX = (lX + rX) / 2;
      drawAnchorCircle(ctx, midX, eY, hr, this._style.entryColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, midX, tY, hr, this._style.gainColor, this._selection.selected, this._selection.hovered);
      drawAnchorCircle(ctx, midX, sY, hr, this._style.lossColor, this._selection.selected, this._selection.hovered);
    });
  }

  private _drawPriceLabel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string,
    hr: number, vr: number,
    text: string,
  ): void {
    const tw = ctx.measureText(text).width;
    const padX = Math.round(4 * hr);
    const boxW = tw + padX * 2;
    const boxH = Math.round(14 * vr);

    ctx.fillStyle = colorWithAlpha('#131722', 0.85);
    ctx.fillRect(x, y - boxH / 2, boxW, boxH);
    ctx.fillStyle = color;
    ctx.fillText(text, x + padX, y + Math.round(3.5 * vr));
  }

  private _computePnl(entry: number, exit: number): { pct: string; usd: string; sign: string } {
    if (entry === 0) return { pct: '0.00', usd: '0.00', sign: '' };
    const diff = this._data.side === 'long' ? exit - entry : entry - exit;
    const pct = (diff / entry) * 100;
    const usd = Math.abs(diff * this._data.quantity);
    const sign = diff >= 0 ? '+' : '';
    return {
      pct: `${sign}${pct.toFixed(2)}`,
      usd: usd.toFixed(2),
      sign: diff >= 0 ? '+' : '-',
    };
  }

  private _computeRR(): number {
    const risk = Math.abs(this._data.entryPrice - this._data.stopLossPrice);
    const reward = Math.abs(this._data.takeProfitPrice - this._data.entryPrice);
    return risk > 0 ? reward / risk : 0;
  }

  private _formatPrice(price: number): string {
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  }
}

// ── PaneView ─────────────────────────────────────────────────

class PositionPaneView implements IPrimitivePaneView {
  private _source: PositionPrimitive;
  private _view: PositionViewData = {
    entryY: null, tpY: null, slY: null,
    leftX: null, rightX: null,
  };

  constructor(source: PositionPrimitive) { this._source = source; }

  update(): void {
    const s = this._source.series;
    const ts = this._source.chart.timeScale();
    const data = this._source.positionData;

    this._view = {
      entryY: s.priceToCoordinate(data.entryPrice),
      tpY: s.priceToCoordinate(data.takeProfitPrice),
      slY: s.priceToCoordinate(data.stopLossPrice),
      leftX: ts.timeToCoordinate(data.entryTime),
      rightX: ts.timeToCoordinate(data.exitTime),
    };
  }

  zOrder(): PrimitivePaneViewZOrder { return 'top'; }

  renderer(): IPrimitivePaneRenderer {
    return new PositionRenderer(
      this._view,
      this._source.positionData,
      this._source.styleOptions,
      this._source.selection,
    );
  }

  get viewData(): PositionViewData { return this._view; }
}

// ── Primitive ────────────────────────────────────────────────

export class PositionPrimitive extends PluginBase {
  private _id: string;
  private _data: PositionData;
  private _style: PositionStyleOptions;
  private _selection: SelectionState;
  private _paneView: PositionPaneView;

  constructor(
    id: string,
    data: PositionData,
    style?: Partial<PositionStyleOptions>,
  ) {
    super();
    this._id = id;
    this._data = { ...data };
    this._style = { ...DEFAULT_POSITION_STYLE, ...style };
    this._selection = { ...DEFAULT_SELECTION };
    this._paneView = new PositionPaneView(this);
  }

  // ── Public API ───────────────────────────────────
  get id(): string { return this._id; }
  get positionData(): PositionData { return this._data; }
  get styleOptions(): PositionStyleOptions { return this._style; }
  get selection(): SelectionState { return this._selection; }

  setSelected(s: boolean): void { this._selection.selected = s; this.requestUpdate(); }
  setHovered(h: boolean): void { this._selection.hovered = h; this.requestUpdate(); }

  updatePrices(entry: number, tp: number, sl: number): void {
    this._data.entryPrice = entry;
    this._data.takeProfitPrice = tp;
    this._data.stopLossPrice = sl;
    this.requestUpdate();
  }

  updateTimes(entryTime: Time, exitTime: Time): void {
    this._data.entryTime = entryTime;
    this._data.exitTime = exitTime;
    this.requestUpdate();
  }

  updateQuantity(qty: number): void {
    this._data.quantity = qty;
    this.requestUpdate();
  }

  /** Update visual style options (lineColor etc. mapped to position style) */
  updateOptions(options: Partial<DrawingStyleOptions>): void {
    if (options.lineColor !== undefined) {
      // Position uses its own style — map lineColor to border colors
      this._style = { ...this._style };
    }
    this.requestUpdate();
  }

  /** For DrawingManager's drag-to-move: move all prices by delta */
  updatePoints(p1: AnchorPoint, p2: AnchorPoint): void {
    // p1 = entry anchor, p2 = exit anchor (used for time range)
    const priceDelta = p1.price - this._data.entryPrice;
    this._data.entryPrice = p1.price;
    this._data.takeProfitPrice += priceDelta;
    this._data.stopLossPrice += priceDelta;
    this._data.entryTime = p1.time;
    this._data.exitTime = p2.time;
    this.requestUpdate();
  }

  // ── ISeriesPrimitive ─────────────────────────────
  updateAllViews(): void { this._paneView.update(); }
  paneViews(): IPrimitivePaneView[] { return [this._paneView]; }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const v = this._paneView.viewData;
    if (v.entryY === null || v.tpY === null || v.slY === null || v.leftX === null || v.rightX === null) return null;

    const lx = v.leftX as number;
    const rx = v.rightX as number;

    // Check if x is within the horizontal range
    if (x < lx - HIT_THRESHOLD || x > rx + HIT_THRESHOLD) return null;

    // Check proximity to any of the 3 lines
    const eY = v.entryY as number;
    const tY = v.tpY as number;
    const sY = v.slY as number;

    if (Math.abs(y - eY) <= HIT_THRESHOLD ||
        Math.abs(y - tY) <= HIT_THRESHOLD ||
        Math.abs(y - sY) <= HIT_THRESHOLD) {
      return {
        cursorStyle: this._selection.selected ? 'grab' : 'pointer',
        externalId: this._id,
        zOrder: 'top',
      };
    }

    // Check if inside the bounding box of the position
    const minY = Math.min(eY, tY, sY);
    const maxY = Math.max(eY, tY, sY);
    if (y >= minY && y <= maxY) {
      return {
        cursorStyle: this._selection.selected ? 'grab' : 'pointer',
        externalId: this._id,
        zOrder: 'top',
      };
    }

    return null;
  }

  anchorHitTest(x: number, y: number): AnchorHitResult | null {
    const v = this._paneView.viewData;
    if (v.entryY === null || v.tpY === null || v.slY === null || v.leftX === null || v.rightX === null) return null;

    const midX = ((v.leftX as number) + (v.rightX as number)) / 2;
    const eY = v.entryY as number;
    const tY = v.tpY as number;
    const sY = v.slY as number;

    if (isNearAnchor(x, y, midX, eY)) return { anchorIndex: 0, cursorStyle: 'ns-resize' };
    if (isNearAnchor(x, y, midX, tY)) return { anchorIndex: 1, cursorStyle: 'ns-resize' };
    if (isNearAnchor(x, y, midX, sY)) return { anchorIndex: 2, cursorStyle: 'ns-resize' };
    return null;
  }

  toJSON() {
    return {
      id: this._id,
      type: 'position' as const,
      side: this._data.side,
      entryPrice: this._data.entryPrice,
      entryTime: this._data.entryTime,
      exitTime: this._data.exitTime,
      takeProfitPrice: this._data.takeProfitPrice,
      stopLossPrice: this._data.stopLossPrice,
      quantity: this._data.quantity,
      style: { ...this._style },
    };
  }
}
