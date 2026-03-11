import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { ChartTheme } from '../ChartTheme';
import type { ChartMountRuntimeModule } from './chartClientRuntime';
import type {
  ChartMaPeriodBinding,
  PrepareChartMountResult,
} from './chartMountRuntime';

interface ApplyChartBootstrapStateOptions {
  bootstrap: PrepareChartMountResult['bootstrap'];
  setChart: (chart: IChartApi | null) => void;
  setSeries: (series: ISeriesApi<'Candlestick'> | null) => void;
  setMa7Series: (series: ISeriesApi<'Line'> | null) => void;
  setMa20Series: (series: ISeriesApi<'Line'> | null) => void;
  setMa25Series: (series: ISeriesApi<'Line'> | null) => void;
  setMa60Series: (series: ISeriesApi<'Line'> | null) => void;
  setMa99Series: (series: ISeriesApi<'Line'> | null) => void;
  setMa120Series: (series: ISeriesApi<'Line'> | null) => void;
  setVolumeSeries: (series: ISeriesApi<'Histogram'> | null) => void;
  setRsiSeries: (series: ISeriesApi<'Line'> | null) => void;
  setBbUpperSeries: (series: ISeriesApi<'Line'> | null) => void;
  setBbMiddleSeries: (series: ISeriesApi<'Line'> | null) => void;
  setBbLowerSeries: (series: ISeriesApi<'Line'> | null) => void;
  setMacdLineSeries: (series: ISeriesApi<'Line'> | null) => void;
  setMacdSignalSeries: (series: ISeriesApi<'Line'> | null) => void;
  setMacdHistSeries: (series: ISeriesApi<'Histogram'> | null) => void;
  setStochKSeries: (series: ISeriesApi<'Line'> | null) => void;
  setStochDSeries: (series: ISeriesApi<'Line'> | null) => void;
  setVolumePaneIndex: (index: number | null) => void;
  setRsiPaneIndex: (index: number | null) => void;
  setMacdPaneIndex: (index: number | null) => void;
  setStochPaneIndex: (index: number | null) => void;
}

interface ApplyChartPreparedMountStateOptions {
  preparedMount: PrepareChartMountResult;
  chartMountRuntimeModule: ChartMountRuntimeModule | null;
  applyBootstrapState: (bootstrap: PrepareChartMountResult['bootstrap']) => void;
  setLwcModule: (module: typeof import('lightweight-charts') | null) => void;
  setChartTheme: (theme: ChartTheme) => void;
  setIndicatorStripState: (state: 'expanded' | 'collapsed' | 'hidden') => void;
  setShowIndicatorLegend: (show: boolean) => void;
  setChartVisualMode: (mode: 'focus' | 'full') => void;
  setIndicatorProfileApplied: (value: string) => void;
  setMaPeriods: (periods: ChartMaPeriodBinding[]) => void;
  setMa7Val: (value: number) => void;
  setMa20Val: (value: number) => void;
  setMa25Val: (value: number) => void;
  setMa60Val: (value: number) => void;
  setMa99Val: (value: number) => void;
  setMa120Val: (value: number) => void;
}

export function applyChartBootstrapState(
  options: ApplyChartBootstrapStateOptions,
) {
  const { bootstrap } = options;
  options.setChart(bootstrap.chart);
  options.setSeries(bootstrap.series);
  options.setMa7Series(bootstrap.ma7Series);
  options.setMa20Series(bootstrap.ma20Series);
  options.setMa25Series(bootstrap.ma25Series);
  options.setMa60Series(bootstrap.ma60Series);
  options.setMa99Series(bootstrap.ma99Series);
  options.setMa120Series(bootstrap.ma120Series);
  options.setVolumeSeries(bootstrap.volumeSeries);
  options.setRsiSeries(bootstrap.rsiSeries);
  options.setBbUpperSeries(bootstrap.bbUpperSeries);
  options.setBbMiddleSeries(bootstrap.bbMiddleSeries);
  options.setBbLowerSeries(bootstrap.bbLowerSeries);
  options.setMacdLineSeries(bootstrap.macdLineSeries);
  options.setMacdSignalSeries(bootstrap.macdSignalSeries);
  options.setMacdHistSeries(bootstrap.macdHistSeries);
  options.setStochKSeries(bootstrap.stochKSeries);
  options.setStochDSeries(bootstrap.stochDSeries);
  options.setVolumePaneIndex(bootstrap.volumePaneIndex);
  options.setRsiPaneIndex(bootstrap.rsiPaneIndex);
  options.setMacdPaneIndex(bootstrap.macdPaneIndex);
  options.setStochPaneIndex(bootstrap.stochPaneIndex);
}

export function applyChartPreparedMountState(
  options: ApplyChartPreparedMountStateOptions,
) {
  const { preparedMount } = options;
  options.setLwcModule(preparedMount.lwcModule);
  options.setChartTheme(preparedMount.chartTheme);
  options.setIndicatorStripState(preparedMount.nextIndicatorStripState);
  options.setShowIndicatorLegend(preparedMount.nextShowIndicatorLegend);
  options.setChartVisualMode(preparedMount.nextChartVisualMode);
  options.setIndicatorProfileApplied(preparedMount.nextIndicatorProfileApplied);
  options.applyBootstrapState(preparedMount.bootstrap);
  options.setMaPeriods(
    options.chartMountRuntimeModule?.createChartMaPeriodBindings({
      bootstrap: preparedMount.bootstrap,
      setMa7Val: options.setMa7Val,
      setMa20Val: options.setMa20Val,
      setMa25Val: options.setMa25Val,
      setMa60Val: options.setMa60Val,
      setMa99Val: options.setMa99Val,
      setMa120Val: options.setMa120Val,
    }) ?? [],
  );
}
