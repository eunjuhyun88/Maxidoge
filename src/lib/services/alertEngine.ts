// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Background Alert Engine (client-side)
// ═══════════════════════════════════════════════════════════════
// Periodically polls the opportunity scan API, detects changes,
// and fires notifications + toasts via the notification store.
//
// Usage: import { alertEngine } from '$lib/services/alertEngine';
//        alertEngine.start();   // called from +layout.svelte or terminal page
//        alertEngine.stop();    // on destroy if needed

import { notifications, toasts } from '$lib/stores/notificationStore';

// ── Types ────────────────────────────────────────────────────

interface AlertCoin {
  symbol: string;
  name: string;
  price: number;
  change1h: number;
  change24h: number;
  totalScore: number;
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  reasons: string[];
  alerts: string[];
}

interface AlertItem {
  symbol: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  score: number;
}

interface ScanSnapshot {
  coins: AlertCoin[];
  alerts: AlertItem[];
  macroRegime: string;
  scannedAt: number;
}

// ── Config ───────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;      // 5 minutes
const MIN_INTERVAL_MS = 2 * 60 * 1000;           // minimum 2 minutes
const SCORE_THRESHOLD_NOTIFY = 65;                // notify for scores ≥ this
const RANK_CHANGE_THRESHOLD = 3;                  // notify if coin jumps ≥ 3 ranks
const PRICE_SPIKE_THRESHOLD_1H = 5;               // % change 1h to trigger spike alert
const NEW_ENTRY_NOTIFY = true;                    // notify when new coin enters top 5

// ── State ────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null;
let _initTimer: ReturnType<typeof setTimeout> | null = null;
let _running = false;
let _intervalMs = DEFAULT_INTERVAL_MS;
let _previousSnapshot: ScanSnapshot | null = null;
let _scanCount = 0;
let _lastScanAt = 0;

// ── Core Logic ───────────────────────────────────────────────

