import { tick } from 'svelte';
import type { ChartPatternDetection } from '$lib/engine/patternDetector';
import type { PatternScanReport, PatternScanScope } from '$lib/chart/chartTypes';
import {
  createChartPrimaryRuntime,
  prepareChartMount,
} from './chartMountRuntime';
import type {
  ChartDataRuntimeController,
} from './chartDataRuntime';
import type {
  ChartPatternRuntimeController,
} from './chartPatternRuntime';
import type {
  ChartPositionRuntimeController,
} from './chartPositionRuntime';
import type {
  ChartRuntimeBundleController,
  CreateChartRuntimeBundleOptions,
} from './chartRuntimeBundle';
import type {
  ChartTradingViewRuntimeController,
} from './chartTradingViewRuntime';
import type { ChartPanelPatternScanOptions } from '$lib/chart/chartPanelContracts';

type ChartMode = 'agent' | 'trading';

interface ChartReloadOptions {
  symbol?: string;
  interval?: string;
  pairBase?: string;
}

interface ResolvedChartReloadOptions {
  symbol: string;
  interval: string;
  pairBase: string;
}

interface CreateChartPanelControllerOptions {
  getPrepareMountOptions: () => Parameters<typeof prepareChartMount>[0];
  applyPreparedMount: (preparedMount: Awaited<ReturnType<typeof prepareChartMount>>) => void;
  afterPreparedMount: () => void;
  buildRuntimeBundleOptions: () => CreateChartRuntimeBundleOptions;
  getCleanup: () => (() => void) | null;
  setCleanup: (cleanup: (() => void) | null) => void;
  getRuntimeBundle: () => ChartRuntimeBundleController | null;
  setRuntimeBundle: (bundle: ChartRuntimeBundleController | null) => void;
  getDataRuntime: () => ChartDataRuntimeController | null;
  setDataRuntime: (runtime: ChartDataRuntimeController | null) => void;
  getTradingViewRuntime: () => ChartTradingViewRuntimeController | null;
  setTradingViewRuntime: (runtime: ChartTradingViewRuntimeController | null) => void;
  getPatternRuntime: () => ChartPatternRuntimeController | null;
  setPatternRuntime: (runtime: ChartPatternRuntimeController | null) => void;
  getPositionRuntime: () => ChartPositionRuntimeController | null;
  setPositionRuntime: (runtime: ChartPositionRuntimeController | null) => void;
  disposeChartSupportRuntimes: () => void;
  handleMountError: (error: unknown) => void;
  resetChartDataLoadTransientState: () => void;
  resolveLoadRequest: (options?: ChartReloadOptions) => ResolvedChartReloadOptions;
  getChartMode: () => ChartMode;
  setChartModeState: (mode: ChartMode) => void;
  getChartPair: () => string;
  getChartTimeframe: () => string;
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  resizeAgentChart: () => void;
  activateTradeDrawing: (dir?: 'LONG' | 'SHORT') => Promise<void>;
  runPatternDetection: (
    scope?: PatternScanScope,
    options?: { fallbackToFull?: boolean },
  ) => PatternScanReport;
  getOverlayPatterns: () => ChartPatternDetection[];
  focusPatternRange: (pattern: ChartPatternDetection) => void;
  renderDrawings: () => void;
  pushChartNotice: (message: string) => void;
  clearScheduledPatternScan: () => void;
}

export interface ChartPanelController {
  mount(): Promise<void>;
  dispose(): void;
  reloadChartData(options?: ChartReloadOptions): Promise<void>;
  runCleanup(): void;
  setChartMode(mode: ChartMode): Promise<void>;
  syncTradingView(): void;
  retryTradingView(): void;
  runPatternScanFromIntel(options?: ChartPanelPatternScanOptions): Promise<PatternScanReport>;
  activateTradeDrawing(dir?: 'LONG' | 'SHORT'): Promise<void>;
}

function disposeRuntime<T extends { dispose(): void }>(
  runtime: T | null,
  clear: () => void,
) {
  if (!runtime) return;
  runtime.dispose();
  clear();
}

