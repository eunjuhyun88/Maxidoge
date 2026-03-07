// ═══════════════════════════════════════════════════════════════
// Stockclaw — Drawing Primitive Types & Utilities
// ═══════════════════════════════════════════════════════════════

import type { Coordinate, Time } from 'lightweight-charts';

// ── View coordinate pair (screen space) ──────────────────────
export interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
}

// ── Data coordinate pair (chart space) ───────────────────────
export interface AnchorPoint {
  time: Time;
  price: number;
}

// ── Drawing style options ────────────────────────────────────
export interface DrawingStyleOptions {
  lineColor: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  fillColor?: string;
  fillOpacity?: number;
  showLabels?: boolean;
  labelBgColor?: string;
  labelTextColor?: string;
  locked?: boolean;
}

export const DEFAULT_DRAWING_STYLE: DrawingStyleOptions = {
  lineColor: '#2962ff',
  lineWidth: 1,
  lineStyle: 'solid',
  showLabels: true,
  labelBgColor: '#131722',
  labelTextColor: '#d1d4dc',
};

// ── Selection state ──────────────────────────────────────────
export interface SelectionState {
  selected: boolean;
  hovered: boolean;
}

export const DEFAULT_SELECTION: SelectionState = {
  selected: false,
  hovered: false,
};

// ── Selection handle rendering ───────────────────────────────
export const SELECTION_HANDLE_SIZE = 4; // px radius
export const SELECTION_HANDLE_COLOR = '#2962ff';
export const SELECTION_HANDLE_BORDER = '#ffffff';

// ── Hit-test threshold ───────────────────────────────────────
export const HIT_THRESHOLD = 6; // pixels

// ── Anchor resize hit-test ──────────────────────────────────
export const ANCHOR_HIT_RADIUS = 8; // pixels — larger than HIT_THRESHOLD for easy grab

export interface AnchorHitResult {
  /** Which anchor was hit (0-based index) */
  anchorIndex: number;
  /** Suggested cursor style for this anchor */
  cursorStyle: string;
}

/** Check if point (px, py) is within ANCHOR_HIT_RADIUS of anchor at (ax, ay) */
export function isNearAnchor(px: number, py: number, ax: number, ay: number): boolean {
  return Math.hypot(px - ax, py - ay) <= ANCHOR_HIT_RADIUS;
}

// ── Constraint drawing ──────────────────────────────────────

/**
 * Constrain target anchor relative to origin:
 * - Shift: snap to horizontal or vertical (whichever is closer in pixel space)
 * Uses pixel coordinates for comparison (not price).
 */
export function constrainAnchor(
  origin: AnchorPoint,
  target: AnchorPoint,
  originPx: { x: number; y: number },
  targetPx: { x: number; y: number },
): AnchorPoint {
  const dx = Math.abs(targetPx.x - originPx.x);
  const dy = Math.abs(targetPx.y - originPx.y);

  if (dx > dy) {
    // Horizontal: keep target time, use origin price
    return { time: target.time, price: origin.price };
  } else {
    // Vertical: keep target price, use origin time
    return { time: origin.time, price: target.price };
  }
}

// ── Hit-test utilities ───────────────────────────────────────

/** Point-to-line-segment distance (clamped to segment) */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Point-to-ray distance (extends infinitely from p1 through p2) */
export function pointToRayDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);

  // t >= 0 (no upper clamp — extends infinitely past p2)
  const t = Math.max(0, ((px - x1) * dx + (py - y1) * dy) / lenSq);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Is point inside axis-aligned bounding box? */
export function isPointInBBox(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  padding = 0,
): boolean {
  const minX = Math.min(x1, x2) - padding;
  const maxX = Math.max(x1, x2) + padding;
  const minY = Math.min(y1, y2) - padding;
  const maxY = Math.max(y1, y2) + padding;
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

// ── Pixel-perfect line positioning (from fancy-canvas examples) ──
export function positionsLine(
  positionMedia: number,
  pixelRatio: number,
  desiredWidthMedia = 1,
): { position: number; length: number } {
  const scaledPosition = Math.round(positionMedia * pixelRatio);
  const scaledWidth = Math.max(1, Math.round(desiredWidthMedia * pixelRatio));
  const position = scaledPosition - Math.floor(scaledWidth / 2);
  return { position, length: scaledWidth };
}

// ── setLineDash helper ───────────────────────────────────────
export function applyLineStyle(
  ctx: CanvasRenderingContext2D,
  style: 'solid' | 'dashed' | 'dotted',
  pixelRatio: number,
): void {
  switch (style) {
    case 'dashed':
      ctx.setLineDash([4 * pixelRatio, 4 * pixelRatio]);
      break;
    case 'dotted':
      ctx.setLineDash([2 * pixelRatio, 2 * pixelRatio]);
      break;
    default:
      ctx.setLineDash([]);
  }
}

// ── Draw selection handles ───────────────────────────────────
export function drawSelectionHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pixelRatio: number,
): void {
  const size = SELECTION_HANDLE_SIZE * pixelRatio;
  ctx.fillStyle = SELECTION_HANDLE_COLOR;
  ctx.strokeStyle = SELECTION_HANDLE_BORDER;
  ctx.lineWidth = 1 * pixelRatio;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.strokeRect(x - size, y - size, size * 2, size * 2);
}

// ── Anchor point circle (always visible at endpoints) ────────

/** Draws a visible anchor circle. Always shown; larger when selected/hovered. */
export function drawAnchorCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pixelRatio: number,
  color: string,
  selected: boolean,
  hovered: boolean,
): void {
  const radius = selected ? 5 * pixelRatio : hovered ? 4 * pixelRatio : 3 * pixelRatio;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (selected) {
    ctx.fillStyle = SELECTION_HANDLE_COLOR;
    ctx.fill();
    ctx.strokeStyle = SELECTION_HANDLE_BORDER;
    ctx.lineWidth = 1.5 * pixelRatio;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1 * pixelRatio;
    ctx.stroke();
  }
}

// ── Color utilities ──────────────────────────────────────────
export function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
