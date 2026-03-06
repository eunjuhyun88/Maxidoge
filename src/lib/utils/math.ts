/** Clamp a numeric value to [min, max] range */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Clamp with NaN/Infinity safety — returns min for non-finite values. Defaults to [0, 100]. */
export function clampSafe(v: number, min = 0, max = 100): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
