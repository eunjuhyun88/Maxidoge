import {
  createChartDataRuntime,
  type ChartDataRuntimeController,
} from './chartDataRuntime';
import {
  createChartPatternRuntime,
  type ChartPatternRuntimeController,
} from './chartPatternRuntime';
import {
  createChartPositionRuntime,
  type ChartPositionRuntimeController,
} from './chartPositionRuntime';
import {
  createChartTradingViewRuntime,
  type ChartTradingViewRuntimeController,
} from './chartTradingViewRuntime';
import { bindChartRuntimeInteractions } from './chartRuntimeBindings';

export interface ChartRuntimeBundleController {
  dataRuntime: ChartDataRuntimeController;
  patternRuntime: ChartPatternRuntimeController;
  positionRuntime: ChartPositionRuntimeController;
  tradingViewRuntime: ChartTradingViewRuntimeController;
  dispose(): void;
}

export interface CreateChartRuntimeBundleOptions {
  pattern: Parameters<typeof createChartPatternRuntime>[0];
  position: Parameters<typeof createChartPositionRuntime>[0];
  tradingView: Parameters<typeof createChartTradingViewRuntime>[0];
  data: Parameters<typeof createChartDataRuntime>[0];
  bindings: Omit<Parameters<typeof bindChartRuntimeInteractions>[0], 'onLoadMoreHistory'>;
  removeChart: () => void;
}

export function createChartRuntimeBundle(
  options: CreateChartRuntimeBundleOptions,
): ChartRuntimeBundleController {
  const patternRuntime = createChartPatternRuntime(options.pattern);
  const positionRuntime = createChartPositionRuntime(options.position);
  const tradingViewRuntime = createChartTradingViewRuntime(options.tradingView);
  const dataRuntime = createChartDataRuntime(options.data);

  const unbindRuntime = bindChartRuntimeInteractions({
    ...options.bindings,
    onLoadMoreHistory: () => {
      void dataRuntime.loadMoreHistory();
    },
  });

  function dispose() {
    unbindRuntime();
    dataRuntime.dispose();
    tradingViewRuntime.dispose();
    positionRuntime.dispose();
    patternRuntime.dispose();
    options.removeChart();
  }

  return {
    dataRuntime,
    patternRuntime,
    positionRuntime,
    tradingViewRuntime,
    dispose,
  };
}
