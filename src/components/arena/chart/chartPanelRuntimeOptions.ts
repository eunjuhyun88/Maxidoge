import type { CreateChartRuntimeBundleOptions } from './chartRuntimeBundle';
import type { ChartTradingViewStatePatch } from './chartTradingViewRuntime';

type ChartBundlePositionOptions = CreateChartRuntimeBundleOptions['position'];
type ChartBundleTradingViewOptions = CreateChartRuntimeBundleOptions['tradingView'];
type ChartBundleDataOptions = CreateChartRuntimeBundleOptions['data'];
type ChartBundleBindingsOptions = CreateChartRuntimeBundleOptions['bindings'];

interface ApplyChartTradingViewStatePatchOptions {
  patch: ChartTradingViewStatePatch;
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  setSafeMode: (value: boolean) => void;
  setFallbackTried: (value: boolean) => void;
}

interface BuildChartPositionRuntimeOptionsArgs {
  getSeries: ChartBundlePositionOptions['getSeries'];
  getChartContainer: ChartBundlePositionOptions['getChartContainer'];
  getTheme: ChartBundlePositionOptions['getTheme'];
  getShowPosition: ChartBundlePositionOptions['getShowPosition'];
  getPositionLevels: ChartBundlePositionOptions['getPositionLevels'];
  getLivePrice: ChartBundlePositionOptions['getLivePrice'];
  getDragState: ChartBundlePositionOptions['getDragState'];
  setDragState: ChartBundlePositionOptions['setDragState'];
  getHoverState: ChartBundlePositionOptions['getHoverState'];
  setHoverState: ChartBundlePositionOptions['setHoverState'];
  emitChartDrag: (
    target: 'dragTP' | 'dragSL' | 'dragEntry',
    detail: { price: number },
  ) => void;
}

interface BuildChartTradingViewRuntimeOptionsArgs {
  getContainer: ChartBundleTradingViewOptions['getContainer'];
  getThemeTarget: ChartBundleTradingViewOptions['getThemeTarget'];
  getPair: ChartBundleTradingViewOptions['getPair'];
  getTimeframe: ChartBundleTradingViewOptions['getTimeframe'];
  setTheme: ChartBundleTradingViewOptions['setTheme'];
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  setSafeMode: (value: boolean) => void;
  setFallbackTried: (value: boolean) => void;
}

interface BuildChartDataRuntimeOptionsArgs {
  getSeriesContext: ChartBundleDataOptions['getSeriesContext'];
  getKlineCache: ChartBundleDataOptions['getKlineCache'];
  setKlineCache: ChartBundleDataOptions['setKlineCache'];
  getIndicatorState: ChartBundleDataOptions['getIndicatorState'];
  setIndicatorState: ChartBundleDataOptions['setIndicatorState'];
  setRsiValue: ChartBundleDataOptions['setRsiValue'];
  setLatestVolume: ChartBundleDataOptions['setLatestVolume'];
  setLivePrice: ChartBundleDataOptions['setLivePrice'];
  set24hStats: ChartBundleDataOptions['set24hStats'];
  setLoading: ChartBundleDataOptions['setLoading'];
  setError: (value: string) => void;
  onConnectionStatusChange: (status: 'live' | 'offline') => void;
  clearDetectedPatterns: ChartBundleDataOptions['clearDetectedPatterns'];
  onPatternRefresh: ChartBundleDataOptions['onPatternRefresh'];
  onFlushPriceUpdate: ChartBundleDataOptions['onFlushPriceUpdate'];
  onThrottledPriceUpdate: ChartBundleDataOptions['onThrottledPriceUpdate'];
  onEmitPriceUpdate: ChartBundleDataOptions['onEmitPriceUpdate'];
  getFallbackPrice: ChartBundleDataOptions['getFallbackPrice'];
  onError: ChartBundleDataOptions['onError'];
}

interface BuildChartRuntimeBindingOptionsArgs {
  chart: ChartBundleBindingsOptions['chart'];
  chartContainer: ChartBundleBindingsOptions['chartContainer'];
  isAgentMode: ChartBundleBindingsOptions['isAgentMode'];
  isTradeLineEntryEnabled: ChartBundleBindingsOptions['isTradeLineEntryEnabled'];
  onScheduleVisiblePatternScan: ChartBundleBindingsOptions['onScheduleVisiblePatternScan'];
  onRenderDrawings: ChartBundleBindingsOptions['onRenderDrawings'];
  onResizeDrawingCanvas: ChartBundleBindingsOptions['onResizeDrawingCanvas'];
  onSetDrawingMode: ChartBundleBindingsOptions['onSetDrawingMode'];
  onZoomChart: ChartBundleBindingsOptions['onZoomChart'];
  onResetChartScale: ChartBundleBindingsOptions['onResetChartScale'];
  onFitChartRange: ChartBundleBindingsOptions['onFitChartRange'];
  onToggleDrawingsVisible: ChartBundleBindingsOptions['onToggleDrawingsVisible'];
}

