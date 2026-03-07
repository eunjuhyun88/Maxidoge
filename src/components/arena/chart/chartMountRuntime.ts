import type { ISeriesApi } from 'lightweight-charts';
import { resolveChartTheme, type ChartTheme } from '../ChartTheme';
import {
  createChartBootstrap,
  type ChartBootstrapResult,
} from './chartBootstrap';
import {
  createChartRuntimeBundle,
  type ChartRuntimeBundleController,
  type CreateChartRuntimeBundleOptions,
} from './chartRuntimeBundle';
import type { ChartDataRuntimeController } from './chartDataRuntime';
import type { ChartPatternRuntimeController } from './chartPatternRuntime';
import type { ChartPositionRuntimeController } from './chartPositionRuntime';
import type { ChartTradingViewRuntimeController } from './chartTradingViewRuntime';

export interface ChartMaPeriodBinding {
  p: number;
  s: ISeriesApi<'Line'> | null;
  setVal: (v: number) => void;
}

interface CreateChartMaPeriodBindingsOptions {
  bootstrap: ChartBootstrapResult;
  setMa7Val: (value: number) => void;
  setMa20Val: (value: number) => void;
  setMa25Val: (value: number) => void;
  setMa60Val: (value: number) => void;
  setMa99Val: (value: number) => void;
  setMa120Val: (value: number) => void;
}

export function createChartMaPeriodBindings(
  options: CreateChartMaPeriodBindingsOptions,
): ChartMaPeriodBinding[] {
  return [
    { p: 7, s: options.bootstrap.ma7Series, setVal: options.setMa7Val },
    { p: 20, s: options.bootstrap.ma20Series, setVal: options.setMa20Val },
    { p: 25, s: options.bootstrap.ma25Series, setVal: options.setMa25Val },
    { p: 60, s: options.bootstrap.ma60Series, setVal: options.setMa60Val },
    { p: 99, s: options.bootstrap.ma99Series, setVal: options.setMa99Val },
    { p: 120, s: options.bootstrap.ma120Series, setVal: options.setMa120Val },
  ];
}

export interface PrepareChartMountOptions {
  chartContainer: HTMLDivElement;
  advancedMode: boolean;
  indicatorStripState: 'expanded' | 'collapsed' | 'hidden';
  showIndicatorLegend: boolean;
  chartVisualMode: 'focus' | 'full';
  indicatorProfileApplied: string | null;
  barSpacing: number;
  compactViewport: boolean;
  applyIndicatorProfile: () => void;
}

export interface PrepareChartMountResult {
  lwcModule: typeof import('lightweight-charts');
  chartTheme: ChartTheme;
  bootstrap: ChartBootstrapResult;
  nextIndicatorStripState: 'expanded' | 'collapsed' | 'hidden';
  nextShowIndicatorLegend: boolean;
  nextChartVisualMode: 'focus' | 'full';
  nextIndicatorProfileApplied: string;
}

export async function prepareChartMount(
  options: PrepareChartMountOptions,
): Promise<PrepareChartMountResult> {
  const lwcModule = await import('lightweight-charts');
  const chartTheme = resolveChartTheme(options.chartContainer);

  let nextIndicatorStripState = options.indicatorStripState;
  let nextShowIndicatorLegend = options.showIndicatorLegend;
  let nextChartVisualMode = options.chartVisualMode;

  if (options.advancedMode && nextIndicatorStripState === 'expanded') {
    nextIndicatorStripState = 'collapsed';
    nextShowIndicatorLegend = false;
    nextChartVisualMode = 'focus';
  }

  let nextIndicatorProfileApplied = options.indicatorProfileApplied;
  if (nextIndicatorProfileApplied === null) {
    options.applyIndicatorProfile();
    nextIndicatorProfileApplied = options.advancedMode
      ? `advanced:${nextChartVisualMode}`
      : 'basic';
  }

  const bootstrap = createChartBootstrap({
    lwc: lwcModule,
    chartContainer: options.chartContainer,
    chartTheme,
    barSpacing: options.barSpacing,
    compactViewport: options.compactViewport,
  });

  return {
    lwcModule,
    chartTheme,
    bootstrap,
    nextIndicatorStripState,
    nextShowIndicatorLegend,
    nextChartVisualMode,
    nextIndicatorProfileApplied,
  };
}

export interface CreateChartPrimaryRuntimeOptions {
  runtimeBundleOptions: CreateChartRuntimeBundleOptions;
  setRuntimeBundle: (bundle: ChartRuntimeBundleController | null) => void;
  setDataRuntime: (runtime: ChartDataRuntimeController | null) => void;
  setTradingViewRuntime: (runtime: ChartTradingViewRuntimeController | null) => void;
  setPositionRuntime: (runtime: ChartPositionRuntimeController | null) => void;
  setPatternRuntime: (runtime: ChartPatternRuntimeController | null) => void;
  disposeChartSupportRuntimes: () => void;
}

export function createChartPrimaryRuntime(options: CreateChartPrimaryRuntimeOptions) {
  const runtimeBundle = createChartRuntimeBundle(options.runtimeBundleOptions);

  options.setRuntimeBundle(runtimeBundle);
  options.setDataRuntime(runtimeBundle.dataRuntime);
  options.setTradingViewRuntime(runtimeBundle.tradingViewRuntime);
  options.setPositionRuntime(runtimeBundle.positionRuntime);
  options.setPatternRuntime(runtimeBundle.patternRuntime);

  let disposed = false;

  function cleanup() {
    if (disposed) return;
    disposed = true;
    runtimeBundle.dispose();
    options.setRuntimeBundle(null);
    options.setDataRuntime(null);
    options.setTradingViewRuntime(null);
    options.setPositionRuntime(null);
    options.setPatternRuntime(null);
    options.disposeChartSupportRuntimes();
  }

  return {
    cleanup,
  };
}
