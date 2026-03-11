import type { ChartPanelHandle, WarRoomHandle } from './terminalTypes';

type TerminalViewport = 'mobile' | 'tablet' | 'desktop';

export function createTerminalPanelRuntime(params: {
  getViewport: () => TerminalViewport;
  getWarRoomRef: () => WarRoomHandle | null;
  getMobileChartRef: () => ChartPanelHandle | null;
  getTabletChartRef: () => ChartPanelHandle | null;
  getDesktopChartRef: () => ChartPanelHandle | null;
  hasPendingChartScan: () => boolean;
  setPendingChartScan: (pending: boolean) => void;
}) {
  function getActiveChartPanel(): ChartPanelHandle | null {
    const viewport = params.getViewport();
    if (viewport === 'mobile') return params.getMobileChartRef();
    if (viewport === 'tablet') return params.getTabletChartRef();
    return params.getDesktopChartRef();
  }

  function tryTriggerWarRoomScan(): boolean {
    const warRoomRef = params.getWarRoomRef();
    if (!warRoomRef || typeof warRoomRef.triggerScanFromChart !== 'function') return false;
    warRoomRef.triggerScanFromChart();
    return true;
  }

  function flushPendingChartScan() {
    if (!params.hasPendingChartScan()) return;
    if (tryTriggerWarRoomScan()) {
      params.setPendingChartScan(false);
    }
  }

  return {
    flushPendingChartScan,
    getActiveChartPanel,
    hasPendingChartScan: params.hasPendingChartScan,
    setPendingChartScan: params.setPendingChartScan,
    tryTriggerWarRoomScan,
  };
}
