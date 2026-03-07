<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { gameState } from '$lib/stores/gameState';
  import {
    pairToSymbol,
    type BinanceKline
  } from '$lib/api/binance';
  import { livePrices } from '$lib/stores/priceStore';
  import { getBaseSymbolFromPair } from '$lib/utils/price';
  import {
    toBinanceInterval,
  } from '$lib/utils/timeframe';
  import { openQuickTrade, type TradeDirection } from '$lib/stores/quickTradeStore';
  import type { ChartPatternDetection } from '$lib/engine/patternDetector';
  import type { IChartApi, ISeriesApi } from 'lightweight-charts';
  import ChartPanelShell from './chart/ChartPanelShell.svelte';
  import {
    type ChartTheme,
    FALLBACK_THEME,
  } from './ChartTheme';
  import type { DrawingMode, DrawingAnchorPoint, DrawingItem, AgentTradeSetup, TradePlanDraft, ChartMarker, PatternScanScope, PatternScanReport } from '$lib/chart/chartTypes';
  import type { IndicatorKey } from '$lib/chart/chartTypes';
  import { formatPrice, formatCompact, clampRoundPrice, normalizeChartTime } from '$lib/chart/chartCoordinates';
  import { isCompactViewport, gtmEvent } from '$lib/chart/chartHelpers';
  import { BAR_SPACING, MAX_DRAWINGS, getIndicatorProfile } from '$lib/chart/chartIndicators';
  import {
    type ChartDataRuntimeController,
  } from './chart/chartDataRuntime';
  import {
    type ChartTradingViewRuntimeController,
  } from './chart/chartTradingViewRuntime';
  import {
    type ChartPatternRuntimeController,
  } from './chart/chartPatternRuntime';
  import {
    type ChartPositionRuntimeController,
  } from './chart/chartPositionRuntime';
  import {
    createChartTradePlanRuntime,
    type ChartTradePlanRuntimeController,
  } from './chart/chartTradePlanRuntime';
  import {
    type TradePreviewDraft,
    type TrendlineDraft,
  } from './chart/chartDrawingSession';
  import {
    createChartDrawingRuntime,
    type ChartDrawingRuntimeController,
  } from './chart/chartDrawingRuntime';
  import {
    createChartOverlayRuntime,
    type AgentPriceLines,
    type ChartOverlayRuntimeController,
  } from './chart/chartOverlayRuntime';
  import {
    createChartViewportRuntime,
    type ChartViewportRuntimeController,
  } from './chart/chartViewportRuntime';
  import {
    createChartActionRuntime,
    type ChartActionRuntimeController,
  } from './chart/chartActionRuntime';
  import {
    createChartPriceRuntime,
    type ChartPriceRuntimeController,
  } from './chart/chartPriceRuntime';
  import {
    type ChartRuntimeBundleController,
    type CreateChartRuntimeBundleOptions,
  } from './chart/chartRuntimeBundle';
  import {
    createChartMaPeriodBindings,
    prepareChartMount,
  } from './chart/chartMountRuntime';
  import {
    createChartPanelController,
  } from './chart/chartPanelController';

  // ═══ Props ═══
  interface Props {
    posEntry?: number | null;
    posTp?: number | null;
    posSl?: number | null;
    posDir?: string;
    showPosition?: boolean;
    advancedMode?: boolean;
    enableTradeLineEntry?: boolean;
    uiPreset?: 'default' | 'tradingview';
    requireTradeConfirm?: boolean;
    chatFirstMode?: boolean;
    chatTradeReady?: boolean;
    chatTradeDir?: 'LONG' | 'SHORT';
    hasScanned?: boolean;
    activeTradeSetup?: AgentTradeSetup | null;
    agentMarkers?: ChartMarker[];
    agentAnnotations?: Array<{
      id: string; icon: string; name: string; color: string; label: string;
      detail: string; yPercent: number; xPercent: number;
      type: 'ob' | 'funding' | 'whale' | 'signal';
    }>;
    onScanRequest?: (detail: { source: string; pair: string; timeframe: string }) => void;
    onChatRequest?: (detail: { source: string; pair: string; timeframe: string }) => void;
    onCommunitySignal?: (detail: {
      pair: string; dir: 'LONG' | 'SHORT'; entry: number; tp: number; sl: number;
      conf: number; source: string; reason: string; openCopyTrade: boolean;
    }) => void;
    onPriceUpdate?: (detail: { price: number }) => void;
    onDragTP?: (detail: { price: number }) => void;
    onDragSL?: (detail: { price: number }) => void;
    onDragEntry?: (detail: { price: number }) => void;
    onClearTradeSetup?: () => void;
  }
  interface ChartPanelEvents {
    scanrequest: { source: string; pair: string; timeframe: string };
    chatrequest: { source: string; pair: string; timeframe: string };
    communitysignal: {
      pair: string;
      dir: 'LONG' | 'SHORT';
      entry: number;
      tp: number;
      sl: number;
      conf: number;
      source: string;
      reason: string;
      openCopyTrade: boolean;
      evidence?: import('$lib/terminal/signalEvidence').SignalEvidence;
    };
    priceUpdate: { price: number };
    dragTP: { price: number };
    dragSL: { price: number };
    dragEntry: { price: number };
    clearTradeSetup: void;
  }
  let {
    posEntry = null,
    posTp = null,
    posSl = null,
    posDir = 'LONG',
    showPosition = false,
    advancedMode = false,
    enableTradeLineEntry = false,
    uiPreset = 'default',
    requireTradeConfirm = false,
    chatFirstMode = false,
    chatTradeReady = false,
    chatTradeDir = 'LONG',
    hasScanned = false,
    activeTradeSetup = null,
    agentMarkers = [],
    agentAnnotations = [],
    onScanRequest = () => {},
    onChatRequest = () => {},
    onCommunitySignal = () => {},
    onPriceUpdate = () => {},
    onDragTP = () => {},
    onDragSL = () => {},
    onDragEntry = () => {},
    onClearTradeSetup = () => {},
  }: Props = $props();
  const dispatch = createEventDispatcher<ChartPanelEvents>();

  function emitScanRequest(detail: ChartPanelEvents['scanrequest']) {
    onScanRequest(detail);
    dispatch('scanrequest', detail);
  }

  function emitChatRequest(detail: ChartPanelEvents['chatrequest']) {
    onChatRequest(detail);
    dispatch('chatrequest', detail);
  }

  function emitCommunitySignal(detail: ChartPanelEvents['communitysignal']) {
    onCommunitySignal(detail);
    dispatch('communitysignal', detail);
  }

  function emitPriceUpdate(detail: ChartPanelEvents['priceUpdate']) {
    onPriceUpdate(detail);
    dispatch('priceUpdate', detail);
  }

  function emitDrag(target: 'dragTP' | 'dragSL' | 'dragEntry', detail: { price: number }) {
    if (target === 'dragTP') onDragTP(detail);
    else if (target === 'dragSL') onDragSL(detail);
    else onDragEntry(detail);
    dispatch(target, detail);
  }

  function emitClearTradeSetup() {
    onClearTradeSetup();
    dispatch('clearTradeSetup');
  }

  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null;
  let lwcModule: typeof import('lightweight-charts') | null = null;
  let series: ISeriesApi<'Candlestick'> | null = $state(null);
  let volumeSeries: ISeriesApi<'Histogram'> | null = null;
  let cleanup: (() => void) | null = null;
  let chartRuntimeBundle: ChartRuntimeBundleController | null = null;
  let chartDataRuntime: ChartDataRuntimeController | null = null;

  // ═══ Indicator Series ═══
  let ma7Series: ISeriesApi<'Line'> | null = null;
  let ma20Series: ISeriesApi<'Line'> | null = null;
  let ma25Series: ISeriesApi<'Line'> | null = null;
  let ma60Series: ISeriesApi<'Line'> | null = null;
  let ma99Series: ISeriesApi<'Line'> | null = null;
  let ma120Series: ISeriesApi<'Line'> | null = null;
  let rsiSeries: ISeriesApi<'Line'> | null = null;
  let volumePaneIndex: number | null = null;
  let rsiPaneIndex: number | null = null;
  let klineCache = $state<BinanceKline[]>([]);

  // ═══ Incremental indicator state (avoid full recompute on each WS tick) ═══
  let _rsiAvgGain = 0;
  let _rsiAvgLoss = 0;
  let _maRunSum: Record<number, number> = {}; // period → running sum for O(1) MA updates
  // MA period config for data-driven WS updates (rebuilt when series refs change in loadKlines)
  let _maPeriods: Array<{ p: number; s: ISeriesApi<'Line'> | null; setVal: (v: number) => void }> = [];

  // ═══ Cached MA values for template display ═══
  let ma7Val = $state(0);
  let ma20Val = $state(0);
  let ma25Val = $state(0);
  let ma60Val = $state(0);
  let ma99Val = $state(0);
  let ma120Val = $state(0);
  let rsiVal = $state(0);
  let latestVolume = $state(0);

  // ═══ Chart Mode ═══
  let chartMode: 'agent' | 'trading' = $state('agent');
  let tvContainer = $state<HTMLDivElement | null>(null);
  let tvLoading = $state(false);
  let tvError = $state('');
  let tvSafeMode = $state(false);
  let _tvFallbackTried = $state(false);
  let chartTradingViewRuntime: ChartTradingViewRuntimeController | null = null;

  // ═══ Drawing Tools ═══
  let drawingCanvas = $state<HTMLCanvasElement | null>(null);
  let drawingMode: DrawingMode = $state('none');
  let drawings = $state<DrawingItem[]>([]);
  let currentDrawing: TrendlineDraft | null = null;
  let tradePreview: TradePreviewDraft | null = $state(null);
  let pendingTradePlan: TradePlanDraft | null = $state(null);
  let ratioTrackEl = $state<HTMLButtonElement | null>(null);
  let chartTradePlanRuntime: ChartTradePlanRuntimeController | null = null;
  let chartDrawingRuntime: ChartDrawingRuntimeController | null = null;
  let chartOverlayRuntime: ChartOverlayRuntimeController | null = null;
  let chartViewportRuntime: ChartViewportRuntimeController | null = null;
  let chartActionRuntime: ChartActionRuntimeController | null = null;
  let chartPriceRuntime: ChartPriceRuntimeController | null = null;
  let isDrawing = $state(false);
  let drawingsVisible = $state(true);
  let _agentCloseBtn: { x: number; y: number; r: number } | null = null; // ✕ button hit area
  let chartNotice = $state('');
  let _chartNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  // (posEntry, posTp, posSl, posDir, showPosition, advancedMode, enableTradeLineEntry,
  //  uiPreset, requireTradeConfirm, chatFirstMode, chatTradeReady, chatTradeDir,
  //  hasScanned, activeTradeSetup — all via $props() above)

  let agentPriceLines: AgentPriceLines = { tp: null, entry: null, sl: null };

  // agentMarkers — via $props() above
  let patternMarkers: ChartMarker[] = $state([]);
  let overlayPatterns: ChartPatternDetection[] = $state([]);
  let chartPatternRuntime: ChartPatternRuntimeController | null = null;
  let chartPositionRuntime: ChartPositionRuntimeController | null = null;

  // agentAnnotations — via $props() above

  const storeState = $derived($gameState);
  const symbol = $derived(pairToSymbol(storeState.pair));
  const interval = $derived(toBinanceInterval(storeState.timeframe));
  const pairBaseLabel = $derived((storeState.pair?.split('/')?.[0] || 'BTC').toUpperCase());
  const pairQuoteLabel = $derived((storeState.pair?.split('/')?.[1] || 'USDT').toUpperCase());
  const pairBaseFallbackSymbol = $derived(getBaseSymbolFromPair(storeState.pair) || 'BTC');
  const pairBaseFallbackPrice = $derived(storeState.bases[pairBaseFallbackSymbol as keyof typeof storeState.bases] || storeState.bases.BTC || 0);

  let indicatorEnabled: Record<IndicatorKey, boolean> = $state({
    ma20: true,
    ma60: true,
    ma120: true,
    ma7: true,
    ma25: true,
    ma99: true,
    rsi: true,
    vol: true,
  });
  let chartVisualMode: 'focus' | 'full' = $state('focus');
  let showIndicatorLegend = $state(true);
  let indicatorStripState: 'expanded' | 'collapsed' | 'hidden' = $state('collapsed');
  const isTvLikePreset = $derived(uiPreset === 'tradingview');
  let _indicatorProfileApplied: string | null = null;
  let barSpacing: number = BAR_SPACING.DEFAULT;
  let autoScaleY = $state(true);

  let chartTheme: ChartTheme = $state(FALLBACK_THEME);

  function pushChartNotice(msg: string) {
    chartNotice = msg;
    if (_chartNoticeTimer) clearTimeout(_chartNoticeTimer);
    _chartNoticeTimer = setTimeout(() => {
      chartNotice = '';
      _chartNoticeTimer = null;
    }, 2800);
  }

  function toChartPrice(y: number): number | null {
    if (!series) return null;
    try { return series.coordinateToPrice(y); } catch { return null; }
  }

  function toChartY(price: number): number | null {
    if (!series) return null;
    try { return series.priceToCoordinate(price); } catch { return null; }
  }

  function toChartTime(x: number): number | null {
    if (!chart || !drawingCanvas || !Number.isFinite(x)) return null;
    try {
      const clampedX = Math.max(0, Math.min(x, drawingCanvas.width));
      const rawTime = chart.timeScale().coordinateToTime(clampedX as any);
      const parsedTime = normalizeChartTime(rawTime);
      if (parsedTime !== null) return parsedTime;
    } catch {}

    try {
      const logical = chart.timeScale().coordinateToLogical(x as any);
      if (logical !== null && Number.isFinite(logical) && klineCache.length > 0) {
        const idx = Math.max(0, Math.min(klineCache.length - 1, Math.round(logical)));
        const time = klineCache[idx]?.time;
        if (Number.isFinite(time)) return time;
      }
    } catch {}
    return null;
  }

  function toChartX(time: number): number | null {
    if (!chart || !Number.isFinite(time)) return null;
    try {
      const x = chart.timeScale().timeToCoordinate(time as any);
      if (Number.isFinite(x)) return x;
    } catch {}
    return null;
  }

  function toDrawingAnchor(x: number, y: number): DrawingAnchorPoint | null {
    const time = toChartTime(x);
    const price = toChartPrice(y);
    if (time === null || price === null || !Number.isFinite(price)) return null;
    return { time, price: clampRoundPrice(price) };
  }

  chartOverlayRuntime = createChartOverlayRuntime({
    getChart: () => chart,
    getSeries: () => series,
    getChartContainer: () => chartContainer,
    getDrawingCanvas: () => drawingCanvas,
    getChartMode: () => chartMode,
    getOverlayPatterns: () => overlayPatterns,
    getActiveTradeSetup: () => activeTradeSetup,
    getDrawingsVisible: () => drawingsVisible,
    getDrawings: () => drawings,
    getDrawingMode: () => drawingMode,
    getTradePreview: () => tradePreview,
    getChartTheme: () => chartTheme,
    getLivePrice: () => livePrice,
    getToChartX: () => toChartX,
    getToChartY: () => toChartY,
    getToChartPrice: () => toChartPrice,
    getAgentPriceLines: () => agentPriceLines,
    setAgentPriceLines: (next) => {
      agentPriceLines = next;
    },
    setAgentCloseButton: (next) => {
      _agentCloseBtn = next;
    },
  });
  const renderDrawings = () => chartOverlayRuntime?.render();
  const resizeDrawingCanvas = () => chartOverlayRuntime?.resizeCanvas();
  const applyAgentTradeSetup = (setup: AgentTradeSetup | null) => chartOverlayRuntime?.applyAgentTradeSetup(setup);
  chartViewportRuntime = createChartViewportRuntime({
    getChart: () => chart,
    getSeriesRefs: () => ({
      ma7Series,
      ma20Series,
      ma25Series,
      ma60Series,
      ma99Series,
      ma120Series,
      rsiSeries,
      volumeSeries,
    }),
    getPaneIndexes: () => ({
      volumePaneIndex,
      rsiPaneIndex,
    }),
    getIndicatorEnabled: () => indicatorEnabled,
    getBarSpacing: () => barSpacing,
    setBarSpacing: (next) => {
      barSpacing = next;
    },
    getAutoScaleY: () => autoScaleY,
    setAutoScaleY: (next) => {
      autoScaleY = next;
    },
    renderDrawings,
    pushChartNotice,
  });

  // getPlannedTradeOrder — imported from chart/chartDrawingEngine.ts
  chartTradePlanRuntime = createChartTradePlanRuntime({
    getPendingTradePlan: () => pendingTradePlan,
    setPendingTradePlan: (plan) => {
      pendingTradePlan = plan;
    },
    getRatioTrackElement: () => ratioTrackEl,
    openQuickTrade: ({ pair, dir, entry, tp, sl, source, note }) => {
      openQuickTrade(pair, dir, entry, tp, sl, source, note);
    },
    emitGtm: gtmEvent,
    pushChartNotice,
    formatPrice,
  });
  chartDrawingRuntime = createChartDrawingRuntime({
    getDrawingCanvas: () => drawingCanvas,
    getChartTheme: () => chartTheme,
    getDrawingMode: () => drawingMode,
    setDrawingModeState: (mode) => {
      drawingMode = mode;
    },
    getDrawings: () => drawings,
    setDrawings: (next) => {
      drawings = next;
    },
    getCurrentDrawing: () => currentDrawing,
    setCurrentDrawing: (next) => {
      currentDrawing = next;
    },
    getTradePreview: () => tradePreview,
    setTradePreview: (next) => {
      tradePreview = next;
    },
    getPendingTradePlan: () => pendingTradePlan,
    setPendingTradePlan: (next) => {
      pendingTradePlan = next;
    },
    getIsDrawing: () => isDrawing,
    setIsDrawing: (next) => {
      isDrawing = next;
    },
    getDrawingsVisible: () => drawingsVisible,
    setDrawingsVisible: (next) => {
      drawingsVisible = next;
    },
    getLivePrice: () => livePrice,
    getPair: () => storeState.pair || 'BTC/USDT',
    getRequireTradeConfirm: () => requireTradeConfirm,
    getToChartPrice: () => toChartPrice,
    getToChartY: () => toChartY,
    getToChartTime: () => toChartTime,
    getToDrawingAnchor: () => toDrawingAnchor,
    renderDrawings,
    openQuickTrade: ({ pair, dir, entry, tp, sl, source, note }) => {
      openQuickTrade(pair, dir, entry, tp, sl, source, note);
    },
    emitGtm: gtmEvent,
    pushChartNotice,
  });
  const setTradePlanRatio = (nextLongRatio: number) => chartTradePlanRuntime?.setTradePlanRatio(nextLongRatio);
  const openTradeFromPlan = () => chartTradePlanRuntime?.openTradeFromPlan();
  const cancelTradePlan = () => chartTradePlanRuntime?.cancelTradePlan();
  const handleRatioPointerDown = (event: PointerEvent) => chartTradePlanRuntime?.handleRatioPointerDown(event);

  function applyIndicatorProfile() {
    indicatorEnabled = getIndicatorProfile(advancedMode, chartVisualMode);
  }

  const applyIndicatorVisibility = () => chartViewportRuntime?.applyIndicatorVisibility();
  const applyTimeScale = () => chartViewportRuntime?.applyTimeScale();
  const zoomChart = (direction: 1 | -1) => chartViewportRuntime?.zoomChart(direction);
  const fitChartRange = () => chartViewportRuntime?.fitChartRange();
  const toggleAutoScaleY = () => chartViewportRuntime?.toggleAutoScaleY();
  const resetChartScale = () => chartViewportRuntime?.resetChartScale();

  function toggleIndicator(key: IndicatorKey) {
    indicatorEnabled = { ...indicatorEnabled, [key]: !indicatorEnabled[key] };
    applyIndicatorVisibility();
    gtmEvent('terminal_indicator_toggle', { indicator: key, enabled: indicatorEnabled[key] });
  }

  function setChartVisualMode(mode: 'focus' | 'full') {
    if (chartVisualMode === mode) return;
    chartVisualMode = mode;
    gtmEvent('terminal_chart_visual_mode', { mode });
  }

  function toggleIndicatorLegend() {
    showIndicatorLegend = !showIndicatorLegend;
    gtmEvent('terminal_indicator_legend_toggle', { show: showIndicatorLegend });
  }

  function setIndicatorStripState(next: 'expanded' | 'collapsed' | 'hidden') {
    if (isTvLikePreset && next !== 'collapsed') return;
    if (indicatorStripState === next) return;
    indicatorStripState = next;
    gtmEvent('terminal_indicator_strip_state', { state: next });
  }

  $effect(() => {
    if (isTvLikePreset) {
      if (indicatorStripState !== 'hidden') indicatorStripState = 'hidden';
      if (showIndicatorLegend) showIndicatorLegend = false;
    }
  });

  $effect(() => {
    pendingTradePlan;
    chartTradePlanRuntime?.sync();
  });

  $effect(() => {
    const profileKey = advancedMode ? `advanced:${chartVisualMode}` : 'basic';
    if (_indicatorProfileApplied !== profileKey) {
      _indicatorProfileApplied = profileKey;
      applyIndicatorProfile();
      applyIndicatorVisibility();
    }
  });

  // OI/OBV removed — 3-pane layout (candles, volume, RSI) for stability

  // ═══════════════════════════════════════════
  //  TRADINGVIEW WIDGET
  // ═══════════════════════════════════════════

  function disposeChartSupportRuntimes() {
    if (chartTradePlanRuntime) {
      chartTradePlanRuntime.dispose();
      chartTradePlanRuntime = null;
    }
    if (chartPriceRuntime) {
      chartPriceRuntime.dispose();
      chartPriceRuntime = null;
    }
    if (chartActionRuntime) {
      chartActionRuntime.dispose();
      chartActionRuntime = null;
    }
    if (chartViewportRuntime) {
      chartViewportRuntime.dispose();
      chartViewportRuntime = null;
    }
    if (chartOverlayRuntime) {
      chartOverlayRuntime.dispose();
      chartOverlayRuntime = null;
    }
    if (chartDrawingRuntime) {
      chartDrawingRuntime.dispose();
      chartDrawingRuntime = null;
    }
  }

  async function setChartMode(mode: 'agent' | 'trading') {
    if (mode === chartMode) return;
    chartMode = mode;
    gtmEvent('terminal_chart_mode_change', { mode });
    await tick();
    await tick();
    if (mode === 'trading') {
      chartTradingViewRuntime?.setMode('trading');
      return;
    }

    chartTradingViewRuntime?.setMode('agent');
    await tick();
    if (chart && chartContainer) {
      chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
      chart.timeScale().fitContent();
    }
  }

  $effect(() => {
    chartMode;
    tvContainer;
    storeState.pair;
    storeState.timeframe;
    chartTradingViewRuntime?.sync(chartMode);
  });

  function retryTradingView() {
    gtmEvent('terminal_tradingview_retry', {
      pair: storeState.pair,
      timeframe: storeState.timeframe,
    });
    chartTradingViewRuntime?.retry();
  }

  // ═══════════════════════════════════════════
  //  DRAWING TOOLS
  // ═══════════════════════════════════════════

  const setDrawingMode = (mode: DrawingMode) => chartDrawingRuntime?.setDrawingMode(mode);
  const toggleDrawingsVisible = () => chartDrawingRuntime?.toggleDrawingsVisible();
  const clearAllDrawings = () => chartDrawingRuntime?.clearAllDrawings();
  const handleDrawingMouseDown = (event: MouseEvent) => chartDrawingRuntime?.handleMouseDown(event);
  const handleDrawingMouseMove = (event: MouseEvent) => chartDrawingRuntime?.handleMouseMove(event);
  const handleDrawingMouseUp = (event: MouseEvent) => chartDrawingRuntime?.handleMouseUp(event);
  chartActionRuntime = createChartActionRuntime({
    getPair: () => storeState.pair || 'BTC/USDT',
    getTimeframe: () => storeState.timeframe,
    getLivePrice: () => livePrice,
    getActiveTradeSetup: () => activeTradeSetup,
    getChatTradeReady: () => chatTradeReady,
    getChatTradeDir: () => chatTradeDir,
    getEnableTradeLineEntry: () => enableTradeLineEntry,
    getChartMode: () => chartMode,
    clearPendingTradePlan: () => {
      pendingTradePlan = null;
    },
    updateGameState: (patch) => {
      gameState.update((state) => ({
        ...state,
        ...patch,
      }));
    },
    reloadChartData,
    setChartMode,
    setDrawingMode: (mode) => {
      setDrawingMode(mode);
    },
    emitScanRequest,
    emitChatRequest,
    emitCommunitySignal,
    getIndicatorSnapshot: () => ({
      rsi: rsiVal,
      ma20: ma20Val,
      ma60: ma60Val,
      ma120: ma120Val,
    }),
    getOverlayPatterns: () => overlayPatterns.map((p) => ({
      kind: p.kind,
      shortName: p.shortName,
      direction: p.direction,
      status: p.status,
      confidence: p.confidence,
    })),
    emitGtm: gtmEvent,
    pushChartNotice,
  });
  const changePair = (pair: string) => chartActionRuntime?.changePair(pair);
  const changeTF = (timeframe: string) => chartActionRuntime?.changeTimeframe(timeframe);
  const requestAgentScan = () => chartActionRuntime?.requestAgentScan();
  const publishCommunitySignal = (
    dir: 'LONG' | 'SHORT',
    options?: { openCopyTrade?: boolean; sourceContext?: string },
  ) => chartActionRuntime?.publishCommunitySignal(dir, options);
  const requestChatAssist = () => chartActionRuntime?.requestChatAssist();

  function clearDetectedPatterns() {
    chartPatternRuntime?.clearDetectedPatterns();
  }

  function scheduleVisiblePatternScan() {
    chartPatternRuntime?.scheduleVisiblePatternScan();
  }

  function runPatternDetection(
    scope: PatternScanScope = 'visible',
    opts: { fallbackToFull?: boolean } = {}
  ): PatternScanReport {
    if (!chartPatternRuntime) {
      return {
        ok: false,
        scope,
        candleCount: klineCache.length,
        patternCount: 0,
        patterns: [],
        message: '패턴 런타임이 아직 준비되지 않았습니다.',
      };
    }
    return chartPatternRuntime.runPatternDetection(scope, opts);
  }

  function focusPatternRange(pattern: ChartPatternDetection) {
    chartPatternRuntime?.focusPatternRange(pattern);
  }

  function forcePatternScan() {
    const result = runPatternDetection('visible');
    pushChartNotice(result.message);
  }

  export async function runPatternScanFromIntel(
    options: { scope?: PatternScanScope; focus?: boolean } = {},
  ): Promise<PatternScanReport> {
    const scope = options.scope ?? 'visible';
    if (chartMode !== 'agent') {
      await setChartMode('agent');
      await tick();
    }

    const result = runPatternDetection(scope);
    if ((options.focus ?? true) && overlayPatterns.length > 0) {
      focusPatternRange(overlayPatterns[0]);
      renderDrawings();
    }
    pushChartNotice(result.message);
    gtmEvent('terminal_pattern_scan_from_intel', {
      pair: storeState.pair,
      timeframe: storeState.timeframe,
      scope: result.scope,
      candle_count: result.candleCount,
      pattern_count: result.patternCount,
    });
    return result;
  }

  // ═══════════════════════════════════════════
  //  PRICE & POSITION
  // ═══════════════════════════════════════════

  let livePrice = $state(0);
  let priceChange24h = $state(0);
  let high24h = $state(0);
  let low24h = $state(0);
  let quoteVolume24h = $state(0);
  let isLoading = $state(true);
  let error = $state('');
  chartPriceRuntime = createChartPriceRuntime({
    getCurrentPair: () => storeState.pair,
    getLivePrices: () => ({ ...$livePrices }),
    getPairBaseFallbackSymbol: () => pairBaseFallbackSymbol,
    getPairBaseFallbackPrice: () => pairBaseFallbackPrice,
    clearScheduledPatternScan: () => {
      chartPatternRuntime?.clearScheduledScan();
    },
    setPriceChange24h: (value) => {
      priceChange24h = value;
    },
    setHigh24h: (value) => {
      high24h = value;
    },
    setLow24h: (value) => {
      low24h = value;
    },
    setQuoteVolume24h: (value) => {
      quoteVolume24h = value;
    },
  });
  const flushPriceUpdate = (price: number, pairBase: string) => chartPriceRuntime?.flushPriceUpdate(price, pairBase);
  const throttledPriceUpdate = (price: number, pairBase: string) =>
    chartPriceRuntime?.throttledPriceUpdate(price, pairBase);
  const set24hStats = (next: {
    priceChange24h?: number;
    high24h?: number;
    low24h?: number;
    quoteVolume24h?: number;
  }) => chartPriceRuntime?.update24hStats(next);

  function getIndicatorState() {
    return {
      rsiAvgGain: _rsiAvgGain,
      rsiAvgLoss: _rsiAvgLoss,
      maRunSum: _maRunSum,
    };
  }

  function setIndicatorState(next: {
    rsiAvgGain: number;
    rsiAvgLoss: number;
    maRunSum: Record<number, number>;
  }) {
    _rsiAvgGain = next.rsiAvgGain;
    _rsiAvgLoss = next.rsiAvgLoss;
    _maRunSum = next.maRunSum;
  }

  const resetChartDataLoadTransientState = () => chartPriceRuntime?.resetTransientState();
  const getFallbackLivePrice = () => chartPriceRuntime?.getFallbackLivePrice() ?? null;

  function applyBootstrapState(bootstrap: Awaited<ReturnType<typeof prepareChartMount>>['bootstrap']) {
    chart = bootstrap.chart;
    series = bootstrap.series;
    ma7Series = bootstrap.ma7Series;
    ma20Series = bootstrap.ma20Series;
    ma25Series = bootstrap.ma25Series;
    ma60Series = bootstrap.ma60Series;
    ma99Series = bootstrap.ma99Series;
    ma120Series = bootstrap.ma120Series;
    volumeSeries = bootstrap.volumeSeries;
    rsiSeries = bootstrap.rsiSeries;
    volumePaneIndex = bootstrap.volumePaneIndex;
    rsiPaneIndex = bootstrap.rsiPaneIndex;
  }

  function applyPreparedMount(preparedMount: Awaited<ReturnType<typeof prepareChartMount>>) {
    lwcModule = preparedMount.lwcModule;
    chartTheme = preparedMount.chartTheme;
    indicatorStripState = preparedMount.nextIndicatorStripState;
    showIndicatorLegend = preparedMount.nextShowIndicatorLegend;
    chartVisualMode = preparedMount.nextChartVisualMode;
    _indicatorProfileApplied = preparedMount.nextIndicatorProfileApplied;
    applyBootstrapState(preparedMount.bootstrap);
    _maPeriods = createChartMaPeriodBindings({
      bootstrap: preparedMount.bootstrap,
      setMa7Val: (value) => { ma7Val = value; },
      setMa20Val: (value) => { ma20Val = value; },
      setMa25Val: (value) => { ma25Val = value; },
      setMa60Val: (value) => { ma60Val = value; },
      setMa99Val: (value) => { ma99Val = value; },
      setMa120Val: (value) => { ma120Val = value; },
    });
  }

  function buildRuntimeBundleOptions(): CreateChartRuntimeBundleOptions {
    return {
      pattern: {
        getChart: () => chart,
        getSeries: () => series,
        getLwcModule: () => lwcModule,
        getKlineCache: () => klineCache,
        getAgentMarkers: () => agentMarkers,
        getOverlayPatterns: () => overlayPatterns,
        setOverlayPatterns: (patterns) => {
          overlayPatterns = patterns;
        },
        setPatternMarkers: (markers) => {
          patternMarkers = markers;
        },
        renderDrawings,
      },
      position: {
        getSeries: () => series,
        getChartContainer: () => chartContainer,
        getTheme: () => chartTheme,
        getShowPosition: () => showPosition,
        getPositionLevels: () => ({
          entry: posEntry,
          tp: posTp,
          sl: posSl,
          dir: posDir,
        }),
        getLivePrice: () => livePrice,
        getDragState: () => isDragging,
        setDragState: (target) => {
          isDragging = target;
        },
        getHoverState: () => hoverLine,
        setHoverState: (target) => {
          hoverLine = target;
        },
        emitDrag: (target, detail) => {
          emitDrag(
            target === 'tp' ? 'dragTP' : target === 'sl' ? 'dragSL' : 'dragEntry',
            detail,
          );
        },
      },
      tradingView: {
        getContainer: () => tvContainer,
        getThemeTarget: () => tvContainer || chartContainer,
        getPair: () => storeState.pair,
        getTimeframe: () => storeState.timeframe,
        setTheme: (theme) => {
          chartTheme = theme;
        },
        setState: (patch) => {
          if (patch.loading !== undefined) tvLoading = patch.loading;
          if (patch.error !== undefined) tvError = patch.error;
          if (patch.safeMode !== undefined) tvSafeMode = patch.safeMode;
          if (patch.fallbackTried !== undefined) _tvFallbackTried = patch.fallbackTried;
        },
      },
      data: {
        getSeriesContext: () => ({
          chart,
          series,
          volumeSeries,
          rsiSeries,
          maPeriods: _maPeriods,
          chartTheme,
        }),
        getKlineCache: () => klineCache,
        setKlineCache: (next) => {
          klineCache = next;
        },
        getIndicatorState,
        setIndicatorState,
        setRsiValue: (value) => {
          rsiVal = value;
        },
        setLatestVolume: (value) => {
          latestVolume = value;
        },
        setLivePrice: (value) => {
          livePrice = value;
        },
        set24hStats,
        setLoading: (value) => {
          isLoading = value;
        },
        setError: (value) => {
          error = value;
        },
        clearDetectedPatterns: () => {
          chartPatternRuntime?.clearDetectedPatterns();
        },
        onPatternRefresh: () => {
          chartPatternRuntime?.runPatternDetection('visible', { fallbackToFull: true });
        },
        onFlushPriceUpdate: flushPriceUpdate,
        onThrottledPriceUpdate: throttledPriceUpdate,
        onEmitPriceUpdate: emitPriceUpdate,
        getFallbackPrice: getFallbackLivePrice,
        onError: (context, err) => {
          console.error(`[ChartPanel] ${context} error:`, err);
        },
      },
      bindings: {
        chart: chart!,
        chartContainer,
        isAgentMode: () => chartMode === 'agent',
        isTradeLineEntryEnabled: () => enableTradeLineEntry,
        onScheduleVisiblePatternScan: scheduleVisiblePatternScan,
        onRenderDrawings: renderDrawings,
        onResizeDrawingCanvas: resizeDrawingCanvas,
        onSetDrawingMode: setDrawingMode,
        onZoomChart: zoomChart,
        onResetChartScale: resetChartScale,
        onFitChartRange: fitChartRange,
        onToggleDrawingsVisible: toggleDrawingsVisible,
      },
      removeChart: () => {
        if (chart) {
          chart.remove();
          chart = null;
        }
      },
    };
  }

  const chartPanelController = createChartPanelController({
    getPrepareMountOptions: () => ({
      chartContainer,
      advancedMode,
      indicatorStripState,
      showIndicatorLegend,
      chartVisualMode,
      indicatorProfileApplied: _indicatorProfileApplied,
      barSpacing,
      compactViewport: isCompactViewport(),
      applyIndicatorProfile,
    }),
    applyPreparedMount,
    afterPreparedMount: () => {
      applyTimeScale();
      applyIndicatorVisibility();
    },
    buildRuntimeBundleOptions,
    getCleanup: () => cleanup,
    setCleanup: (next) => {
      cleanup = next;
    },
    getRuntimeBundle: () => chartRuntimeBundle,
    setRuntimeBundle: (bundle) => {
      chartRuntimeBundle = bundle;
    },
    getDataRuntime: () => chartDataRuntime,
    setDataRuntime: (runtime) => {
      chartDataRuntime = runtime;
    },
    getTradingViewRuntime: () => chartTradingViewRuntime,
    setTradingViewRuntime: (runtime) => {
      chartTradingViewRuntime = runtime;
    },
    getPatternRuntime: () => chartPatternRuntime,
    setPatternRuntime: (runtime) => {
      chartPatternRuntime = runtime;
    },
    getPositionRuntime: () => chartPositionRuntime,
    setPositionRuntime: (runtime) => {
      chartPositionRuntime = runtime;
    },
    disposeChartSupportRuntimes,
    handleMountError: (mountError) => {
      error = 'Chart initialization failed';
      console.error(mountError);
    },
    resetChartDataLoadTransientState,
    resolveLoadRequest: (options = {}) => ({
      symbol: options.symbol || symbol,
      interval: options.interval || interval,
      pairBase: options.pairBase || (storeState.pair.split('/')[0] || 'BTC').toUpperCase(),
    }),
    getChartMode: () => chartMode,
    setChartModeState: (mode) => {
      chartMode = mode;
    },
    getChartPair: () => storeState.pair,
    getChartTimeframe: () => storeState.timeframe,
    emitGtm: gtmEvent,
    resizeAgentChart: () => {
      if (chart && chartContainer) {
        chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
        chart.timeScale().fitContent();
      }
    },
    getActionRuntime: () => chartActionRuntime,
    runPatternDetection,
    getOverlayPatterns: () => overlayPatterns,
    focusPatternRange,
    renderDrawings,
    pushChartNotice,
    clearScheduledPatternScan: () => {
      chartPatternRuntime?.clearScheduledScan();
    },
  });
  const runChartCleanup = () => chartPanelController.runCleanup();

  async function reloadChartData(options: {
    symbol?: string;
    interval?: string;
    pairBase?: string;
  } = {}) {
    await chartPanelController.reloadChartData(options);
  }

  $effect(() => {
    series;
    showPosition;
    posEntry;
    posTp;
    posSl;
    posDir;
    chartPositionRuntime?.syncPositionLines();
  });
  $effect(() => { if (series) { applyAgentTradeSetup(activeTradeSetup); } });

  // ═══ Drag TP/SL ═══
  let isDragging: 'tp' | 'sl' | 'entry' | null = $state(null);
  let hoverLine: 'tp' | 'sl' | 'entry' | null = $state(null);
  const handleChartMouseDown = (event: MouseEvent) => chartPositionRuntime?.handleMouseDown(event);
  const handleChartMouseMove = (event: MouseEvent) => chartPositionRuntime?.handleMouseMove(event);
  const handleChartMouseUp = () => chartPositionRuntime?.handleMouseUp();
  const handleChartWheel = (event: WheelEvent) => chartPositionRuntime?.handleWheel(event);

  $effect(() => {
    series;
    agentMarkers;
    patternMarkers;
    chartPatternRuntime?.applyCombinedMarkers();
  });

  export function getCurrentPrice() { return livePrice; }

  // ═══════════════════════════════════════════
  //  CHART INIT & DATA LOADING
  // ═══════════════════════════════════════════

  onMount(async () => {
    await chartPanelController.mount();
  });

  export async function activateTradeDrawing(dir?: 'LONG' | 'SHORT') {
    await chartPanelController.activateTradeDrawing(dir);
  }

  onDestroy(() => {
    if (_chartNoticeTimer) clearTimeout(_chartNoticeTimer);
    chartPanelController.dispose();
  });