export function applyChartTradingViewStatePatch(
  options: ApplyChartTradingViewStatePatchOptions,
) {
  if (options.patch.loading !== undefined) {
    options.setLoading(options.patch.loading);
  }
  if (options.patch.error !== undefined) {
    options.setError(options.patch.error);
  }
  if (options.patch.safeMode !== undefined) {
    options.setSafeMode(options.patch.safeMode);
  }
  if (options.patch.fallbackTried !== undefined) {
    options.setFallbackTried(options.patch.fallbackTried);
  }
}

export function buildChartPositionRuntimeOptions(
  options: BuildChartPositionRuntimeOptionsArgs,
): ChartBundlePositionOptions {
  return {
    getSeries: options.getSeries,
    getChartContainer: options.getChartContainer,
    getTheme: options.getTheme,
    getShowPosition: options.getShowPosition,
    getPositionLevels: options.getPositionLevels,
    getLivePrice: options.getLivePrice,
    getDragState: options.getDragState,
    setDragState: options.setDragState,
    getHoverState: options.getHoverState,
    setHoverState: options.setHoverState,
    emitDrag: (target, detail) => {
      options.emitChartDrag(
        target === 'tp' ? 'dragTP' : target === 'sl' ? 'dragSL' : 'dragEntry',
        detail,
      );
    },
  };
}

export function buildChartTradingViewRuntimeOptions(
  options: BuildChartTradingViewRuntimeOptionsArgs,
): ChartBundleTradingViewOptions {
  return {
    getContainer: options.getContainer,
    getThemeTarget: options.getThemeTarget,
    getPair: options.getPair,
    getTimeframe: options.getTimeframe,
    setTheme: options.setTheme,
    setState: (patch) => {
      applyChartTradingViewStatePatch({
        patch,
        setLoading: options.setLoading,
        setError: options.setError,
        setSafeMode: options.setSafeMode,
        setFallbackTried: options.setFallbackTried,
      });
    },
  };
}

export function buildChartDataRuntimeOptions(
  options: BuildChartDataRuntimeOptionsArgs,
): ChartBundleDataOptions {
  return {
    getSeriesContext: options.getSeriesContext,
    getKlineCache: options.getKlineCache,
    setKlineCache: options.setKlineCache,
    getIndicatorState: options.getIndicatorState,
    setIndicatorState: options.setIndicatorState,
    setRsiValue: options.setRsiValue,
    setLatestVolume: options.setLatestVolume,
    setLivePrice: options.setLivePrice,
    set24hStats: options.set24hStats,
    setLoading: options.setLoading,
    setError: (value) => {
      options.setError(value);
      options.onConnectionStatusChange(value ? 'offline' : 'live');
    },
    clearDetectedPatterns: options.clearDetectedPatterns,
    onPatternRefresh: options.onPatternRefresh,
    onFlushPriceUpdate: options.onFlushPriceUpdate,
    onThrottledPriceUpdate: options.onThrottledPriceUpdate,
    onEmitPriceUpdate: options.onEmitPriceUpdate,
    getFallbackPrice: options.getFallbackPrice,
    onError: options.onError,
  };
}

export function buildChartRuntimeBindingOptions(
  options: BuildChartRuntimeBindingOptionsArgs,
): ChartBundleBindingsOptions {
  return {
    chart: options.chart,
    chartContainer: options.chartContainer,
    isAgentMode: options.isAgentMode,
    isTradeLineEntryEnabled: options.isTradeLineEntryEnabled,
    onScheduleVisiblePatternScan: options.onScheduleVisiblePatternScan,
    onRenderDrawings: options.onRenderDrawings,
    onResizeDrawingCanvas: options.onResizeDrawingCanvas,
    onSetDrawingMode: options.onSetDrawingMode,
    onZoomChart: options.onZoomChart,
    onResetChartScale: options.onResetChartScale,
    onFitChartRange: options.onFitChartRange,
    onToggleDrawingsVisible: options.onToggleDrawingsVisible,
  };
}
