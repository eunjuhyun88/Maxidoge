<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
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
  import {
    type ChartTheme,
    FALLBACK_THEME,
  } from './ChartTheme';
  import type { DrawingMode, DrawingAnchorPoint, DrawingItem, AgentTradeSetup, TradePlanDraft, ChartMarker, PatternScanScope, PatternScanReport } from '$lib/chart/chartTypes';
  import type { IndicatorKey } from '$lib/chart/chartTypes';
  import { formatPrice, clampRoundPrice, normalizeChartTime } from '$lib/chart/chartCoordinates';
  import { isCompactViewport, gtmEvent } from '$lib/chart/chartHelpers';
  import { BAR_SPACING, getIndicatorProfile } from '$lib/chart/chartIndicators';
  import {
    buildChartPanelShellState,
    type ChartPanelShellActions,
  } from '$lib/chart/chartPanelViewModel';
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
    type TradePreviewDraft,
    type TrendlineDraft,
  } from './chart/chartDrawingSession';
  import {
    type AgentPriceLines,
  } from './chart/chartOverlayRuntime';
  import {
    type ChartRuntimeBundleController,
    type CreateChartRuntimeBundleOptions,
  } from './chart/chartRuntimeBundle';
  import type { PrepareChartMountResult } from './chart/chartMountRuntime';
  import type { ChartPanelController } from './chart/chartPanelController';
  import type { ChartPanelSupportRuntimeController } from './chart/chartPanelSupportRuntime';
  import type { ChartDerivativesRuntimeController } from './chart/chartDerivativesRuntime';
  import {
    ensureChartClientRuntime as ensureChartClientRuntimeAssembly,
    type ChartClientRuntimeAssembly,
    type ChartMountRuntimeModule,
  } from './chart/chartClientRuntime';
  import {
    applyChartBootstrapState,
    applyChartPreparedMountState,
  } from './chart/chartPanelMountState';
  import {
    buildChartDataSeriesContext,
    buildChartIndicatorPaneIndexes,
    buildChartIndicatorSeriesRefs,
    readChartIndicatorState,
  } from './chart/chartPanelStateContext';
  import {
    buildChartDataRuntimeOptions,
    buildChartPositionRuntimeOptions,
    buildChartRuntimeBindingOptions,
    buildChartTradingViewRuntimeOptions,
  } from './chart/chartPanelRuntimeOptions';

  type ChartPanelControllerModule = typeof import('./chart/chartPanelController');
  type ChartPanelSupportRuntimeModule = typeof import('./chart/chartPanelSupportRuntime');

  const chartPanelShellModule = import('./chart/ChartPanelShell.svelte');

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
    onConnectionStatusChange?: (status: 'live' | 'offline') => void;
    onMarkScanStale?: () => void;
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
    onConnectionStatusChange = () => {},
    onMarkScanStale = () => {},
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
  let bbUpperSeries: ISeriesApi<'Line'> | null = null;
  let bbMiddleSeries: ISeriesApi<'Line'> | null = null;
  let bbLowerSeries: ISeriesApi<'Line'> | null = null;
  let macdLineSeries: ISeriesApi<'Line'> | null = null;
  let macdSignalSeries: ISeriesApi<'Line'> | null = null;
  let macdHistSeries: ISeriesApi<'Histogram'> | null = null;
  let stochKSeries: ISeriesApi<'Line'> | null = null;
  let stochDSeries: ISeriesApi<'Line'> | null = null;
  // OI/Funding/Liq series & pane indexes are managed by derivativesRuntime (lazy creation)
  let volumePaneIndex: number | null = null;
  let rsiPaneIndex: number | null = null;
  let macdPaneIndex: number | null = null;
  let stochPaneIndex: number | null = null;
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
  let chartSupportRuntime: ChartPanelSupportRuntimeController | null = null;
  let derivativesRuntime: ChartDerivativesRuntimeController | null = null;
  let isDrawing = $state(false);
  let drawingsVisible = $state(true);
  let selectedDrawingId = $state<string | null>(null);
  let primitiveDrawingCount = $state(0);
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
    bb: false,
    macd: false,
    stoch: false,
    oi: false,
    funding: false,
    liq: false,
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

  let chartMountRuntimeModule: ChartMountRuntimeModule | null = null;
  let chartClientRuntimePromise: Promise<ChartClientRuntimeAssembly> | null = null;
  let chartPanelController: ChartPanelController | null = null;

  async function setChartMode(mode: 'agent' | 'trading') {
    await ensureChartClientRuntime();
    await chartPanelController?.setChartMode(mode);
  }

  async function reloadChartData(options: {
    symbol?: string;
    interval?: string;
    pairBase?: string;
  } = {}) {
    await ensureChartClientRuntime();
    await chartPanelController?.reloadChartData(options);
  }

  function createChartSupportRuntimeInstance(
    createRuntime: ChartPanelSupportRuntimeModule['createChartPanelSupportRuntime'],
  ) {
    return createRuntime({
      overlay: {
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
        getSelectedDrawingId: () => selectedDrawingId,
        getAgentPriceLines: () => agentPriceLines,
        setAgentPriceLines: (next) => {
          agentPriceLines = next;
        },
      },
      viewport: {
        getChart: () => chart,
        getSeriesRefs: () =>
          buildChartIndicatorSeriesRefs({
            derivativesRuntime,
            ma7Series,
            ma20Series,
            ma25Series,
            ma60Series,
            ma99Series,
            ma120Series,
            rsiSeries,
            volumeSeries,
            bbUpperSeries,
            bbMiddleSeries,
            bbLowerSeries,
            macdLineSeries,
            macdSignalSeries,
            macdHistSeries,
            stochKSeries,
            stochDSeries,
          }),
        getPaneIndexes: () =>
          buildChartIndicatorPaneIndexes({
            derivativesRuntime,
            volumePaneIndex,
            rsiPaneIndex,
            macdPaneIndex,
            stochPaneIndex,
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
        renderDrawings: () => chartSupportRuntime?.renderDrawings(),
        pushChartNotice,
      },
      tradePlan: {
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
      },
      drawing: {
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
        getSelectedDrawingId: () => selectedDrawingId,
        setSelectedDrawingId: (id) => {
          selectedDrawingId = id;
        },
        getLivePrice: () => livePrice,
        getPair: () => storeState.pair || 'BTC/USDT',
        getTimeframe: () => storeState.timeframe || '1h',
        getRequireTradeConfirm: () => requireTradeConfirm,
        getToChartPrice: () => toChartPrice,
        getToChartY: () => toChartY,
        getToChartX: () => toChartX,
        getToChartTime: () => toChartTime,
        getToDrawingAnchor: () => toDrawingAnchor,
        renderDrawings: () => chartSupportRuntime?.renderDrawings(),
        openQuickTrade: ({ pair, dir, entry, tp, sl, source, note }) => {
          openQuickTrade(pair, dir, entry, tp, sl, source, note);
        },
        emitGtm: gtmEvent,
        pushChartNotice,
        getChart: () => chart,
        getSeries: () => series,
        getPrimitiveDrawingCount: () => primitiveDrawingCount,
        setPrimitiveDrawingCount: (count) => {
          primitiveDrawingCount = count;
        },
        getKlines: () => klineCache,
      },
      action: {
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
          chartSupportRuntime?.setDrawingMode(mode);
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
        markScanStale: onMarkScanStale,
      },
      price: {
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
      },
    });
  }
  const renderDrawings = () => chartSupportRuntime?.renderDrawings();
  const resizeDrawingCanvas = () => chartSupportRuntime?.resizeDrawingCanvas();

  function disposeChartSupportRuntimes() {
    if (!chartSupportRuntime) return;
    chartSupportRuntime.dispose();
    chartSupportRuntime = null;
  }

  function applyIndicatorProfile() {
    indicatorEnabled = getIndicatorProfile(advancedMode, chartVisualMode);
  }

  const applyIndicatorVisibility = () => chartSupportRuntime?.applyIndicatorVisibility();
  const applyTimeScale = () => chartSupportRuntime?.applyTimeScale();
  const zoomChart = (direction: 1 | -1) => chartSupportRuntime?.zoomChart(direction);
  const fitChartRange = () => chartSupportRuntime?.fitChartRange();
  const toggleAutoScaleY = () => chartSupportRuntime?.toggleAutoScaleY();
  const resetChartScale = () => chartSupportRuntime?.resetChartScale();

  function toggleIndicator(key: IndicatorKey) {
    indicatorEnabled = { ...indicatorEnabled, [key]: !indicatorEnabled[key] };
    applyIndicatorVisibility();
    // Trigger derivatives data fetch when OI/Funding/Liq toggled on
    if ((key === 'oi' || key === 'funding' || key === 'liq') && indicatorEnabled[key]) {
      derivativesRuntime?.forceSync(storeState.pair, storeState.timeframe);
    }
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
    chartSupportRuntime?.syncTradePlan();
  });

  $effect(() => {
    const profileKey = advancedMode ? `advanced:${chartVisualMode}` : 'basic';
    if (_indicatorProfileApplied !== profileKey) {
      _indicatorProfileApplied = profileKey;
      applyIndicatorProfile();
      applyIndicatorVisibility();
    }
  });

  // ── Derivatives data sync (OI / Funding / Liquidations) ─────
  $effect(() => {
    const pair = storeState.pair;
    const timeframe = storeState.timeframe;
    const oi = indicatorEnabled.oi;
    const funding = indicatorEnabled.funding;
    const liq = indicatorEnabled.liq;
    if ((oi || funding || liq) && pair && timeframe) {
      derivativesRuntime?.sync(pair, timeframe);
    }
  });

  $effect(() => {
    chartMode;
    tvContainer;
    storeState.pair;
    storeState.timeframe;
    chartPanelController?.syncTradingView();
  });

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
    await ensureChartClientRuntime();
    return chartPanelController?.runPatternScanFromIntel(options) ?? {
      ok: false,
      scope: options.scope ?? 'visible',
      candleCount: klineCache.length,
      patternCount: 0,
      patterns: [],
      message: '패턴 런타임이 아직 준비되지 않았습니다.',
    };
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

  function getIndicatorState() {
    return readChartIndicatorState({
      rsiAvgGain: _rsiAvgGain,
      rsiAvgLoss: _rsiAvgLoss,
      maRunSum: _maRunSum,
    });
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

  const resetChartDataLoadTransientState = () => chartSupportRuntime?.resetTransientState();
  const getFallbackLivePrice = () => chartSupportRuntime?.getFallbackLivePrice() ?? null;

  function applyBootstrapState(bootstrap: PrepareChartMountResult['bootstrap']) {
    applyChartBootstrapState({
      bootstrap,
      setChart: (next) => { chart = next; },
      setSeries: (next) => { series = next; },
      setMa7Series: (next) => { ma7Series = next; },
      setMa20Series: (next) => { ma20Series = next; },
      setMa25Series: (next) => { ma25Series = next; },
      setMa60Series: (next) => { ma60Series = next; },
      setMa99Series: (next) => { ma99Series = next; },
      setMa120Series: (next) => { ma120Series = next; },
      setVolumeSeries: (next) => { volumeSeries = next; },
      setRsiSeries: (next) => { rsiSeries = next; },
      setBbUpperSeries: (next) => { bbUpperSeries = next; },
      setBbMiddleSeries: (next) => { bbMiddleSeries = next; },
      setBbLowerSeries: (next) => { bbLowerSeries = next; },
      setMacdLineSeries: (next) => { macdLineSeries = next; },
      setMacdSignalSeries: (next) => { macdSignalSeries = next; },
      setMacdHistSeries: (next) => { macdHistSeries = next; },
      setStochKSeries: (next) => { stochKSeries = next; },
      setStochDSeries: (next) => { stochDSeries = next; },
      setVolumePaneIndex: (next) => { volumePaneIndex = next; },
      setRsiPaneIndex: (next) => { rsiPaneIndex = next; },
      setMacdPaneIndex: (next) => { macdPaneIndex = next; },
      setStochPaneIndex: (next) => { stochPaneIndex = next; },
    });
  }

  function applyPreparedMount(preparedMount: PrepareChartMountResult) {
    applyChartPreparedMountState({
      preparedMount,
      chartMountRuntimeModule,
      applyBootstrapState,
      setLwcModule: (next) => { lwcModule = next; },
      setChartTheme: (next) => { chartTheme = next; },
      setIndicatorStripState: (next) => { indicatorStripState = next; },
      setShowIndicatorLegend: (next) => { showIndicatorLegend = next; },
      setChartVisualMode: (next) => { chartVisualMode = next; },
      setIndicatorProfileApplied: (next) => { _indicatorProfileApplied = next; },
      setMaPeriods: (next) => { _maPeriods = next; },
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
      position:
        buildChartPositionRuntimeOptions({
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
          emitChartDrag: emitDrag,
        }),
      tradingView:
        buildChartTradingViewRuntimeOptions({
          getContainer: () => tvContainer,
          getThemeTarget: () => tvContainer || chartContainer,
          getPair: () => storeState.pair,
          getTimeframe: () => storeState.timeframe,
          setTheme: (theme) => {
            chartTheme = theme;
          },
          setLoading: (value) => {
            tvLoading = value;
          },
          setError: (value) => {
            tvError = value;
          },
          setSafeMode: (value) => {
            tvSafeMode = value;
          },
          setFallbackTried: (value) => {
            _tvFallbackTried = value;
          },
        }),
      data:
        buildChartDataRuntimeOptions({
          getSeriesContext: () =>
            buildChartDataSeriesContext({
              chart,
              series,
              volumeSeries,
              rsiSeries,
              bbUpperSeries,
              bbMiddleSeries,
              bbLowerSeries,
              macdLineSeries,
              macdSignalSeries,
              macdHistSeries,
              stochKSeries,
              stochDSeries,
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
          set24hStats: (next) => chartSupportRuntime?.update24hStats(next),
          setLoading: (value) => {
            isLoading = value;
          },
          setError: (value) => {
            error = value;
          },
          onConnectionStatusChange,
          clearDetectedPatterns: () => {
            chartPatternRuntime?.clearDetectedPatterns();
          },
          onPatternRefresh: () => {
            chartPatternRuntime?.runPatternDetection('visible', { fallbackToFull: true });
          },
          onFlushPriceUpdate: (price, pairBase) =>
            chartSupportRuntime?.flushPriceUpdate(price, pairBase),
          onThrottledPriceUpdate: (price, pairBase) =>
            chartSupportRuntime?.throttledPriceUpdate(price, pairBase),
          onEmitPriceUpdate: emitPriceUpdate,
          getFallbackPrice: getFallbackLivePrice,
          onError: (context, err) => {
            console.error(`[ChartPanel] ${context} error:`, err);
          },
        }),
      bindings:
        buildChartRuntimeBindingOptions({
          chart: chart!,
          chartContainer,
          isAgentMode: () => chartMode === 'agent',
          isTradeLineEntryEnabled: () => enableTradeLineEntry,
          onScheduleVisiblePatternScan: scheduleVisiblePatternScan,
          onRenderDrawings: renderDrawings,
          onResizeDrawingCanvas: resizeDrawingCanvas,
          onSetDrawingMode: (mode) => chartSupportRuntime?.setDrawingMode(mode),
          onZoomChart: zoomChart,
          onResetChartScale: resetChartScale,
          onFitChartRange: fitChartRange,
          onToggleDrawingsVisible: () => chartSupportRuntime?.toggleDrawingsVisible(),
        }),
      removeChart: () => {
        if (chart) {
          chart.remove();
          chart = null;
        }
      },
    };
  }

  function createChartPanelControllerInstance(
    createController: ChartPanelControllerModule['createChartPanelController'],
  ) {
    return createController({
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
      activateTradeDrawing: (dir) => chartSupportRuntime?.activateTradeDrawing(dir) ?? Promise.resolve(),
      runPatternDetection,
      getOverlayPatterns: () => overlayPatterns,
      focusPatternRange,
      renderDrawings,
      pushChartNotice,
      clearScheduledPatternScan: () => {
        chartPatternRuntime?.clearScheduledScan();
      },
    });
  }

  async function ensureChartClientRuntime() {
    const clientRuntime = await ensureChartClientRuntimeAssembly({
      getCachedPromise: () => chartClientRuntimePromise,
      setCachedPromise: (next) => {
        chartClientRuntimePromise = next;
      },
      getSupportRuntime: () => chartSupportRuntime,
      setSupportRuntime: (runtime) => {
        chartSupportRuntime = runtime;
      },
      getDerivativesRuntime: () => derivativesRuntime,
      setDerivativesRuntime: (runtime) => {
        derivativesRuntime = runtime;
      },
      getPanelController: () => chartPanelController,
      setPanelController: (controller) => {
        chartPanelController = controller;
      },
      createSupportRuntime: (createRuntime) =>
        createChartSupportRuntimeInstance(createRuntime),
      createDerivativesRuntime: (createRuntime) =>
        createRuntime({
          getChart: () => chart,
          getLwc: () => lwcModule,
          getIndicatorEnabled: () => indicatorEnabled,
          getTheme: () => chartTheme,
          onPanesChanged: () => applyIndicatorVisibility(),
        }),
      createPanelController: (createController) =>
        createChartPanelControllerInstance(createController),
    });

    chartMountRuntimeModule = clientRuntime.mountModule;
    chartPanelController = clientRuntime.panelController;
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
  $effect(() => { if (series) { chartSupportRuntime?.applyAgentTradeSetup(activeTradeSetup); } });

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

  // ═══════════════════════════════════════════
  //  CHART INIT & DATA LOADING
  // ═══════════════════════════════════════════

  onMount(async () => {
    await ensureChartClientRuntime();
    await chartPanelController?.mount();
  });

  export async function activateTradeDrawing(dir?: 'LONG' | 'SHORT') {
    await ensureChartClientRuntime();
    await chartPanelController?.activateTradeDrawing(dir);
  }

  onDestroy(() => {
    if (_chartNoticeTimer) clearTimeout(_chartNoticeTimer);
    chartPanelController?.dispose();
    chartPanelController = null;
    chartSupportRuntime = null;
    derivativesRuntime?.dispose();
    derivativesRuntime = null;
    chartClientRuntimePromise = null;
  });

  const chartPanelShellState = $derived(buildChartPanelShellState({
    chartMode,
    pair: storeState.pair,
    timeframe: storeState.timeframe,
    pairBaseLabel,
    pairQuoteLabel,
    livePrice,
    priceChange24h,
    low24h,
    high24h,
    quoteVolume24h,
    symbol,
    error,
    isLoading,
    autoScaleY,
    isTvLikePreset,
    advancedMode,
    enableTradeLineEntry,
    chatFirstMode,
    chatTradeReady,
    chatTradeDir,
    indicatorStripState,
    chartVisualMode,
    drawingMode,
    drawingsVisible,
    drawingsLength: primitiveDrawingCount + drawings.length,
    klineCount: klineCache.length,
    showIndicatorLegend,
    indicatorEnabled,
    chartTheme,
    ma7Val,
    ma20Val,
    ma25Val,
    ma60Val,
    ma99Val,
    ma120Val,
    rsiVal,
    latestVolume,
    activeTradeSetup,
    hasScanned,
    chartNotice,
    showPosition,
    posEntry,
    posTp,
    posSl,
    posDir,
    hoverLine,
    isDragging,
    pendingTradePlan,
    agentAnnotations,
    tvLoading,
    tvFallbackTried: _tvFallbackTried,
    tvError,
    tvSafeMode,
  }));

  const chartPanelShellActions = {
    onChangePair: (pair) => chartSupportRuntime?.changePair(pair),
    onChangeTimeframe: (timeframe) => chartSupportRuntime?.changeTimeframe(timeframe),
    onSetChartMode: (mode) => {
      void setChartMode(mode);
    },
    onSetDrawingMode: (mode) => chartSupportRuntime?.setDrawingMode(mode),
    onToggleDrawingsVisible: () => chartSupportRuntime?.toggleDrawingsVisible(),
    onClearAllDrawings: () => chartSupportRuntime?.clearAllDrawings(),
    onRequestChatAssist: () => chartSupportRuntime?.requestChatAssist(),
    onRequestAgentScan: () => chartSupportRuntime?.requestAgentScan(),
    onForcePatternScan: forcePatternScan,
    onPublishHeaderCommunitySignal: (dir) => {
      chartSupportRuntime?.publishCommunitySignal(dir, {
        openCopyTrade: false,
        sourceContext: dir === 'LONG' ? 'chart-view-long' : 'chart-view-short',
      });
    },
    onRestoreIndicatorStrip: () => setIndicatorStripState('expanded'),
    onSetChartVisualMode: setChartVisualMode,
    onToggleIndicator: toggleIndicator,
    onToggleIndicatorLegend: toggleIndicatorLegend,
    onSetIndicatorStripState: setIndicatorStripState,
    onAgentSurfaceContainerReady: (container) => {
      chartContainer = container as HTMLDivElement;
    },
    onChartMouseDown: handleChartMouseDown,
    onChartMouseMove: handleChartMouseMove,
    onChartMouseUp: handleChartMouseUp,
    onChartWheel: handleChartWheel,
    onZoomOut: () => zoomChart(-1),
    onZoomIn: () => zoomChart(1),
    onFitRange: fitChartRange,
    onToggleAutoScaleY: toggleAutoScaleY,
    onResetScale: resetChartScale,
    onCloseActiveTradeSetup: () => {
      activeTradeSetup = null;
      emitClearTradeSetup();
      renderDrawings();
    },
    onExecuteActiveTrade: () => {
      if (activeTradeSetup) {
        openQuickTrade(
          activeTradeSetup.pair,
          activeTradeSetup.dir as TradeDirection,
          activeTradeSetup.entry,
          activeTradeSetup.tp,
          activeTradeSetup.sl,
        );
      }
    },
    onPublishTradeSignal: () => {
      if (activeTradeSetup) {
        chartSupportRuntime?.publishCommunitySignal(activeTradeSetup.dir, {
          openCopyTrade: false,
          sourceContext: 'trade-cta',
        });
      }
    },
    onCancelDrawing: () => chartSupportRuntime?.setDrawingMode('none'),
    onCanvasReady: (canvas) => {
      drawingCanvas = canvas;
    },
    onDrawingMouseDown: (event) => chartSupportRuntime?.handleDrawingMouseDown(event),
    onDrawingMouseMove: (event) => chartSupportRuntime?.handleDrawingMouseMove(event),
    onDrawingMouseUp: (event) => chartSupportRuntime?.handleDrawingMouseUp(event),
    onCancelTradePlan: () => chartSupportRuntime?.cancelTradePlan(),
    onOpenTradeFromPlan: () => chartSupportRuntime?.openTradeFromPlan(),
    onSetTradePlanRatio: (nextLongRatio) => chartSupportRuntime?.setTradePlanRatio(nextLongRatio),
    onRatioPointerDown: (event) => chartSupportRuntime?.handleRatioPointerDown(event),
    onRatioTrackReady: (element) => {
      ratioTrackEl = element;
    },
    onCancelCurrentAction: () => chartSupportRuntime?.cancelCurrentAction(),
    onDeleteSelectedDrawing: () => chartSupportRuntime?.deleteSelectedDrawing(),
    onRetryTradingView: () => chartPanelController?.retryTradingView(),
    onSwitchAgentMode: () => {
      void setChartMode('agent');
    },
    onTradingViewContainerReady: (container) => {
      tvContainer = container;
    },
  } satisfies ChartPanelShellActions;
</script>

{#await chartPanelShellModule then chartPanelShellNs}
  {@const ChartPanelShell = chartPanelShellNs.default}
  <ChartPanelShell {...chartPanelShellState} {...chartPanelShellActions} />
{/await}
