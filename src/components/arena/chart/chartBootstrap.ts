import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { withAlpha, type ChartTheme } from '../ChartTheme';

export interface ChartBootstrapResult {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  volumeSeries: ISeriesApi<'Histogram'>;
  rsiSeries: ISeriesApi<'Line'>;
  ma7Series: ISeriesApi<'Line'>;
  ma20Series: ISeriesApi<'Line'>;
  ma25Series: ISeriesApi<'Line'>;
  ma60Series: ISeriesApi<'Line'>;
  ma99Series: ISeriesApi<'Line'>;
  ma120Series: ISeriesApi<'Line'>;
  bbUpperSeries: ISeriesApi<'Line'>;
  bbMiddleSeries: ISeriesApi<'Line'>;
  bbLowerSeries: ISeriesApi<'Line'>;
  macdLineSeries: ISeriesApi<'Line'>;
  macdSignalSeries: ISeriesApi<'Line'>;
  macdHistSeries: ISeriesApi<'Histogram'>;
  stochKSeries: ISeriesApi<'Line'>;
  stochDSeries: ISeriesApi<'Line'>;
  volumePaneIndex: number;
  rsiPaneIndex: number;
  macdPaneIndex: number;
  stochPaneIndex: number;
}

interface ChartBootstrapOptions {
  lwc: typeof import('lightweight-charts');
  chartContainer: HTMLDivElement;
  chartTheme: ChartTheme;
  barSpacing: number;
  compactViewport: boolean;
}

