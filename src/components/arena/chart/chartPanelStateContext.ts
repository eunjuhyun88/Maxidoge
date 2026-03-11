import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { ChartTheme } from '../ChartTheme';
import type { ChartDerivativesRuntimeController } from './chartDerivativesRuntime';
import type { ChartMaPeriodBinding } from './chartMountRuntime';

interface BuildChartIndicatorSeriesRefsOptions {
  derivativesRuntime: ChartDerivativesRuntimeController | null;
  ma7Series: ISeriesApi<'Line'> | null;
  ma20Series: ISeriesApi<'Line'> | null;
  ma25Series: ISeriesApi<'Line'> | null;
  ma60Series: ISeriesApi<'Line'> | null;
  ma99Series: ISeriesApi<'Line'> | null;
  ma120Series: ISeriesApi<'Line'> | null;
  rsiSeries: ISeriesApi<'Line'> | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
  bbUpperSeries: ISeriesApi<'Line'> | null;
  bbMiddleSeries: ISeriesApi<'Line'> | null;
  bbLowerSeries: ISeriesApi<'Line'> | null;
  macdLineSeries: ISeriesApi<'Line'> | null;
  macdSignalSeries: ISeriesApi<'Line'> | null;
  macdHistSeries: ISeriesApi<'Histogram'> | null;
  stochKSeries: ISeriesApi<'Line'> | null;
  stochDSeries: ISeriesApi<'Line'> | null;
}

interface BuildChartIndicatorPaneIndexesOptions {
  derivativesRuntime: ChartDerivativesRuntimeController | null;
  volumePaneIndex: number | null;
  rsiPaneIndex: number | null;
  macdPaneIndex: number | null;
  stochPaneIndex: number | null;
}

interface BuildChartDataSeriesContextOptions {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  volumeSeries: ISeriesApi<'Histogram'> | null;
  rsiSeries: ISeriesApi<'Line'> | null;
  bbUpperSeries: ISeriesApi<'Line'> | null;
  bbMiddleSeries: ISeriesApi<'Line'> | null;
  bbLowerSeries: ISeriesApi<'Line'> | null;
  macdLineSeries: ISeriesApi<'Line'> | null;
  macdSignalSeries: ISeriesApi<'Line'> | null;
  macdHistSeries: ISeriesApi<'Histogram'> | null;
  stochKSeries: ISeriesApi<'Line'> | null;
  stochDSeries: ISeriesApi<'Line'> | null;
  maPeriods: ChartMaPeriodBinding[];
  chartTheme: ChartTheme;
}

interface ReadChartIndicatorStateOptions {
  rsiAvgGain: number;
  rsiAvgLoss: number;
  maRunSum: Record<number, number>;
}

export function buildChartIndicatorSeriesRefs(
  options: BuildChartIndicatorSeriesRefsOptions,
) {
  const derivRefs = options.derivativesRuntime?.getPaneRefs();
  return {
    ma7Series: options.ma7Series,
    ma20Series: options.ma20Series,
    ma25Series: options.ma25Series,
    ma60Series: options.ma60Series,
    ma99Series: options.ma99Series,
    ma120Series: options.ma120Series,
    rsiSeries: options.rsiSeries,
    volumeSeries: options.volumeSeries,
    bbUpperSeries: options.bbUpperSeries,
    bbMiddleSeries: options.bbMiddleSeries,
    bbLowerSeries: options.bbLowerSeries,
    macdLineSeries: options.macdLineSeries,
    macdSignalSeries: options.macdSignalSeries,
    macdHistSeries: options.macdHistSeries,
    stochKSeries: options.stochKSeries,
    stochDSeries: options.stochDSeries,
    oiSeries: derivRefs?.oiSeries ?? null,
    fundingSeries: derivRefs?.fundingSeries ?? null,
    liqLongSeries: derivRefs?.liqLongSeries ?? null,
    liqShortSeries: derivRefs?.liqShortSeries ?? null,
  };
}

export function buildChartIndicatorPaneIndexes(
  options: BuildChartIndicatorPaneIndexesOptions,
) {
  const derivRefs = options.derivativesRuntime?.getPaneRefs();
  return {
    volumePaneIndex: options.volumePaneIndex,
    rsiPaneIndex: options.rsiPaneIndex,
    macdPaneIndex: options.macdPaneIndex,
    stochPaneIndex: options.stochPaneIndex,
    oiPaneIndex: derivRefs?.oiPaneIndex ?? null,
    fundingPaneIndex: derivRefs?.fundingPaneIndex ?? null,
    liqPaneIndex: derivRefs?.liqPaneIndex ?? null,
  };
}

export function buildChartDataSeriesContext(
  options: BuildChartDataSeriesContextOptions,
) {
  return {
    chart: options.chart,
    series: options.series,
    volumeSeries: options.volumeSeries,
    rsiSeries: options.rsiSeries,
    bbUpperSeries: options.bbUpperSeries,
    bbMiddleSeries: options.bbMiddleSeries,
    bbLowerSeries: options.bbLowerSeries,
    macdLineSeries: options.macdLineSeries,
    macdSignalSeries: options.macdSignalSeries,
    macdHistSeries: options.macdHistSeries,
    stochKSeries: options.stochKSeries,
    stochDSeries: options.stochDSeries,
    maPeriods: options.maPeriods,
    chartTheme: options.chartTheme,
  };
}

export function readChartIndicatorState(
  options: ReadChartIndicatorStateOptions,
) {
  return {
    rsiAvgGain: options.rsiAvgGain,
    rsiAvgLoss: options.rsiAvgLoss,
    maRunSum: options.maRunSum,
  };
}