async function fetchScanData(): Promise<ScanSnapshot | null> {
  try {
    const res = await fetch('/api/terminal/opportunity-scan?limit=15', {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.ok || !json?.data) return null;

    return {
      coins: json.data.coins ?? [],
      alerts: json.data.alerts ?? [],
      macroRegime: json.data.macroBackdrop?.regime ?? 'neutral',
      scannedAt: json.data.scannedAt ?? Date.now(),
    };
  } catch (err) {
    console.warn('[AlertEngine] fetch error:', err);
    return null;
  }
}

function detectChanges(prev: ScanSnapshot, curr: ScanSnapshot): void {
  const prevTop5 = prev.coins.slice(0, 5);
  const currTop5 = curr.coins.slice(0, 5);
  const prevSymbols = new Set(prevTop5.map(c => c.symbol));
  const currSymbols = new Set(currTop5.map(c => c.symbol));

  // 1. New entrant to top 5
  if (NEW_ENTRY_NOTIFY) {
    for (const coin of currTop5) {
      if (!prevSymbols.has(coin.symbol)) {
        notifications.addNotification({
          type: 'alert',
          title: `🎯 NEW TOP 5: ${coin.symbol}`,
          body: `${coin.name} entered top picks — Score ${coin.totalScore}/100 (${coin.direction.toUpperCase()}) ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(1)}%`,
          dismissable: true,
        });
      }
    }
  }

  // 2. Rank changes (big jumps)
  const prevRankMap = new Map(prev.coins.map((c, i) => [c.symbol, i]));
  for (let i = 0; i < currTop5.length; i++) {
    const sym = currTop5[i].symbol;
    const prevRank = prevRankMap.get(sym);
    if (prevRank != null && prevRank - i >= RANK_CHANGE_THRESHOLD) {
      toasts.addToast({
        level: 'medium',
        title: `📈 ${sym} jumped from #${prevRank + 1} → #${i + 1}`,
        score: currTop5[i].totalScore,
      });
    }
  }

  // 3. Macro regime change
  if (prev.macroRegime !== curr.macroRegime) {
    const icon = curr.macroRegime === 'risk-on' ? '🟢' : curr.macroRegime === 'risk-off' ? '🔴' : '🟡';
    notifications.addNotification({
      type: curr.macroRegime === 'risk-off' ? 'critical' : 'info',
      title: `${icon} MACRO REGIME → ${curr.macroRegime.toUpperCase()}`,
      body: `Macro environment shifted from ${prev.macroRegime} to ${curr.macroRegime}. Adjust strategy accordingly.`,
      dismissable: true,
    });
  }

  // 4. 1h price spike on any coin in top 10
  for (const coin of curr.coins.slice(0, 10)) {
    if (Math.abs(coin.change1h) >= PRICE_SPIKE_THRESHOLD_1H) {
      const prevCoin = prev.coins.find(c => c.symbol === coin.symbol);
      // Only fire if this spike is new (prev change1h was below threshold)
      if (!prevCoin || Math.abs(prevCoin.change1h) < PRICE_SPIKE_THRESHOLD_1H) {
        notifications.addNotification({
          type: Math.abs(coin.change1h) >= 10 ? 'critical' : 'alert',
          title: `⚡ ${coin.symbol} ${coin.change1h > 0 ? 'SURGE' : 'DROP'} ${coin.change1h > 0 ? '+' : ''}${coin.change1h.toFixed(1)}%`,
          body: `${coin.name} moved ${coin.change1h.toFixed(1)}% in the last hour. Score: ${coin.totalScore}/100.`,
          dismissable: true,
        });
      }
    }
  }

  // 5. New critical/warning alerts not seen before
  const prevAlertKeys = new Set(prev.alerts.map(a => `${a.symbol}:${a.type}`));
  for (const alert of curr.alerts) {
    if (alert.severity === 'critical' || alert.severity === 'warning') {
      const key = `${alert.symbol}:${alert.type}`;
      if (!prevAlertKeys.has(key)) {
        notifications.addNotification({
          type: alert.severity === 'critical' ? 'critical' : 'alert',
          title: `${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alert.symbol} ${alert.type.toUpperCase()}`,
          body: alert.message,
          dismissable: true,
        });
      }
    }
  }

  // 6. High-score opportunity appeared
  for (const coin of currTop5) {
    if (coin.totalScore >= SCORE_THRESHOLD_NOTIFY) {
      const prevCoin = prev.coins.find(c => c.symbol === coin.symbol);
      if (!prevCoin || prevCoin.totalScore < SCORE_THRESHOLD_NOTIFY) {
        toasts.addToast({
          level: 'high',
          title: `🎯 ${coin.symbol} high-score opportunity (${coin.totalScore}/100)`,
          score: coin.totalScore,
        });
      }
    }
  }
}

async function runScanCycle(): Promise<void> {
  const snapshot = await fetchScanData();
  if (!snapshot || snapshot.coins.length === 0) return;

  _scanCount++;
  _lastScanAt = Date.now();

  // Compare with previous (skip first scan — just establishes baseline)
  if (_previousSnapshot && _previousSnapshot.coins.length > 0) {
    try {
      detectChanges(_previousSnapshot, snapshot);
    } catch (err) {
      console.warn('[AlertEngine] detectChanges error:', err);
    }
  }

  _previousSnapshot = snapshot;
}

// ── Public API ───────────────────────────────────────────────

export const alertEngine = {
  /** Start background monitoring. Idempotent. */
  start(intervalMs?: number) {
    if (_running) return;
    _running = true;
    _intervalMs = Math.max(MIN_INTERVAL_MS, intervalMs ?? DEFAULT_INTERVAL_MS);

    // Initial scan after 30s delay (let the page load first)
    _initTimer = setTimeout(() => {
      _initTimer = null;
      if (!_running) return;
      void runScanCycle();
    }, 30_000);

    // Periodic scans
    _timer = setInterval(() => {
      void runScanCycle();
    }, _intervalMs);

    console.log(`[AlertEngine] Started (interval: ${_intervalMs / 1000}s)`);
  },

  /** Stop background monitoring. */
  stop() {
    _running = false;
    if (_initTimer) {
      clearTimeout(_initTimer);
      _initTimer = null;
    }
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
    console.log('[AlertEngine] Stopped');
  },

  /** Force an immediate scan cycle. */
  async scanNow(): Promise<void> {
    await runScanCycle();
  },

  /** Get engine status. */
  status() {
    return {
      running: _running,
      intervalMs: _intervalMs,
      scanCount: _scanCount,
      lastScanAt: _lastScanAt,
      hasPreviousData: _previousSnapshot != null,
    };
  },

  /** Update polling interval. */
  setInterval(ms: number) {
    _intervalMs = Math.max(MIN_INTERVAL_MS, ms);
    if (_running) {
      // Restart with new interval
      alertEngine.stop();
      alertEngine.start(_intervalMs);
    }
  },
};
