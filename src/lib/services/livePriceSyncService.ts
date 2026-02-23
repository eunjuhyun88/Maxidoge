import { getLivePriceSnapshot, livePrice, type LivePriceMap } from '$lib/stores/priceStore';
import { updateAllPrices } from '$lib/stores/quickTradeStore';
import { updateTrackedPrices } from '$lib/stores/trackedSignalStore';
import { buildPriceMapHash, toNumericPriceMap } from '$lib/utils/price';

const PERSIST_INTERVAL_MS = 30_000;

let _started = false;
let _unsubscribe: (() => void) | null = null;
let _persistTimer: ReturnType<typeof setInterval> | null = null;
let _latestSnapshot: LivePriceMap = {};
let _lastPersistHash = '';

function applyLocalSync(snapshot: LivePriceMap): void {
  updateAllPrices(snapshot, { syncServer: false });
  updateTrackedPrices(snapshot);
}

function persistQuickTrades(snapshot: LivePriceMap): void {
  const normalized = toNumericPriceMap(snapshot);
  const hash = buildPriceMapHash(normalized);
  if (!hash || hash === _lastPersistHash) return;

  _lastPersistHash = hash;
  updateAllPrices(snapshot, { syncServer: true });
}

export function ensureLivePriceSyncStarted(): void {
  if (typeof window === 'undefined') return;
  if (_started) return;
  _started = true;

  _latestSnapshot = getLivePriceSnapshot();
  applyLocalSync(_latestSnapshot);

  _unsubscribe = livePrice.subscribe((snapshot) => {
    _latestSnapshot = snapshot;
    applyLocalSync(snapshot);
  });

  _persistTimer = setInterval(() => {
    persistQuickTrades(_latestSnapshot);
  }, PERSIST_INTERVAL_MS);
}

export function stopLivePriceSync(): void {
  if (!_started) return;
  _started = false;

  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
  if (_persistTimer) {
    clearInterval(_persistTimer);
    _persistTimer = null;
  }
}