</script>

<ChartPanelShell
    {chartMode}
    pair={storeState.pair}
    timeframe={storeState.timeframe}
    {pairBaseLabel}
    {pairQuoteLabel}
    {livePrice}
    {priceChange24h}
    {low24h}
    {high24h}
    {quoteVolume24h}
    {symbol}
    {error}
    {isLoading}
    {autoScaleY}
    {isTvLikePreset}
    {advancedMode}
    {enableTradeLineEntry}
    {chatFirstMode}
    {chatTradeReady}
    {chatTradeDir}
    {indicatorStripState}
    {chartVisualMode}
    {drawingMode}
    {drawingsVisible}
    drawingCount={drawings.length}
    hasActiveTradeSetup={!!activeTradeSetup}
    klineCount={klineCache.length}
    {showIndicatorLegend}
    {indicatorEnabled}
    {chartTheme}
    {ma7Val}
    {ma20Val}
    {ma25Val}
    {ma60Val}
    {ma99Val}
    {ma120Val}
    {rsiVal}
    {latestVolume}
    {activeTradeSetup}
    {hasScanned}
    {chartNotice}
    {showPosition}
    {posEntry}
    {posTp}
    {posSl}
    {posDir}
    {hoverLine}
    {isDragging}
    {pendingTradePlan}
    agentAnnotations={agentAnnotations}
    {tvLoading}
    tvFallbackTried={_tvFallbackTried}
    {tvError}
    {tvSafeMode}
    onChangePair={changePair}
    onChangeTimeframe={changeTF}
    onSetChartMode={(mode) => {
      void setChartMode(mode);
    }}
    onSetDrawingMode={setDrawingMode}
    onToggleDrawingsVisible={toggleDrawingsVisible}
    onClearAllDrawings={clearAllDrawings}
    onRequestChatAssist={requestChatAssist}
    onRequestAgentScan={requestAgentScan}
    onForcePatternScan={forcePatternScan}
    onPublishHeaderCommunitySignal={(dir) => {
      publishCommunitySignal(dir, {
        openCopyTrade: false,
        sourceContext: dir === 'LONG' ? 'chart-view-long' : 'chart-view-short',
      });
    }}
    onRestoreIndicatorStrip={() => setIndicatorStripState('expanded')}
    onSetChartVisualMode={setChartVisualMode}
    onToggleIndicator={toggleIndicator}
    onToggleIndicatorLegend={toggleIndicatorLegend}
    onSetIndicatorStripState={setIndicatorStripState}
    onAgentSurfaceContainerReady={(container) => {
      chartContainer = container as HTMLDivElement;
    }}
    onChartMouseDown={handleChartMouseDown}
    onChartMouseMove={handleChartMouseMove}
    onChartMouseUp={handleChartMouseUp}
    onChartWheel={handleChartWheel}
    onZoomOut={() => zoomChart(-1)}
    onZoomIn={() => zoomChart(1)}
    onFitRange={fitChartRange}
    onToggleAutoScaleY={toggleAutoScaleY}
    onResetScale={resetChartScale}
    onCloseActiveTradeSetup={() => {
      activeTradeSetup = null;
      _agentCloseBtn = null;
      emitClearTradeSetup();
      renderDrawings();
    }}
    onExecuteActiveTrade={() => {
      if (activeTradeSetup) openQuickTrade(activeTradeSetup.pair, activeTradeSetup.dir as TradeDirection, activeTradeSetup.entry, activeTradeSetup.tp, activeTradeSetup.sl);
    }}
    onPublishTradeSignal={() => {
      if (activeTradeSetup) publishCommunitySignal(activeTradeSetup.dir, { openCopyTrade: false, sourceContext: 'trade-cta' });
    }}
    onCancelDrawing={() => setDrawingMode('none')}
    onCanvasReady={(canvas) => {
      drawingCanvas = canvas;
    }}
    onDrawingMouseDown={handleDrawingMouseDown}
    onDrawingMouseMove={handleDrawingMouseMove}
    onDrawingMouseUp={handleDrawingMouseUp}
    onCancelTradePlan={cancelTradePlan}
    onOpenTradeFromPlan={openTradeFromPlan}
    onSetTradePlanRatio={setTradePlanRatio}
    onRatioPointerDown={handleRatioPointerDown}
    onRatioTrackReady={(element) => {
      ratioTrackEl = element;
    }}
    onRetryTradingView={retryTradingView}
    onSwitchAgentMode={() => {
      void setChartMode('agent');
    }}
    onTradingViewContainerReady={(container) => {
      tvContainer = container;
    }}
  />
