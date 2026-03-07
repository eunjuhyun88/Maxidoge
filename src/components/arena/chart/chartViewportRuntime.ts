import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { BAR_SPACING } from '$lib/chart/chartIndicators';
import type { IndicatorKey } from '$lib/chart/chartTypes';

export interface ChartViewportRuntimeController {
  applyIndicatorVisibility(): void;
  applyTimeScale(): void;
  zoomChart(direction: 1 | -1): void;
  fitChartRange(): void;
  toggleAutoScaleY(): void;
  resetChartScale(): void;
  dispose(): void;
}

export interface CreateChartViewportRuntimeOptions {
  getChart: () => IChartApi | null;
  getSeriesRefs: () => {
    ma7Series: ISeriesApi<'Line'> | null;
    ma20Series: ISeriesApi<'Line'> | null;
    ma25Series: ISeriesApi<'Line'> | null;
    ma60Series: ISeriesApi<'Line'> | null;
    ma99Series: ISeriesApi<'Line'> | null;
    ma120Series: ISeriesApi<'Line'> | null;
    rsiSeries: ISeriesApi<'Line'> | null;
    volumeSeries: ISeriesApi<'Histogram'> | null;
  };
  getPaneIndexes: () => { volumePaneIndex: number | null; rsiPaneIndex: number | null };
  getIndicatorEnabled: () => Record<IndicatorKey, boolean>;
  getBarSpacing: () => number;
  setBarSpacing: (next: number) => void;
  getAutoScaleY: () => boolean;
  setAutoScaleY: (next: boolean) => void;
  renderDrawings: () => void;
  pushChartNotice: (message: string) => void;
}

export function createChartViewportRuntime(
  options: CreateChartViewportRuntimeOptions,
): ChartViewportRuntimeController {
  function applyPaneLayout() {
    const chart = options.getChart();
    if (!chart) return;

    try {
      const panes = chart.panes();
      const { volumePaneIndex, rsiPaneIndex } = options.getPaneIndexes();
      const mainPane = panes?.[0];
      const volPane = volumePaneIndex !== null ? panes?.[volumePaneIndex] : null;
      const rsiPane = rsiPaneIndex !== null ? panes?.[rsiPaneIndex] : null;
      if (!mainPane || !volPane || !rsiPane) return;

      const indicatorEnabled = options.getIndicatorEnabled();
      const volOn = indicatorEnabled.vol;
      const rsiOn = indicatorEnabled.rsi;

      if (volOn && rsiOn) {
        mainPane.setStretchFactor(0.82);
        volPane.setStretchFactor(0.09);
        rsiPane.setStretchFactor(0.09);
      } else if (volOn || rsiOn) {
        mainPane.setStretchFactor(0.9);
        volPane.setStretchFactor(volOn ? 0.1 : 0.02);
        rsiPane.setStretchFactor(rsiOn ? 0.1 : 0.02);
      } else {
        mainPane.setStretchFactor(0.96);
        volPane.setStretchFactor(0.02);
        rsiPane.setStretchFactor(0.02);
      }
    } catch {}

    options.renderDrawings();
  }

  function applyIndicatorVisibility() {
    const indicatorEnabled = options.getIndicatorEnabled();
    const {
      ma7Series,
      ma20Series,
      ma25Series,
      ma60Series,
      ma99Series,
      ma120Series,
      rsiSeries,
      volumeSeries,
    } = options.getSeriesRefs();

    if (ma7Series) ma7Series.applyOptions({ visible: indicatorEnabled.ma7 });
    if (ma20Series) ma20Series.applyOptions({ visible: indicatorEnabled.ma20 });
    if (ma25Series) ma25Series.applyOptions({ visible: indicatorEnabled.ma25 });
    if (ma60Series) ma60Series.applyOptions({ visible: indicatorEnabled.ma60 });
    if (ma99Series) ma99Series.applyOptions({ visible: indicatorEnabled.ma99 });
    if (ma120Series) ma120Series.applyOptions({ visible: indicatorEnabled.ma120 });
    if (rsiSeries) rsiSeries.applyOptions({ visible: indicatorEnabled.rsi });
    if (volumeSeries) volumeSeries.applyOptions({ visible: indicatorEnabled.vol });

    applyPaneLayout();
  }

  function applyTimeScale() {
    const chart = options.getChart();
    if (!chart) return;
    chart.timeScale().applyOptions({
      barSpacing: options.getBarSpacing(),
      minBarSpacing: 3,
      rightOffset: 6,
    });
    options.renderDrawings();
  }

  function zoomChart(direction: 1 | -1) {
    const nextSpacing = Math.max(
      BAR_SPACING.MIN,
      Math.min(BAR_SPACING.MAX, options.getBarSpacing() + direction * BAR_SPACING.STEP),
    );
    options.setBarSpacing(nextSpacing);
    applyTimeScale();
    options.pushChartNotice(`ZOOM ${nextSpacing.toFixed(1)}`);
  }

  function fitChartRange() {
    const chart = options.getChart();
    if (!chart) return;
    chart.timeScale().fitContent();
    options.pushChartNotice('전체 구간 맞춤');
  }

  function toggleAutoScaleY() {
    const nextAutoScaleY = !options.getAutoScaleY();
    options.setAutoScaleY(nextAutoScaleY);
    try {
      options.getChart()?.priceScale('right').applyOptions({ autoScale: nextAutoScaleY });
    } catch {}
    options.pushChartNotice(nextAutoScaleY ? 'Y-AUTO ON' : 'Y-AUTO OFF');
    options.renderDrawings();
  }

  function resetChartScale() {
    options.setBarSpacing(BAR_SPACING.DEFAULT);
    options.setAutoScaleY(true);
    applyTimeScale();
    try {
      options.getChart()?.priceScale('right').applyOptions({ autoScale: true });
    } catch {}
    options.getChart()?.timeScale().fitContent();
    options.pushChartNotice('스케일 초기화');
    options.renderDrawings();
  }

  function dispose() {}

  return {
    applyIndicatorVisibility,
    applyTimeScale,
    zoomChart,
    fitChartRange,
    toggleAutoScaleY,
    resetChartScale,
    dispose,
  };
}
