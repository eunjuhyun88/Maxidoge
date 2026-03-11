import type { TerminalScanSummary } from '$lib/services/scanService';
import { loadFromStorage, saveToStorage } from '$lib/utils/storage';
import type { ScanTab, WarRoomScanState } from './warRoomTypes';

type StoredWarRoomScanState = Partial<WarRoomScanState> & {
  scanTabs?: unknown[];
};

function isScanTab(value: unknown): value is ScanTab {
  if (!value || typeof value !== 'object') return false;
  const tab = value as ScanTab;
  return (
    typeof tab.id === 'string' &&
    typeof tab.pair === 'string' &&
    typeof tab.timeframe === 'string' &&
    typeof tab.token === 'string' &&
    typeof tab.label === 'string' &&
    typeof tab.createdAt === 'number' &&
    Array.isArray(tab.signals)
  );
}

function normalizeScanTabLabel(tab: ScanTab): ScanTab {
  const rawLabel = String(tab.label || '').trim();
  const tokenPrefix = `${String(tab.token || '').trim()} `;
  const label = tokenPrefix && rawLabel.toUpperCase().startsWith(tokenPrefix.toUpperCase())
    ? rawLabel.slice(tokenPrefix.length).trim()
    : rawLabel;
  return { ...tab, label: label || rawLabel };
}

export function restoreWarRoomScanState(
  storageKey: string,
  maxTabs: number,
): WarRoomScanState | null {
  const parsed = loadFromStorage<StoredWarRoomScanState | null>(storageKey, null);
  if (!parsed || !Array.isArray(parsed.scanTabs)) return null;

  const scanTabs = parsed.scanTabs
    .filter(isScanTab)
    .map(normalizeScanTabLabel)
    .slice(0, maxTabs);

  if (scanTabs.length === 0) return null;

  const activeScanId =
    typeof parsed.activeScanId === 'string' && scanTabs.some((tab) => tab.id === parsed.activeScanId)
      ? parsed.activeScanId
      : scanTabs[0].id;

  return {
    activeScanId,
    activeToken: typeof parsed.activeToken === 'string' ? parsed.activeToken : 'ALL',
    scanTabs,
  };
}

export function persistWarRoomScanState(
  storageKey: string,
  state: WarRoomScanState,
  maxTabs: number,
): void {
  saveToStorage(storageKey, {
    activeScanId: state.activeScanId,
    activeToken: state.activeToken,
    scanTabs: state.scanTabs.slice(0, maxTabs),
  });
}

export function summaryToStubTab(rec: TerminalScanSummary): ScanTab {
  return {
    id: `server-${rec.scanId}`,
    pair: rec.pair,
    timeframe: rec.timeframe,
    token: rec.token,
    createdAt: rec.createdAt,
    label: rec.label,
    signals: [],
  };
}

export function mergeServerTabs(
  localTabs: ScanTab[],
  serverRecords: TerminalScanSummary[],
  maxTabs: number,
): ScanTab[] {
  const localKeys = new Set(localTabs.map((tab) => `${tab.pair}|${tab.timeframe}|${tab.createdAt}`));
  const newTabs = serverRecords
    .filter((rec) => !localKeys.has(`${rec.pair}|${rec.timeframe}|${rec.createdAt}`))
    .map(summaryToStubTab);
  return [...localTabs, ...newTabs].slice(0, maxTabs);
}

export function shouldAutoRunScan(
  scanTabs: ScanTab[],
  staleMs: number,
  now: number = Date.now(),
): boolean {
  const latestTab = scanTabs[0];
  return !latestTab || now - latestTab.createdAt > staleMs;
}
