import {
  destroyTradingViewEmbed,
  mountTradingViewEmbed,
  type TradingViewEmbedInstance,
} from '$lib/chart/tradingviewEmbed';
import { gtmEvent } from '$lib/chart/chartHelpers';
import { resolveChartTheme, toTvHex, type ChartTheme } from '../ChartTheme';

type ChartMode = 'agent' | 'trading';
type FailureReason = 'timeout' | 'network';

export interface ChartTradingViewStatePatch {
  loading?: boolean;
  error?: string;
  safeMode?: boolean;
  fallbackTried?: boolean;
}

export interface ChartTradingViewRuntimeController {
  setMode(mode: ChartMode): void;
  sync(mode: ChartMode): void;
  retry(): void;
  dispose(): void;
}

interface ChartTradingViewRuntimeOptions {
  getContainer: () => HTMLDivElement | null;
  getThemeTarget: () => HTMLElement | null;
  getPair: () => string;
  getTimeframe: () => string;
  setState: (patch: ChartTradingViewStatePatch) => void;
  setTheme: (theme: ChartTheme) => void;
}

export function createChartTradingViewRuntime(
  options: ChartTradingViewRuntimeOptions,
): ChartTradingViewRuntimeController {
  let widget: TradingViewEmbedInstance | null = null;
  let initTimer: ReturnType<typeof setTimeout> | null = null;
  let loadTimer: ReturnType<typeof setTimeout> | null = null;
  let reinitKey = '';
  let fallbackTried = false;

  function clearInitTimer() {
    if (!initTimer) return;
    clearTimeout(initTimer);
    initTimer = null;
  }

  function clearLoadTimer() {
    if (!loadTimer) return;
    clearTimeout(loadTimer);
    loadTimer = null;
  }

  function destroyWidget() {
    clearLoadTimer();
    widget = destroyTradingViewEmbed(widget);
  }

  function resetState() {
    fallbackTried = false;
    options.setState({
      loading: false,
      error: '',
      safeMode: false,
      fallbackTried: false,
    });
  }

  function getChartIdentity() {
    return {
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
    };
  }

  function handleFailure(useSafeMode: boolean, reason: FailureReason) {
    clearLoadTimer();
    const { pair, timeframe } = getChartIdentity();

    if (!useSafeMode && !fallbackTried) {
      fallbackTried = true;
      options.setState({ fallbackTried: true });
      gtmEvent('terminal_tradingview_fallback_start', { reason, pair, timeframe });
      initWidget(true);
      return;
    }

    options.setState({
      loading: false,
      error: 'TradingView 연결 실패. 네트워크/확장프로그램 차단 가능성이 있습니다.',
    });
    gtmEvent('terminal_tradingview_error', {
      reason,
      mode: useSafeMode ? 'safe' : 'primary',
      pair,
      timeframe,
    });
  }

  function initWidget(useSafeMode: boolean) {
    const container = options.getContainer();
    if (!container) return;

    clearLoadTimer();
    options.setState({
      loading: true,
      error: '',
      safeMode: useSafeMode,
    });

    try {
      const activeTheme = resolveChartTheme(options.getThemeTarget() ?? container);
      options.setTheme(activeTheme);
      destroyWidget();

      const widgetDiv = container.querySelector<HTMLElement>('#tradingview_widget');
      if (!widgetDiv) {
        options.setState({
          loading: false,
          error: 'TradingView 컨테이너를 찾을 수 없습니다.',
        });
        return;
      }

      let loaded = false;
      const { pair, timeframe } = getChartIdentity();
      widget = mountTradingViewEmbed(
        widgetDiv,
        {
          pair,
          timeframe,
          useSafeMode,
          theme: {
            bg: toTvHex(activeTheme.bg),
            grid: activeTheme.grid,
            candleUp: activeTheme.candleUp,
            candleDown: activeTheme.candleDown,
          },
        },
        {
          onLoad: () => {
            loaded = true;
            clearLoadTimer();
            options.setState({
              loading: false,
              error: '',
              safeMode: useSafeMode,
            });
            gtmEvent('terminal_tradingview_loaded', {
              mode: useSafeMode ? 'safe' : 'primary',
              pair,
              timeframe,
            });
          },
          onError: () => {
            handleFailure(useSafeMode, 'network');
          },
        },
      );

      loadTimer = setTimeout(() => {
        if (!loaded) handleFailure(useSafeMode, 'timeout');
      }, 10000);
    } catch (error) {
      console.error('[ChartPanel] TV init error:', error);
      options.setState({
        loading: false,
        error: 'TradingView 초기화 실패',
      });
      const { pair, timeframe } = getChartIdentity();
      gtmEvent('terminal_tradingview_error', {
        reason: 'init_exception',
        mode: useSafeMode ? 'safe' : 'primary',
        pair,
        timeframe,
      });
    }
  }

  function scheduleInit() {
    clearInitTimer();
    initTimer = setTimeout(() => {
      fallbackTried = false;
      options.setState({
        error: '',
        fallbackTried: false,
      });
      initWidget(false);
    }, 220);
  }

  return {
    setMode(mode) {
      if (mode === 'trading') {
        reinitKey = '';
        resetState();
        return;
      }

      clearInitTimer();
      reinitKey = '';
      resetState();
      destroyWidget();
    },

    sync(mode) {
      if (mode !== 'trading') return;
      const container = options.getContainer();
      const { pair, timeframe } = getChartIdentity();
      if (!container || !pair || !timeframe) return;

      const key = `${pair}|${timeframe}`;
      if (key === reinitKey) return;
      reinitKey = key;
      scheduleInit();
    },

    retry() {
      fallbackTried = false;
      options.setState({
        error: '',
        fallbackTried: false,
      });
      initWidget(false);
    },

    dispose() {
      clearInitTimer();
      destroyWidget();
      resetState();
      reinitKey = '';
    },
  };
}