export function createChartBootstrap({
  lwc,
  chartContainer,
  chartTheme,
  barSpacing,
  compactViewport,
}: ChartBootstrapOptions): ChartBootstrapResult {
  const chart = lwc.createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
    layout: {
      background: { type: lwc.ColorType.Solid, color: chartTheme.bg },
      textColor: chartTheme.text,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: compactViewport ? 12 : 11,
    },
    grid: {
      vertLines: { color: chartTheme.grid },
      horzLines: { color: chartTheme.grid },
    },
    crosshair: {
      mode: lwc.CrosshairMode.Normal,
      vertLine: { labelBackgroundColor: withAlpha('#122031', 0.94) },
      horzLine: { labelBackgroundColor: withAlpha('#122031', 0.94) },
    },
    rightPriceScale: {
      autoScale: true,
      borderColor: chartTheme.border,
      minimumWidth: compactViewport ? 88 : 74,
      scaleMargins: { top: 0.04, bottom: 0.08 },
    },
    timeScale: {
      borderColor: chartTheme.border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
      barSpacing,
      minBarSpacing: 3,
    },
    handleScale: {
      axisPressedMouseMove: { time: true, price: true },
      mouseWheel: true,
      pinch: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
  });

  const series = chart.addSeries(lwc.CandlestickSeries, {
    upColor: chartTheme.candleUp,
    downColor: chartTheme.candleDown,
    wickUpColor: chartTheme.candleUp,
    wickDownColor: chartTheme.candleDown,
    borderVisible: true,
    borderUpColor: withAlpha(chartTheme.candleUp, 1),
    borderDownColor: withAlpha(chartTheme.candleDown, 1),
  });

  const maOpts = (color: string, lineWidth = 1, lineStyle = 0) => ({
    color,
    lineWidth: lineWidth as any,
    lineStyle,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });

  const ma7Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma7, 1, 2));
  const ma20Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma20, 2, 0));
  const ma25Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma25, 1, 2));
  const ma60Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma60, 2, 0));
  const ma99Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma99, 1, 2));
  const ma120Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma120, 2, 0));

  chart.addPane();
  const volumePaneIndex = chart.panes().length - 1;
  const volumeSeries = chart.addSeries(
    lwc.HistogramSeries,
    {
      priceFormat: { type: 'volume' },
      lastValueVisible: true,
      priceLineVisible: false,
    },
    volumePaneIndex,
  );
  chart.panes()[volumePaneIndex].setStretchFactor(0.12);

  chart.addPane();
  const rsiPaneIndex = chart.panes().length - 1;
  const rsiSeries = chart.addSeries(
    lwc.LineSeries,
    {
      color: chartTheme.rsi,
      lineWidth: 1.5 as any,
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    },
    rsiPaneIndex,
  );
  rsiSeries.createPriceLine({ price: 70, color: chartTheme.rsiTop, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
  rsiSeries.createPriceLine({ price: 30, color: chartTheme.rsiBottom, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
  rsiSeries.createPriceLine({ price: 50, color: chartTheme.rsiMid, lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' });
  chart.panes()[rsiPaneIndex].setStretchFactor(0.12);

  // ── Bollinger Bands (main pane overlay) ──────────────────────
  const bbOpts = (color: string) => ({
    color,
    lineWidth: 1 as any,
    lineStyle: 0,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    visible: false, // start hidden
  });
  const bbUpperSeries = chart.addSeries(lwc.LineSeries, bbOpts(chartTheme.bbUpper));
  const bbMiddleSeries = chart.addSeries(lwc.LineSeries, { ...bbOpts(chartTheme.bbMiddle), lineStyle: 2 });
  const bbLowerSeries = chart.addSeries(lwc.LineSeries, bbOpts(chartTheme.bbLower));

  // ── MACD pane ────────────────────────────────────────────────
  chart.addPane();
  const macdPaneIndex = chart.panes().length - 1;
  const macdLineSeries = chart.addSeries(
    lwc.LineSeries,
    {
      color: chartTheme.macdLine,
      lineWidth: 1.5 as any,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      visible: false,
    },
    macdPaneIndex,
  );
  const macdSignalSeries = chart.addSeries(
    lwc.LineSeries,
    {
      color: chartTheme.macdSignal,
      lineWidth: 1 as any,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    },
    macdPaneIndex,
  );
  const macdHistSeries = chart.addSeries(
    lwc.HistogramSeries,
    {
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
      lastValueVisible: false,
      priceLineVisible: false,
      visible: false,
    },
    macdPaneIndex,
  );
  macdLineSeries.createPriceLine({ price: 0, color: 'rgba(255,255,255,.08)', lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' });
  chart.panes()[macdPaneIndex].setStretchFactor(0.02); // start collapsed

  // ── Stochastic pane ──────────────────────────────────────────
  chart.addPane();
  const stochPaneIndex = chart.panes().length - 1;
  const stochKSeries = chart.addSeries(
    lwc.LineSeries,
    {
      color: chartTheme.stochK,
      lineWidth: 1.5 as any,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      visible: false,
    },
    stochPaneIndex,
  );
  const stochDSeries = chart.addSeries(
    lwc.LineSeries,
    {
      color: chartTheme.stochD,
      lineWidth: 1 as any,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    },
    stochPaneIndex,
  );
  stochKSeries.createPriceLine({ price: 80, color: chartTheme.stochOB, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
  stochKSeries.createPriceLine({ price: 20, color: chartTheme.stochOS, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
  stochKSeries.createPriceLine({ price: 50, color: 'rgba(255,255,255,.06)', lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' });
  chart.panes()[stochPaneIndex].setStretchFactor(0.02); // start collapsed

  // OI / Funding / Liquidation panes are created lazily by chartDerivativesRuntime
  // to avoid wasting vertical space with collapsed empty panes.

  return {
    chart,
    series,
    volumeSeries,
    rsiSeries,
    ma7Series,
    ma20Series,
    ma25Series,
    ma60Series,
    ma99Series,
    ma120Series,
    bbUpperSeries,
    bbMiddleSeries,
    bbLowerSeries,
    macdLineSeries,
    macdSignalSeries,
    macdHistSeries,
    stochKSeries,
    stochDSeries,
    volumePaneIndex,
    rsiPaneIndex,
    macdPaneIndex,
    stochPaneIndex,
  };
}
