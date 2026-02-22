// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Fear & Greed server client
// ═══════════════════════════════════════════════════════════════

const FNG_ENDPOINT = 'https://api.alternative.me/fng/';

export type FearGreedPoint = {
  value: number;
  classification: string;
  timestampMs: number;
};

export type FearGreedSnapshot = {
  current: FearGreedPoint | null;
  points: FearGreedPoint[];
};

function toPoint(raw: any): FearGreedPoint | null {
  const value = Number(raw?.value);
  const tsSec = Number(raw?.timestamp);
  if (!Number.isFinite(value) || !Number.isFinite(tsSec)) return null;
  return {
    value,
    classification: typeof raw?.value_classification === 'string' ? raw.value_classification : 'Unknown',
    timestampMs: tsSec * 1000,
  };
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`feargreed ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFearGreed(limit = 30): Promise<FearGreedSnapshot> {
  const bounded = Math.max(1, Math.min(365, Math.trunc(limit)));
  const url = `${FNG_ENDPOINT}?limit=${bounded}`;

  try {
    const payload = await fetchJson(url);
    const listRaw = Array.isArray(payload?.data) ? payload.data : [];
    const points = listRaw.map(toPoint).filter((row): row is FearGreedPoint => row !== null);
    return {
      current: points[0] ?? null,
      points,
    };
  } catch (error) {
    console.error('[feargreed] fetch failed:', error);
    return { current: null, points: [] };
  }
}
