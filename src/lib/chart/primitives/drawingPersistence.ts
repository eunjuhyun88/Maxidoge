// ═══════════════════════════════════════════════════════════════
// Stockclaw — Drawing Persistence (localStorage per pair+timeframe)
// ═══════════════════════════════════════════════════════════════

import { STORAGE_KEYS } from '$lib/stores/storageKeys';
import type { DrawingData } from './drawingManager';

/** Build storage key for a specific pair+timeframe combo */
function storageKey(pair: string, timeframe: string): string {
  return `${STORAGE_KEYS.drawings}|${pair}|${timeframe}`;
}

/** Load drawings from localStorage for a pair+timeframe */
export function loadDrawings(pair: string, timeframe: string): DrawingData[] {
  try {
    const raw = localStorage.getItem(storageKey(pair, timeframe));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DrawingData[];
  } catch {
    return [];
  }
}

/** Save drawings to localStorage for a pair+timeframe */
export function saveDrawings(pair: string, timeframe: string, drawings: DrawingData[]): void {
  try {
    if (drawings.length === 0) {
      localStorage.removeItem(storageKey(pair, timeframe));
    } else {
      localStorage.setItem(storageKey(pair, timeframe), JSON.stringify(drawings));
    }
  } catch {
    // localStorage might be full — silently fail
  }
}

/** Clear drawings for a pair+timeframe */
export function clearDrawings(pair: string, timeframe: string): void {
  try {
    localStorage.removeItem(storageKey(pair, timeframe));
  } catch {
    // ignore
  }
}

/** Debounced auto-save helper */
export function createDrawingAutoSaver(
  getPair: () => string,
  getTimeframe: () => string,
  getDrawings: () => DrawingData[],
  debounceMs = 500,
): { trigger: () => void; flush: () => void; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    saveDrawings(getPair(), getTimeframe(), getDrawings());
  };

  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const dispose = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return { trigger, flush, dispose };
}