export function createChartPanelController(
  options: CreateChartPanelControllerOptions,
): ChartPanelController {
  function runCleanup() {
    const cleanup = options.getCleanup();
    if (cleanup) {
      options.setCleanup(null);
      cleanup();
      return;
    }

    const runtimeBundle = options.getRuntimeBundle();
    if (runtimeBundle) {
      runtimeBundle.dispose();
      options.setRuntimeBundle(null);
      options.setDataRuntime(null);
      options.setTradingViewRuntime(null);
      options.setPatternRuntime(null);
      options.setPositionRuntime(null);
    }

    disposeRuntime(options.getDataRuntime(), () => options.setDataRuntime(null));
    disposeRuntime(options.getTradingViewRuntime(), () => options.setTradingViewRuntime(null));
    disposeRuntime(options.getPatternRuntime(), () => options.setPatternRuntime(null));
    disposeRuntime(options.getPositionRuntime(), () => options.setPositionRuntime(null));
    options.disposeChartSupportRuntimes();
  }

  async function reloadChartData(runtimeOptions: ChartReloadOptions = {}) {
    const runtime = options.getDataRuntime();
    if (!runtime) return;
    options.resetChartDataLoadTransientState();
    await runtime.load(options.resolveLoadRequest(runtimeOptions));
  }

  async function setChartMode(mode: ChartMode) {
    if (mode === options.getChartMode()) return;
    options.setChartModeState(mode);
    options.emitGtm('terminal_chart_mode_change', { mode });
    await tick();
    await tick();
    if (mode === 'trading') {
      options.getTradingViewRuntime()?.setMode('trading');
      return;
    }

    options.getTradingViewRuntime()?.setMode('agent');
    await tick();
    options.resizeAgentChart();
  }

  function syncTradingView() {
    options.getTradingViewRuntime()?.sync(options.getChartMode());
  }

  function retryTradingView() {
    options.emitGtm('terminal_tradingview_retry', {
      pair: options.getChartPair(),
      timeframe: options.getChartTimeframe(),
    });
    options.getTradingViewRuntime()?.retry();
  }

  async function runPatternScanFromIntel(
    runtimeOptions: ChartPanelPatternScanOptions = {},
  ): Promise<PatternScanReport> {
    const scope = runtimeOptions.scope ?? 'visible';
    if (options.getChartMode() !== 'agent') {
      await setChartMode('agent');
      await tick();
    }

    const result = options.runPatternDetection(scope);
    const overlayPatterns = options.getOverlayPatterns();
    if ((runtimeOptions.focus ?? true) && overlayPatterns.length > 0) {
      options.focusPatternRange(overlayPatterns[0]);
      options.renderDrawings();
    }
    options.pushChartNotice(result.message);
    options.emitGtm('terminal_pattern_scan_from_intel', {
      pair: options.getChartPair(),
      timeframe: options.getChartTimeframe(),
      scope: result.scope,
      candle_count: result.candleCount,
      pattern_count: result.patternCount,
    });
    return result;
  }

  async function activateTradeDrawing(dir?: 'LONG' | 'SHORT') {
    await options.activateTradeDrawing(dir);
  }

  async function mount() {
    try {
      const preparedMount = await prepareChartMount(options.getPrepareMountOptions());
      options.applyPreparedMount(preparedMount);
      options.afterPreparedMount();

      const primaryRuntime = createChartPrimaryRuntime({
        runtimeBundleOptions: options.buildRuntimeBundleOptions(),
        setRuntimeBundle: options.setRuntimeBundle,
        setDataRuntime: options.setDataRuntime,
        setTradingViewRuntime: options.setTradingViewRuntime,
        setPositionRuntime: options.setPositionRuntime,
        setPatternRuntime: options.setPatternRuntime,
        disposeChartSupportRuntimes: options.disposeChartSupportRuntimes,
      });

      options.setCleanup(primaryRuntime.cleanup);
      await reloadChartData();
    } catch (error) {
      options.handleMountError(error);
      runCleanup();
    }
  }

  function dispose() {
    options.clearScheduledPatternScan();
    runCleanup();
  }

  return {
    mount,
    dispose,
    reloadChartData,
    runCleanup,
    setChartMode,
    syncTradingView,
    retryTradingView,
    runPatternScanFromIntel,
    activateTradeDrawing,
  };
}
