import type { BinanceKline } from '$lib/api/binance';
import type { ChartPatternDetection } from '$lib/engine/patternDetector';

export type PatternScanScope = 'visible' | 'full';

export type PatternScanResult = {
  ok: boolean;
  scope: PatternScanScope;
  candleCount: number;
  patternCount: number;
  patterns: Array<{
    kind: ChartPatternDetection['kind'];
    shortName: string;
    direction: ChartPatternDetection['direction'];
    status: ChartPatternDetection['status'];
    confidence: number;
    startTime: number;
    endTime: number;
  }>;
  message: string;
};

export type PatternChartMarker = {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
};

export function drawPatternOverlays(input: {
  ctx: CanvasRenderingContext2D;
  drawingCanvas: HTMLCanvasElement | null;
  chartMode: 'agent' | 'trading';
  detectedPatterns: ChartPatternDetection[];
  toOverlayPoint: (time: number, price: number) => { x: number; y: number } | null;
  withAlpha: (hex: string, alpha: number) => string;
}): void {
  const { ctx, drawingCanvas, chartMode, detectedPatterns, toOverlayPoint, withAlpha } = input;
  if (!drawingCanvas || chartMode !== 'agent' || detectedPatterns.length === 0) return;

  for (const pattern of detectedPatterns.slice(0, 3)) {
    const lineAlpha = 0.9;
    const fillAlpha = 0.14;

    const upperGuide = pattern.guideLines.find((g) => g.label === 'upper');
    const lowerGuide = pattern.guideLines.find((g) => g.label === 'lower');
    if (upperGuide && lowerGuide) {
      const p1 = toOverlayPoint(upperGuide.from.time, upperGuide.from.price);
      const p2 = toOverlayPoint(upperGuide.to.time, upperGuide.to.price);
      const p3 = toOverlayPoint(lowerGuide.to.time, lowerGuide.to.price);
      const p4 = toOverlayPoint(lowerGuide.from.time, lowerGuide.from.price);
      if (p1 && p2 && p3 && p4) {
        ctx.save();
        ctx.fillStyle = withAlpha(upperGuide.color, fillAlpha);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    for (const guide of pattern.guideLines) {
      const from = toOverlayPoint(guide.from.time, guide.from.price);
      const to = toOverlayPoint(guide.to.time, guide.to.price);
      if (!from || !to) continue;

      ctx.save();
      ctx.strokeStyle = withAlpha(guide.color, lineAlpha);
      ctx.lineWidth = guide.style === 'dashed' ? 2 : 2.2;
      ctx.setLineDash(guide.style === 'dashed' ? [7, 5] : []);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = withAlpha(guide.color, 0.95);
      ctx.beginPath();
      ctx.arc(from.x, from.y, 2.2, 0, Math.PI * 2);
      ctx.arc(to.x, to.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const marker = toOverlayPoint(pattern.markerTime, pattern.markerPrice);
    if (!marker) continue;
    const tagColor = pattern.direction === 'BULLISH' ? '#58d78d' : '#ff657a';
    const statusLabel = pattern.status === 'CONFIRMED' ? 'OK' : 'PEND';
    drawPatternTag({
      ctx,
      drawingCanvas,
      point: marker,
      text: `${pattern.shortName} ${statusLabel} ${Math.round(pattern.confidence * 100)}%`,
      color: tagColor,
      withAlpha,
    });
  }
}

function drawPatternTag(input: {
  ctx: CanvasRenderingContext2D;
  drawingCanvas: HTMLCanvasElement;
  point: { x: number; y: number };
  text: string;
  color: string;
  withAlpha: (hex: string, alpha: number) => string;
}) {
  const { ctx, drawingCanvas, point, text, color, withAlpha } = input;
  ctx.save();
  ctx.font = "700 9px 'JetBrains Mono', monospace";
  const padX = 6;
  const h = 16;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const x = Math.max(4, Math.min(point.x + 8, drawingCanvas.width - w - 4));
  const y = Math.max(4, Math.min(point.y - h - 8, drawingCanvas.height - h - 4));

  ctx.fillStyle = withAlpha('#05070d', 0.84);
  ctx.strokeStyle = withAlpha(color, 0.72);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = withAlpha(color, 0.96);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2);
  ctx.restore();
}

export function toPatternMarker(pattern: ChartPatternDetection): PatternChartMarker {
  const isBear = pattern.direction === 'BEARISH';
  const isConfirmed = pattern.status === 'CONFIRMED';
  const confidencePct = Math.round(pattern.confidence * 100);
  return {
    time: pattern.markerTime,
    position: isBear ? 'aboveBar' : 'belowBar',
    color: isBear ? '#ff657a' : '#58d78d',
    shape: isConfirmed ? (isBear ? 'arrowDown' : 'arrowUp') : 'circle',
    text: `${pattern.shortName} ${isConfirmed ? 'OK' : 'PEND'} ${confidencePct}%`,
  };
}

export function snapshotPattern(pattern: ChartPatternDetection): PatternScanResult['patterns'][number] {
  return {
    kind: pattern.kind,
    shortName: pattern.shortName,
    direction: pattern.direction,
    status: pattern.status,
    confidence: pattern.confidence,
    startTime: pattern.startTime,
    endTime: pattern.endTime,
  };
}

export function buildPatternSummary(patterns: ChartPatternDetection[]): string {
  if (patterns.length === 0) return '패턴 미감지 · 조건 미충족';
  const summary = patterns
    .slice(0, 2)
    .map((p) => `${p.shortName} ${Math.round(p.confidence * 100)}%`)
    .join(' · ');
  return `패턴 ${patterns.length}개 감지 · ${summary}`;
}

export function buildPatternSignature(patterns: ChartPatternDetection[]): string {
  return patterns
    .map((p) => `${p.id}:${p.status}:${Math.round(p.confidence * 100)}`)
    .join('|');
}

export function getVisibleScopeCandles(chart: any, klineCache: BinanceKline[]): BinanceKline[] {
  if (!chart || klineCache.length === 0) return [];
  try {
    const range = chart.timeScale?.().getVisibleLogicalRange?.();
    if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return [];
    const from = Math.max(0, Math.floor(range.from));
    const to = Math.min(klineCache.length - 1, Math.ceil(range.to));
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];
    return klineCache.slice(from, to + 1);
  } catch {
    return [];
  }
}

