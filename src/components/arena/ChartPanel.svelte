<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
  import { gameState } from '$lib/stores/gameState';
  import { fetchKlines, subscribeKlines, pairToSymbol, type BinanceKline } from '$lib/api/binance';
  import {
    CORE_TIMEFRAME_OPTIONS,
    formatTimeframeLabel,
    normalizeTimeframe,
    toBinanceInterval,
    toTradingViewInterval,
  } from '$lib/utils/timeframe';
  import { TOKENS, TOKEN_CATEGORIES } from '$lib/data/tokens';
  import TokenDropdown from '../shared/TokenDropdown.svelte';

  const dispatch = createEventDispatcher();

  let chartContainer: HTMLDivElement;
  let chart: any;
  let series: any;
  let volumeSeries: any;
  let cleanup: (() => void) | null = null;
  let wsCleanup: (() => void) | null = null;

  // ═══ Indicator Series ═══
  let ma7Series: any;
  let ma25Series: any;
  let ma99Series: any;
  let rsiSeries: any;
  let klineCache: BinanceKline[] = [];
  let _isLoadingMore = false;
  let _noMoreHistory = false; // true when Binance returns 0 older candles
  let _currentSymbol = '';
  let _currentInterval = '';

  // ═══ Incremental indicator state (avoid full recompute on each WS tick) ═══
  let _rsiAvgGain = 0;
  let _rsiAvgLoss = 0;

  // ═══ Cached MA values for template display ═══
  let ma7Val = 0;
  let ma25Val = 0;
  let ma99Val = 0;

  // ═══ Chart Mode ═══
  let chartMode: 'agent' | 'trading' = 'agent';
  let tvWidget: any = null;
  let tvContainer: HTMLDivElement;
  let tvScriptLoaded = false;
  let tvLoading = false;

  // ═══ Drawing Tools ═══
  let drawingCanvas: HTMLCanvasElement;
  let drawingMode: 'none' | 'hline' | 'trendline' = 'none';
  let drawings: Array<{ type: 'hline' | 'trendline'; points: Array<{ x: number; y: number }>; color: string }> = [];
  let currentDrawing: { type: 'hline' | 'trendline'; points: Array<{ x: number; y: number }> } | null = null;
  let isDrawing = false;

  // Position lines
  let tpLine: any = null;
  let entryLine: any = null;
  let slLine: any = null;

  export let posEntry: number | null = null;
  export let posTp: number | null = null;
  export let posSl: number | null = null;
  export let posDir: string = 'LONG';
  export let showPosition = false;

  export let agentMarkers: Array<{
    time: number; position: 'aboveBar' | 'belowBar'; color: string;
    shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown'; text: string;
  }> = [];

  export let agentAnnotations: Array<{
    id: string; icon: string; name: string; color: string; label: string;
    detail: string; yPercent: number; xPercent: number;
    type: 'ob' | 'funding' | 'whale' | 'signal';
  }> = [];

  let selectedAnnotation: typeof agentAnnotations[0] | null = null;

  let state = $gameState;
  $: state = $gameState;
  $: symbol = pairToSymbol(state.pair);
  $: interval = toBinanceInterval(state.timeframe);

  // ═══════════════════════════════════════════
  //  INDICATOR COMPUTATION (optimised)
  // ═══════════════════════════════════════════

  function computeSMA(data: { time: any; close: number }[], period: number) {
    const result: { time: any; value: number }[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i].close;
      if (i >= period) sum -= data[i - period].close;
      if (i >= period - 1) result.push({ time: data[i].time, value: sum / period });
    }
    return result;
  }

  function computeRSI(data: { time: any; close: number }[], period = 14) {
    if (data.length < period + 1) return [];
    const result: { time: any; value: number }[] = [];
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const d = data[i].close - data[i - 1].close;
      if (d > 0) avgGain += d; else avgLoss -= d;
    }
    avgGain /= period; avgLoss /= period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: data[period].time, value: rsi });
    for (let i = period + 1; i < data.length; i++) {
      const d = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
      result.push({ time: data[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
    }
    // Stash running state for incremental WS updates
    _rsiAvgGain = avgGain;
    _rsiAvgLoss = avgLoss;
    return result;
  }

  // OI/OBV removed — 3-pane layout (candles, volume, RSI) for stability

  // ═══════════════════════════════════════════
  //  TRADINGVIEW WIDGET
  // ═══════════════════════════════════════════

  function pairToTVSymbol(pair: string) { return 'BINANCE:' + pair.replace('/', ''); }
  function tfToTVInterval(tf: string) { return toTradingViewInterval(tf); }

  function initTradingView() {
    if (!tvContainer) return;
    tvLoading = true;
    try {
      destroyTradingView();
      const widgetDiv = tvContainer.querySelector('#tradingview_widget');
      if (!widgetDiv) return;
      widgetDiv.innerHTML = '';

      const iframe = document.createElement('iframe');
      const params = new URLSearchParams({
        symbol: pairToTVSymbol(state.pair), interval: tfToTVInterval(state.timeframe),
        hidesidetoolbar: '0', symboledit: '1', saveimage: '1', toolbarbg: '0a0a1a',
        theme: 'dark', style: '1', timezone: 'Etc/UTC', withdateranges: '1', locale: 'en',
        hide_top_toolbar: '0', allow_symbol_change: '1',
        studies: ['Volume@tv-basicstudies', 'MASimple@tv-basicstudies', 'RSI@tv-basicstudies', 'OBV@tv-basicstudies'].join('\x1f'),
        studies_overrides: '{}',
        overrides: JSON.stringify({
          'mainSeriesProperties.candleStyle.upColor': '#00ff88',
          'mainSeriesProperties.candleStyle.downColor': '#ff2d55',
          'mainSeriesProperties.candleStyle.wickUpColor': '#00ff88',
          'mainSeriesProperties.candleStyle.wickDownColor': '#ff2d55',
          'paneProperties.background': '#0a0a1a',
          'paneProperties.vertGridProperties.color': 'rgba(255,230,0,.03)',
          'paneProperties.horzGridProperties.color': 'rgba(255,230,0,.03)',
        }),
      });
      iframe.src = `https://www.tradingview.com/widgetembed/?${params.toString()}`;
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
      iframe.allow = 'fullscreen';
      iframe.loading = 'lazy';
      iframe.onload = () => { tvLoading = false; tvScriptLoaded = true; };
      iframe.onerror = () => { tvLoading = false; };
      widgetDiv.appendChild(iframe);
      tvWidget = { iframe, container: widgetDiv };
      setTimeout(() => { tvLoading = false; }, 8000);
    } catch (e) { console.error('[ChartPanel] TV init error:', e); tvLoading = false; }
  }

  function destroyTradingView() {
    if (tvWidget?.iframe) tvWidget.iframe.src = 'about:blank';
    tvWidget = null;
    if (tvContainer) {
      const w = tvContainer.querySelector('#tradingview_widget');
      if (w) w.innerHTML = '';
    }
  }

  async function setChartMode(mode: 'agent' | 'trading') {
    if (mode === chartMode) return;
    chartMode = mode;
    await tick(); await tick();
    if (mode === 'trading') {
      let attempts = 0;
      while (!tvContainer && attempts < 5) { await new Promise(r => setTimeout(r, 50)); await tick(); attempts++; }
      if (tvContainer) initTradingView();
    } else {
      destroyTradingView();
      await tick();
      if (chart && chartContainer) { chart.resize(chartContainer.clientWidth, chartContainer.clientHeight); chart.timeScale().fitContent(); }
    }
  }

  // Debounced TradingView re-init (prevents rapid pair/TF switching from thrashing)
  let _tvInitTimer: ReturnType<typeof setTimeout> | null = null;
  $: if (chartMode === 'trading' && tvWidget && state.pair && state.timeframe) {
    if (_tvInitTimer) clearTimeout(_tvInitTimer);
    _tvInitTimer = setTimeout(() => { initTradingView(); }, 300);
  }

  // ═══════════════════════════════════════════
  //  DRAWING TOOLS
  // ═══════════════════════════════════════════

  function setDrawingMode(mode: 'none' | 'hline' | 'trendline') { drawingMode = mode; isDrawing = false; currentDrawing = null; }
  function clearAllDrawings() { drawings = []; currentDrawing = null; isDrawing = false; drawingMode = 'none'; renderDrawings(); }

  function handleDrawingMouseDown(e: MouseEvent) {
    if (drawingMode === 'none' || !drawingCanvas) return;
    const rect = drawingCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (drawingMode === 'hline') {
      drawings = [...drawings, { type: 'hline', points: [{ x: 0, y }, { x: rect.width, y }], color: '#ffe600' }];
      renderDrawings(); drawingMode = 'none'; return;
    }
    if (drawingMode === 'trendline') {
      if (!isDrawing) { currentDrawing = { type: 'trendline', points: [{ x, y }] }; isDrawing = true; }
      else if (currentDrawing) {
        currentDrawing.points.push({ x, y });
        drawings = [...drawings, { type: 'trendline', points: [...currentDrawing.points], color: '#ffe600' }];
        currentDrawing = null; isDrawing = false; drawingMode = 'none'; renderDrawings();
      }
    }
  }

  let _drawRAF: number | null = null;
  function handleDrawingMouseMove(e: MouseEvent) {
    if (!isDrawing || !currentDrawing || !drawingCanvas) return;
    if (_drawRAF) return; // throttle to animation frame
    _drawRAF = requestAnimationFrame(() => {
      _drawRAF = null;
      if (!currentDrawing || !drawingCanvas) return;
      const rect = drawingCanvas.getBoundingClientRect();
      renderDrawings();
      const ctx = drawingCanvas.getContext('2d');
      if (!ctx) return;
      ctx.beginPath(); ctx.strokeStyle = 'rgba(255,230,0,.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.moveTo(currentDrawing.points[0].x, currentDrawing.points[0].y);
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke(); ctx.setLineDash([]);
    });
  }

  function renderDrawings() {
    if (!drawingCanvas) return;
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    for (const d of drawings) {
      ctx.beginPath(); ctx.strokeStyle = d.color; ctx.lineWidth = 1.5;
      if (d.type === 'hline') { ctx.setLineDash([6, 3]); ctx.moveTo(0, d.points[0].y); ctx.lineTo(drawingCanvas.width, d.points[0].y); }
      else if (d.type === 'trendline' && d.points.length === 2) { ctx.setLineDash([]); ctx.moveTo(d.points[0].x, d.points[0].y); ctx.lineTo(d.points[1].x, d.points[1].y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function resizeDrawingCanvas() {
    if (!drawingCanvas || !chartContainer) return;
    drawingCanvas.width = chartContainer.clientWidth;
    drawingCanvas.height = chartContainer.clientHeight;
    renderDrawings();
  }

  // ═══════════════════════════════════════════
  //  PRICE & POSITION
  // ═══════════════════════════════════════════

  let livePrice = 0;
  let priceChange24h = 0;
  let isLoading = true;
  let error = '';

  let _priceUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  let _pendingPrice: number | null = null;
  function throttledPriceUpdate(price: number, pairBase: string) {
    _pendingPrice = price;
    if (_priceUpdateTimer) return;
    _priceUpdateTimer = setTimeout(() => {
      if (_pendingPrice !== null) {
        gameState.update(s => ({ ...s, prices: { ...s.prices, [pairBase]: Math.round(_pendingPrice!) } }));
      }
      _priceUpdateTimer = null; _pendingPrice = null;
    }, 2000);
  }

  $: if (series && showPosition && posEntry !== null && posTp !== null && posSl !== null) { updatePositionLines(posEntry, posTp, posSl, posDir); }
  $: if (series && !showPosition) { clearPositionLines(); }

  function updatePositionLines(entry: number, tp: number, sl: number, dir: string) {
    if (!series) return;
    clearPositionLines();
    const isLong = dir === 'LONG';
    tpLine = series.createPriceLine({ price: tp, color: '#4ade80', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `TP ${isLong ? '▲' : '▼'} $${Math.round(tp).toLocaleString()}` });
    entryLine = series.createPriceLine({ price: entry, color: '#ffba30', lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: `ENTRY $${Math.round(entry).toLocaleString()}` });
    slLine = series.createPriceLine({ price: sl, color: '#ff4060', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `SL ${isLong ? '▼' : '▲'} $${Math.round(sl).toLocaleString()}` });
  }

  function clearPositionLines() {
    if (tpLine && series) { try { series.removePriceLine(tpLine); } catch {} tpLine = null; }
    if (entryLine && series) { try { series.removePriceLine(entryLine); } catch {} entryLine = null; }
    if (slLine && series) { try { series.removePriceLine(slLine); } catch {} slLine = null; }
  }

  // ═══ Drag TP/SL ═══
  let isDragging: 'tp' | 'sl' | 'entry' | null = null;
  let hoverLine: 'tp' | 'sl' | 'entry' | null = null;

  function handleChartMouseDown(e: MouseEvent) {
    if (!chart || !series || !showPosition || posEntry === null || posTp === null || posSl === null) return;
    const y = e.clientY - chartContainer.getBoundingClientRect().top;
    const price = priceFromY(y);
    if (price === null) return;
    const distTP = Math.abs(price - (posTp || 0)), distSL = Math.abs(price - (posSl || 0)), distEntry = Math.abs(price - (posEntry || 0));
    const minDist = Math.min(distTP, distSL, distEntry);
    const threshold = Math.abs((posTp || 0) - (posSl || 0)) * 0.15;
    if (minDist > threshold) return;
    isDragging = minDist === distTP ? 'tp' : minDist === distSL ? 'sl' : 'entry';
    chartContainer.style.cursor = 'ns-resize'; e.preventDefault();
  }

  function handleChartMouseMove(e: MouseEvent) {
    if (!chart || !series) return;
    const y = e.clientY - chartContainer.getBoundingClientRect().top;
    const price = priceFromY(y);
    if (price === null) return;
    if (isDragging) {
      dispatch(isDragging === 'tp' ? 'dragTP' : isDragging === 'sl' ? 'dragSL' : 'dragEntry', { price: Math.round(price) });
    } else if (showPosition && posEntry !== null && posTp !== null && posSl !== null) {
      const distTP = Math.abs(price - (posTp || 0)), distSL = Math.abs(price - (posSl || 0)), distEntry = Math.abs(price - (posEntry || 0));
      const minDist = Math.min(distTP, distSL, distEntry);
      const threshold = Math.abs((posTp || 0) - (posSl || 0)) * 0.15;
      if (minDist <= threshold) { hoverLine = minDist === distTP ? 'tp' : minDist === distSL ? 'sl' : 'entry'; chartContainer.style.cursor = 'ns-resize'; }
      else { hoverLine = null; chartContainer.style.cursor = ''; }
    }
  }

  function handleChartMouseUp() { if (isDragging) { isDragging = null; hoverLine = null; chartContainer.style.cursor = ''; } }

  function handleChartWheel(e: WheelEvent) {
    if (!chart || !series || !showPosition || posEntry === null || posTp === null || posSl === null) return;
    const target = hoverLine || isDragging;
    if (!target) return;
    e.preventDefault(); e.stopPropagation();
    const basePrice = posEntry || livePrice;
    const step = basePrice > 10000 ? 10 : basePrice > 1000 ? 1 : basePrice > 100 ? 0.5 : 0.1;
    const delta = e.deltaY > 0 ? -step : step;
    const val = target === 'tp' ? posTp : target === 'sl' ? posSl : posEntry;
    dispatch(target === 'tp' ? 'dragTP' : target === 'sl' ? 'dragSL' : 'dragEntry', { price: Math.round((val || 0) + delta) });
  }

  function priceFromY(y: number): number | null { if (!series) return null; try { return series.coordinateToPrice(y); } catch { return null; } }

  $: if (series && agentMarkers.length > 0) { try { series.setMarkers(agentMarkers); } catch {} }

  export function getCurrentPrice() { return livePrice; }

  // ═══════════════════════════════════════════
  //  CHART INIT & DATA LOADING
  // ═══════════════════════════════════════════

  onMount(async () => {
    try {
      const lwc = await import('lightweight-charts');

      chart = lwc.createChart(chartContainer, {
        width: chartContainer.clientWidth, height: chartContainer.clientHeight,
        layout: { background: { type: lwc.ColorType.Solid, color: '#0a0a1a' }, textColor: '#888', fontFamily: "'JetBrains Mono', monospace", fontSize: 9 },
        grid: { vertLines: { color: 'rgba(255,230,0,.03)' }, horzLines: { color: 'rgba(255,230,0,.03)' } },
        crosshair: { mode: lwc.CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,230,0,.15)', scaleMargins: { top: 0.05, bottom: 0.15 } },
        timeScale: { borderColor: 'rgba(255,230,0,.15)', timeVisible: true, secondsVisible: false }
      });

      series = chart.addSeries(lwc.CandlestickSeries, { upColor: '#00ff88', downColor: '#ff2d55', wickUpColor: '#00ff88', wickDownColor: '#ff2d55', borderVisible: false });

      // MA lines on main pane
      const maOpts = (color: string) => ({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      ma7Series = chart.addSeries(lwc.LineSeries, maOpts('#f7931a'));
      ma25Series = chart.addSeries(lwc.LineSeries, maOpts('#e040fb'));
      ma99Series = chart.addSeries(lwc.LineSeries, maOpts('#26c6da'));

      // ═══ Volume Pane ═══
      chart.addPane();
      const volIdx = chart.panes().length - 1;
      volumeSeries = chart.addSeries(lwc.HistogramSeries, { priceFormat: { type: 'volume' }, lastValueVisible: true, priceLineVisible: false }, volIdx);
      chart.panes()[volIdx].setStretchFactor(0.18);

      // ═══ RSI Pane ═══
      chart.addPane();
      const rsiIdx = chart.panes().length - 1;
      rsiSeries = chart.addSeries(lwc.LineSeries, { color: '#a855f7', lineWidth: 1.5, priceLineVisible: true, lastValueVisible: true, crosshairMarkerVisible: false }, rsiIdx);
      rsiSeries.createPriceLine({ price: 70, color: 'rgba(255,45,85,.35)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
      rsiSeries.createPriceLine({ price: 30, color: 'rgba(0,255,136,.35)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
      rsiSeries.createPriceLine({ price: 50, color: 'rgba(255,255,255,.06)', lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' });
      chart.panes()[rsiIdx].setStretchFactor(0.18);

      await loadKlines();

      // ═══ Lazy-load: detect scroll to left edge ═══
      chart.timeScale().subscribeVisibleLogicalRangeChange((range: any) => {
        if (range && range.from < 20 && !_isLoadingMore && !_noMoreHistory) {
          loadMoreHistory();
        }
      });

      const ro = new ResizeObserver(() => {
        if (chart && chartMode === 'agent') chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
        resizeDrawingCanvas();
      });
      ro.observe(chartContainer);

      cleanup = () => { ro.disconnect(); if (wsCleanup) wsCleanup(); clearPositionLines(); destroyTradingView(); if (chart) chart.remove(); };
    } catch (e) { error = 'Chart initialization failed'; console.error(e); }
  });

  // ═══ Lazy-load older candles when user scrolls left ═══
  async function loadMoreHistory() {
    if (_isLoadingMore || _noMoreHistory || !series || !chart || klineCache.length === 0) return;
    _isLoadingMore = true;

    try {
      const earliest = klineCache[0];
      const endTimeMs = earliest.time * 1000 - 1; // just before the earliest candle
      const older = await fetchKlines(_currentSymbol, _currentInterval, 1000, endTimeMs);
      if (!series || !chart || older.length === 0) { _noMoreHistory = true; _isLoadingMore = false; return; }

      // Deduplicate: remove any overlap
      const earliestTime = earliest.time;
      const unique = older.filter(k => k.time < earliestTime);
      if (unique.length === 0) { _noMoreHistory = true; _isLoadingMore = false; return; }

      // Prepend to cache
      klineCache = [...unique, ...klineCache];

      // Re-set all series data
      series.setData(klineCache.map(k => ({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close })));
      if (volumeSeries) volumeSeries.setData(klineCache.map(k => ({ time: k.time, value: k.volume, color: k.close >= k.open ? 'rgba(0,255,136,.25)' : 'rgba(255,45,85,.25)' })));

      const closes = klineCache.map(k => ({ time: k.time, close: k.close }));
      if (ma7Series) ma7Series.setData(computeSMA(closes, 7));
      if (ma25Series) ma25Series.setData(computeSMA(closes, 25));
      if (ma99Series) ma99Series.setData(computeSMA(closes, 99));
      if (rsiSeries) rsiSeries.setData(computeRSI(closes, 14));
      // Don't call fitContent — preserve user's scroll position
    } catch (e) {
      console.error('[ChartPanel] loadMoreHistory error:', e);
    }
    _isLoadingMore = false;
  }

  async function loadKlines(overrideSymbol?: string, overrideInterval?: string) {
    if (!series || !volumeSeries || !chart) return;
    const sym = overrideSymbol || symbol;
    const intv = overrideInterval || interval;
    _currentSymbol = sym;
    _currentInterval = intv;
    _noMoreHistory = false;
    isLoading = true; error = '';

    try {
      const klines = await fetchKlines(sym, intv, 1000);
      if (!series || !chart) return;
      if (klines.length === 0) { error = 'No data received'; isLoading = false; return; }

      // Candles
      series.setData(klines.map(k => ({ time: k.time, open: k.open, high: k.high, low: k.low, close: k.close })));

      // Volume
      volumeSeries.setData(klines.map(k => ({ time: k.time, value: k.volume, color: k.close >= k.open ? 'rgba(0,255,136,.25)' : 'rgba(255,45,85,.25)' })));

      // ═══ Indicators ═══
      klineCache = klines;
      const closes = klines.map(k => ({ time: k.time, close: k.close }));

      if (ma7Series) ma7Series.setData(computeSMA(closes, 7));
      if (ma25Series) ma25Series.setData(computeSMA(closes, 25));
      if (ma99Series) ma99Series.setData(computeSMA(closes, 99));
      if (rsiSeries) rsiSeries.setData(computeRSI(closes, 14));

      // Cache MA display values
      const len = klines.length;
      if (len >= 7) ma7Val = klines.slice(-7).reduce((a, k) => a + k.close, 0) / 7;
      if (len >= 25) ma25Val = klines.slice(-25).reduce((a, k) => a + k.close, 0) / 25;
      if (len >= 99) ma99Val = klines.slice(-99).reduce((a, k) => a + k.close, 0) / 99;

      const lastKline = klines[len - 1];
      livePrice = lastKline.close;
      if (len > 6) priceChange24h = ((lastKline.close - klines[len - 7].close) / klines[len - 7].close) * 100;

      throttledPriceUpdate(lastKline.close, state.pair.split('/')[0]);
      dispatch('priceUpdate', { price: lastKline.close });
      chart.timeScale().fitContent();

      // ═══ WebSocket real-time ═══
      if (wsCleanup) wsCleanup();
      wsCleanup = subscribeKlines(sym, intv, (kline: BinanceKline) => {
        if (!series) return;

        series.update({ time: kline.time, open: kline.open, high: kline.high, low: kline.low, close: kline.close });
        if (volumeSeries) volumeSeries.update({ time: kline.time, value: kline.volume, color: kline.close >= kline.open ? 'rgba(0,255,136,.25)' : 'rgba(255,45,85,.25)' });

        // Update kline cache
        const isUpdate = klineCache.length > 0 && klineCache[klineCache.length - 1].time === kline.time;
        const prevClose = isUpdate ? (klineCache.length > 1 ? klineCache[klineCache.length - 2].close : kline.open) : klineCache[klineCache.length - 1]?.close ?? kline.open;
        if (isUpdate) klineCache[klineCache.length - 1] = kline;
        else klineCache.push(kline);
        const cLen = klineCache.length;

        // MA — simple running average from last N
        if (ma7Series && cLen >= 7) {
          let s = 0; for (let i = cLen - 7; i < cLen; i++) s += klineCache[i].close;
          ma7Val = s / 7; ma7Series.update({ time: kline.time, value: ma7Val });
        }
        if (ma25Series && cLen >= 25) {
          let s = 0; for (let i = cLen - 25; i < cLen; i++) s += klineCache[i].close;
          ma25Val = s / 25; ma25Series.update({ time: kline.time, value: ma25Val });
        }
        if (ma99Series && cLen >= 99) {
          let s = 0; for (let i = cLen - 99; i < cLen; i++) s += klineCache[i].close;
          ma99Val = s / 99; ma99Series.update({ time: kline.time, value: ma99Val });
        }

        // RSI — incremental Wilder smoothing
        if (rsiSeries && cLen > 14) {
          const d = kline.close - prevClose;
          _rsiAvgGain = (_rsiAvgGain * 13 + (d > 0 ? d : 0)) / 14;
          _rsiAvgLoss = (_rsiAvgLoss * 13 + (d < 0 ? -d : 0)) / 14;
          const rsi = _rsiAvgLoss === 0 ? 100 : 100 - 100 / (1 + _rsiAvgGain / _rsiAvgLoss);
          rsiSeries.update({ time: kline.time, value: rsi });
        }

        livePrice = kline.close;
        throttledPriceUpdate(kline.close, state.pair.split('/')[0]);
        dispatch('priceUpdate', { price: kline.close });
      });

      isLoading = false;
    } catch (e: any) {
      console.error('[ChartPanel] API error:', e);
      error = `API Error: ${e.message || 'Failed'}`;
      isLoading = false;
      loadFallbackData();
    }
  }

  function loadFallbackData() {
    if (!series || !chart) return;
    const basePrice = state.prices.BTC || 97000;
    const candles = generateCandles(201, basePrice);
    series.setData(candles);
    chart.timeScale().fitContent();
    livePrice = basePrice;
    const fallbackInterval = setInterval(() => {
      const last = candles[candles.length - 1];
      const change = (Math.random() - 0.48) * 80;
      const newClose = last.close + change;
      const time = (last.time as number) + 14400;
      const nc = { time, open: last.close, high: Math.max(last.close, newClose) + Math.random() * 40, low: Math.min(last.close, newClose) - Math.random() * 40, close: newClose };
      candles.push(nc); series.update(nc); livePrice = newClose;
      dispatch('priceUpdate', { price: newClose });
    }, 1500);
    if (cleanup) { const old = cleanup; cleanup = () => { clearInterval(fallbackInterval); old(); }; }
  }

  function generateCandles(count: number, basePrice: number) {
    const candles = [];
    let t = Math.floor(Date.now() / 1000) - count * 14400, price = basePrice;
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.48) * 120;
      const open = price, close = price + change;
      candles.push({ time: t, open, high: Math.max(open, close) + Math.random() * 60, low: Math.min(open, close) - Math.random() * 60, close });
      price = close; t += 14400;
    }
    return candles;
  }

  function changePair(pair: string) { gameState.update(s => ({ ...s, pair })); loadKlines(pairToSymbol(pair), interval); }
  function changeTF(tf: string) {
    const normalized = normalizeTimeframe(tf);
    gameState.update(s => ({ ...s, timeframe: normalized }));
    loadKlines(symbol, toBinanceInterval(normalized));
  }

  onDestroy(() => {
    if (_priceUpdateTimer) clearTimeout(_priceUpdateTimer);
    if (_tvInitTimer) clearTimeout(_tvInitTimer);
    if (_drawRAF) cancelAnimationFrame(_drawRAF);
    if (cleanup) cleanup();
    if (wsCleanup) wsCleanup();
    destroyTradingView();
  });
</script>

<div class="chart-wrapper">
  <div class="chart-bar">
    <div class="live-indicator">
      <span class="live-dot" class:err={!!error}></span>
      {error ? 'OFFLINE' : 'LIVE'}
    </div>

    <TokenDropdown value={state.pair} compact on:select={e => changePair(e.detail.pair)} />

    <div class="tf-btns">
      {#each CORE_TIMEFRAME_OPTIONS as tf}
        <button
          class="tfbtn"
          class:active={normalizeTimeframe(state.timeframe) === tf.value}
          on:click={() => changeTF(tf.value)}
        >
          {tf.label}
        </button>
      {/each}
    </div>

    <div class="mode-toggle">
      <button class="mode-btn" class:active={chartMode === 'agent'} on:click={() => setChartMode('agent')}>
        <span class="mode-icon">&#9889;</span> AGENT
      </button>
      <button class="mode-btn" class:active={chartMode === 'trading'} on:click={() => setChartMode('trading')}>
        <span class="mode-icon">&#128208;</span> TRADING
      </button>
    </div>

    {#if chartMode === 'agent'}
      <div class="draw-tools">
        <button class="draw-btn" class:active={drawingMode === 'hline'} on:click={() => setDrawingMode(drawingMode === 'hline' ? 'none' : 'hline')} title="Horizontal Line">&#x2500;</button>
        <button class="draw-btn" class:active={drawingMode === 'trendline'} on:click={() => setDrawingMode(drawingMode === 'trendline' ? 'none' : 'trendline')} title="Trend Line">&#x2571;</button>
        <button class="draw-btn clear-btn" on:click={clearAllDrawings} title="Clear">&#x2715;</button>
      </div>
    {/if}

    {#if chartMode === 'agent' && klineCache.length > 0}
      <div class="ma-vals">
        <span class="ma-tag" style="color:#f7931a">MA(7) {ma7Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
        <span class="ma-tag" style="color:#e040fb">MA(25) {ma25Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
        <span class="ma-tag" style="color:#26c6da">MA(99) {ma99Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
      </div>
    {/if}

    <div class="price-info">
      <span class="cprc">${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span class="pchg" class:up={priceChange24h >= 0} class:down={priceChange24h < 0}>
        {priceChange24h >= 0 ? '▲' : '▼'}{Math.abs(priceChange24h).toFixed(2)}%
      </span>
    </div>
  </div>

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="chart-container" bind:this={chartContainer}
    class:hidden-chart={chartMode !== 'agent'}
    on:mousedown={handleChartMouseDown} on:mousemove={handleChartMouseMove}
    on:mouseup={handleChartMouseUp} on:mouseleave={handleChartMouseUp} on:wheel={handleChartWheel}>
    {#if isLoading && chartMode === 'agent'}
      <div class="loading-overlay"><div class="loader"></div><span>Loading {symbol}...</span></div>
    {/if}
    {#if error && chartMode === 'agent'}
      <div class="error-badge">{error}</div>
    {/if}

    {#if chartMode === 'agent'}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <canvas class="drawing-canvas" bind:this={drawingCanvas}
        class:drawing-active={drawingMode !== 'none'}
        on:mousedown={handleDrawingMouseDown} on:mousemove={handleDrawingMouseMove}></canvas>
    {/if}

    {#if drawingMode !== 'none' && chartMode === 'agent'}
      <div class="drawing-indicator">
        {drawingMode === 'hline' ? '── CLICK to place horizontal line' : 'CLICK two points for trend line'}
        <button class="drawing-cancel" on:click={() => setDrawingMode('none')}>ESC</button>
      </div>
    {/if}

    {#if showPosition && posEntry !== null && posTp !== null && posSl !== null}
      <div class="pos-overlay">
        <div class="pos-badge {posDir.toLowerCase()}">
          {posDir === 'LONG' ? '🚀 LONG' : posDir === 'SHORT' ? '💀 SHORT' : '— NEUTRAL'}
        </div>
        <div class="pos-levels">
          <span class="pos-tp" class:highlight={hoverLine === 'tp' || isDragging === 'tp'}>{hoverLine === 'tp' ? '↕' : ''} TP ${Math.round(posTp).toLocaleString()}</span>
          <span class="pos-entry" class:highlight={hoverLine === 'entry' || isDragging === 'entry'}>{hoverLine === 'entry' ? '↕' : ''} ENTRY ${Math.round(posEntry).toLocaleString()}</span>
          <span class="pos-sl" class:highlight={hoverLine === 'sl' || isDragging === 'sl'}>{hoverLine === 'sl' ? '↕' : ''} SL ${Math.round(posSl).toLocaleString()}</span>
        </div>
        <div class="pos-rr">R:R 1:{(Math.abs(posTp - posEntry) / Math.max(1, Math.abs(posEntry - posSl))).toFixed(1)}</div>
        <div class="pos-hint">DRAG or SCROLL lines to adjust</div>
      </div>
    {/if}

    {#if chartMode === 'agent'}
      {#each agentAnnotations as ann (ann.id)}
        <button class="chart-annotation" style="top:{ann.yPercent}%;left:{ann.xPercent}%;--ann-color:{ann.color}"
          class:active={selectedAnnotation?.id === ann.id}
          on:click|stopPropagation={() => selectedAnnotation = selectedAnnotation?.id === ann.id ? null : ann}>
          <span class="ann-icon">{ann.icon}</span>
          {#if selectedAnnotation?.id === ann.id}
            <div class="ann-popup">
              <div class="ann-popup-header" style="border-color:{ann.color}">
                <span class="ann-popup-icon">{ann.icon}</span>
                <span class="ann-popup-name" style="color:{ann.color}">{ann.name}</span>
                <span class="ann-popup-type">{ann.type.toUpperCase()}</span>
              </div>
              <div class="ann-popup-label">{ann.label}</div>
              <div class="ann-popup-detail">{ann.detail}</div>
            </div>
          {/if}
        </button>
      {/each}
    {/if}

    {#if isDragging && chartMode === 'agent'}
      <div class="drag-indicator">DRAGGING {isDragging.toUpperCase()} — Release to set</div>
    {/if}
  </div>

  {#if chartMode === 'trading'}
    <div class="tv-container" bind:this={tvContainer}>
      <div id="tradingview_widget" style="width:100%;height:100%"></div>
      {#if tvLoading}
        <div class="loading-overlay"><div class="loader"></div><span>Loading TradingView...</span></div>
      {/if}
    </div>
  {/if}

  <div class="chart-footer">
    <span class="src-badge">{chartMode === 'trading' ? '📊 TV' : '📡 BINANCE'}</span>
    <span class="src-pair">{chartMode === 'trading' ? pairToTVSymbol(state.pair) : symbol}</span>
    <span class="src-tf">{formatTimeframeLabel(state.timeframe)}</span>
    {#if chartMode === 'agent' && drawings.length > 0}
      <span class="draw-count">✏️ {drawings.length}</span>
    {/if}
    {#if showPosition}
      <span class="pos-active">📍 {posDir || 'POS'}</span>
    {/if}
    <span class="agent-feed-text">
      {#if state.phase === 'scout'}⚡ Scanning...
      {:else if state.phase === 'gather'}🔍 Gathering...
      {:else if state.phase === 'council'}🗣️ Debating...
      {:else if state.phase === 'verdict'}⚖️ Consensus...
      {:else if state.phase === 'battle'}⚔️ Battle...
      {:else}●
      {/if}
    </span>
    <span class="src-ws">{chartMode === 'agent' ? `WS ${wsCleanup ? '●' : '○'}` : 'WIDGET ●'}</span>
  </div>
</div>

<style>
  .chart-wrapper { display: flex; flex-direction: column; height: 100%; background: #0a0a1a; overflow: hidden; }
  .chart-bar {
    padding: 5px 10px; border-bottom: 3px solid #000; display: flex; align-items: center; gap: 6px;
    background: linear-gradient(90deg, #1a1a3a, #0a0a2a); font-size: 9px; font-family: var(--fm);
    flex-shrink: 0; flex-wrap: wrap; row-gap: 3px;
  }
  .live-indicator { font-size: 8px; font-weight: 700; color: var(--grn); display: flex; align-items: center; gap: 3px; letter-spacing: 1px; margin-right: 4px; }
  .live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--grn); animation: pulse .8s infinite; }
  .live-dot.err { background: #ff2d55; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .tf-btns { display: flex; gap: 2px; }
  .tfbtn { padding: 2px 7px; border-radius: 4px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); color: #888; font-size: 7px; font-family: var(--fd); font-weight: 700; letter-spacing: 1px; cursor: pointer; transition: all .15s; }
  .tfbtn:hover { background: rgba(255,255,255,.1); color: #fff; }
  .tfbtn.active { background: rgba(255,230,0,.15); color: #ffe600; border-color: rgba(255,230,0,.3); }

  .ma-vals { display: flex; gap: 6px; flex-wrap: wrap; }
  .ma-tag { font-size: 7px; font-family: var(--fm); font-weight: 700; letter-spacing: .3px; opacity: .85; }

  .price-info { margin-left: auto; display: flex; align-items: baseline; gap: 6px; }
  .cprc { font-size: 15px; font-weight: 700; color: #fff; font-family: var(--fd); }
  .pchg { font-size: 9px; font-weight: 700; }
  .pchg.up { color: #00ff88; }
  .pchg.down { color: #ff2d55; }

  .chart-container { flex: 1; position: relative; overflow: hidden; }
  .chart-container.hidden-chart { display: none; }

  .mode-toggle { display: flex; gap: 0; border-radius: 6px; overflow: hidden; border: 1.5px solid rgba(255,230,0,.25); margin-left: 4px; }
  .mode-btn { padding: 2px 9px; background: rgba(255,255,255,.03); border: none; color: #666; font-size: 7px; font-family: var(--fd); font-weight: 800; letter-spacing: 1px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 3px; white-space: nowrap; }
  .mode-btn:first-child { border-right: 1px solid rgba(255,230,0,.15); }
  .mode-btn:hover { background: rgba(255,230,0,.08); color: #ccc; }
  .mode-btn.active { background: linear-gradient(135deg, rgba(255,230,0,.2), rgba(255,180,0,.15)); color: #ffe600; text-shadow: 0 0 8px rgba(255,230,0,.5); }
  .mode-icon { font-size: 9px; line-height: 1; }

  .draw-tools { display: flex; gap: 2px; margin-left: 2px; padding-left: 4px; border-left: 1px solid rgba(255,255,255,.06); }
  .draw-btn { width: 22px; height: 18px; border-radius: 4px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); color: #888; font-size: 10px; font-family: monospace; cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
  .draw-btn:hover { background: rgba(255,230,0,.1); color: #ffe600; border-color: rgba(255,230,0,.3); }
  .draw-btn.active { background: rgba(255,230,0,.2); color: #ffe600; border-color: #ffe600; box-shadow: 0 0 6px rgba(255,230,0,.3); }
  .draw-btn.clear-btn:hover { background: rgba(255,45,85,.15); color: #ff2d55; border-color: rgba(255,45,85,.4); }

  .drawing-canvas { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
  .drawing-canvas.drawing-active { pointer-events: auto; cursor: crosshair; }

  .drawing-indicator { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); z-index: 15; padding: 3px 12px; border-radius: 6px; background: rgba(255,230,0,.12); border: 1px solid rgba(255,230,0,.3); color: #ffe600; font-size: 8px; font-weight: 700; font-family: var(--fm); letter-spacing: 1px; display: flex; align-items: center; gap: 8px; animation: drawPulse 1.5s ease infinite; }
  @keyframes drawPulse { 0%,100% { opacity: 1 } 50% { opacity: .65 } }
  .drawing-cancel { padding: 1px 6px; border-radius: 3px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15); color: #aaa; font-size: 6px; font-family: var(--fm); font-weight: 800; cursor: pointer; letter-spacing: 1px; }
  .drawing-cancel:hover { background: rgba(255,45,85,.2); color: #ff2d55; border-color: rgba(255,45,85,.4); }

  .tv-container { flex: 1; position: relative; overflow: hidden; background: #0a0a1a; }
  .tv-container :global(iframe) { width: 100% !important; height: 100% !important; border: none !important; }

  .loading-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: rgba(10,10,26,.9); z-index: 10; color: #888; font-size: 9px; font-family: var(--fm); }
  .loader { width: 24px; height: 24px; border: 2px solid rgba(255,230,0,.2); border-top-color: #ffe600; border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-badge { position: absolute; top: 6px; left: 6px; padding: 3px 8px; border-radius: 4px; background: rgba(255,45,85,.2); border: 1px solid rgba(255,45,85,.4); color: #ff2d55; font-size: 7px; font-family: var(--fm); font-weight: 600; z-index: 5; }

  .pos-overlay { position: absolute; top: 6px; right: 6px; z-index: 12; display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
  .pos-badge { padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; border: 2px solid; }
  .pos-badge.long { background: rgba(0,255,136,.2); border-color: #00ff88; color: #00ff88; }
  .pos-badge.short { background: rgba(255,45,85,.2); border-color: #ff2d55; color: #ff2d55; }
  .pos-badge.neutral { background: rgba(255,170,0,.2); border-color: #ffaa00; color: #ffaa00; }
  .pos-levels { display: flex; flex-direction: column; gap: 1px; font-size: 7px; font-family: var(--fm); font-weight: 700; text-align: right; }
  .pos-tp { color: #4ade80; }
  .pos-entry { color: #ffba30; }
  .pos-sl { color: #ff4060; }
  .pos-rr { font-size: 9px; font-weight: 900; font-family: var(--fd); color: #ffe600; background: rgba(0,0,0,.6); padding: 2px 8px; border-radius: 4px; }
  .pos-hint { font-size: 6px; color: rgba(255,255,255,.25); font-family: var(--fm); letter-spacing: .5px; text-align: right; margin-top: 2px; }
  .pos-levels .highlight { background: rgba(255,255,255,.15); padding: 0 4px; border-radius: 3px; animation: lineHover .5s ease infinite; }
  @keyframes lineHover { 0%,100%{opacity:1} 50%{opacity:.7} }

  .drag-indicator { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); z-index: 15; padding: 4px 12px; border-radius: 6px; background: rgba(255,230,0,.9); color: #000; font-size: 8px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; animation: dragPulse .5s ease infinite; }
  @keyframes dragPulse { 0%,100% { opacity: 1 } 50% { opacity: .6 } }

  .chart-annotation { position: absolute; z-index: 8; width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--ann-color); background: rgba(0,0,0,.8); box-shadow: 0 0 10px var(--ann-color), 0 0 20px rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s; transform: translate(-50%, -50%); padding: 0; contain: layout style; }
  .chart-annotation::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; border: 1px solid var(--ann-color); opacity: 0; will-change: auto; }
  .chart-annotation::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; background: var(--ann-color); opacity: .08; z-index: -1; }
  .chart-annotation:hover { transform: translate(-50%, -50%) scale(1.35); box-shadow: 0 0 20px var(--ann-color), 0 0 30px var(--ann-color); }
  .chart-annotation.active { transform: translate(-50%, -50%) scale(1.25); box-shadow: 0 0 20px var(--ann-color), 0 0 30px var(--ann-color); z-index: 20; }
  .chart-annotation:hover::before { animation: annRing 2s ease-out; }
  @keyframes annRing { 0% { transform: scale(1); opacity: .4; } 100% { transform: scale(1.8); opacity: 0; } }
  .ann-icon { font-size: 13px; line-height: 1; filter: drop-shadow(0 0 2px var(--ann-color)); }

  .ann-popup { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); width: 200px; background: rgba(10,10,30,.95); border: 2px solid var(--ann-color); border-radius: 8px; padding: 8px; box-shadow: 0 4px 20px rgba(0,0,0,.5); animation: annPopIn .2s ease; pointer-events: none; }
  @keyframes annPopIn { from { opacity: 0; transform: translateX(-50%) translateY(5px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  .ann-popup-header { display: flex; align-items: center; gap: 4px; padding-bottom: 4px; border-bottom: 1px solid; margin-bottom: 4px; }
  .ann-popup-icon { font-size: 12px; }
  .ann-popup-name { font-family: var(--fm); font-size: 8px; font-weight: 900; letter-spacing: 1px; }
  .ann-popup-type { margin-left: auto; font-family: var(--fm); font-size: 6px; font-weight: 700; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.4); letter-spacing: .5px; }
  .ann-popup-label { font-family: var(--fm); font-size: 8px; font-weight: 900; color: #fff; margin-bottom: 2px; }
  .ann-popup-detail { font-family: var(--fm); font-size: 7px; color: rgba(255,255,255,.5); line-height: 1.4; }

  .chart-footer { padding: 3px 10px; border-top: 1px solid rgba(255,255,255,.05); background: rgba(0,0,0,.3); display: flex; align-items: center; gap: 8px; font-size: 7px; font-family: var(--fm); color: #555; flex-shrink: 0; }
  .src-badge { color: #ffe600; font-weight: 700; }
  .src-ws { margin-left: auto; color: #00ff88; }
  .pos-active { color: #ffba30; font-weight: 700; animation: pulse .8s infinite; }
  .draw-count { color: #ffe600; font-weight: 700; }
  .agent-feed-text { flex: 1; color: rgba(255,255,255,.3); font-size: 7px; font-weight: 600; letter-spacing: .5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
