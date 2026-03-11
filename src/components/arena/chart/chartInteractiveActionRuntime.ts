import type { AgentTradeSetup, DrawingMode } from '$lib/chart/chartTypes';
import type { IndicatorSnapshot, PatternDetection } from '$lib/terminal/signalEvidence';

export interface ChartInteractiveActionRuntimeController {
  publishCommunitySignal(
    dir: 'LONG' | 'SHORT',
    options?: { openCopyTrade?: boolean; sourceContext?: string },
  ): Promise<void>;
  requestChatAssist(): Promise<void>;
  activateTradeDrawing(dir?: 'LONG' | 'SHORT'): Promise<void>;
  dispose(): void;
}

export interface CreateChartInteractiveActionRuntimeOptions {
  getPair: () => string;
  getTimeframe: () => string;
  getLivePrice: () => number;
  getActiveTradeSetup: () => AgentTradeSetup | null;
  getChatTradeReady: () => boolean;
  getChatTradeDir: () => 'LONG' | 'SHORT';
  getEnableTradeLineEntry: () => boolean;
  getChartMode: () => 'agent' | 'trading';
  setChartMode: (mode: 'agent' | 'trading') => Promise<void>;
  setDrawingMode: (mode: DrawingMode) => void;
  emitChatRequest: (detail: { source: string; pair: string; timeframe: string }) => void;
  emitCommunitySignal: (detail: {
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
  }) => void;
  getIndicatorSnapshot?: () => IndicatorSnapshot;
  getOverlayPatterns?: () => PatternDetection[];
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  pushChartNotice: (message: string) => void;
}

export function createChartInteractiveActionRuntime(
  options: CreateChartInteractiveActionRuntimeOptions,
): ChartInteractiveActionRuntimeController {
  let signalAssemblyModulePromise:
    | Promise<
        [
          typeof import('$lib/chart/chartCommunitySignalDraft'),
          typeof import('$lib/terminal/signalEvidence'),
        ]
      >
    | null = null;

  function loadSignalAssemblyModules() {
    if (!signalAssemblyModulePromise) {
      signalAssemblyModulePromise = Promise.all([
        import('$lib/chart/chartCommunitySignalDraft'),
        import('$lib/terminal/signalEvidence'),
      ]);
    }
    return signalAssemblyModulePromise;
  }

  async function activateTradeDrawing(dir?: 'LONG' | 'SHORT') {
    if (!options.getEnableTradeLineEntry()) return;

    if (options.getChartMode() !== 'agent') {
      await options.setChartMode('agent');
    }

    const mode: DrawingMode =
      dir === 'SHORT' ? 'shortentry' : dir === 'LONG' ? 'longentry' : 'trade';
    options.setDrawingMode(mode);
    options.emitGtm('terminal_trade_drawing_activate', {
      source: dir ? 'chat-first' : 'unified-tool',
      dir: dir ?? 'auto',
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
    });

    if (dir) {
      options.pushChartNotice(`${dir} mode — drag on chart to set ENTRY/TP/SL`);
    } else {
      options.pushChartNotice('Position mode — drag down LONG · drag up SHORT');
    }
  }

  async function publishCommunitySignal(
    dir: 'LONG' | 'SHORT',
    runtimeOptions?: { openCopyTrade?: boolean; sourceContext?: string },
  ) {
    const [{ buildCommunitySignalDraft }, { buildChartObservationEvidence }] =
      await loadSignalAssemblyModules();
    const draft = buildCommunitySignalDraft({
      pair: options.getPair() || 'BTC/USDT',
      dir,
      livePrice: options.getLivePrice(),
      activeTradeSetup: options.getActiveTradeSetup(),
      timeframe: options.getTimeframe(),
      chatTradeReady: options.getChatTradeReady(),
      chatTradeDir: options.getChatTradeDir(),
    });
    if (!draft) {
      options.pushChartNotice('시그널 생성 실패: 가격 데이터가 부족합니다');
      return;
    }

    const openCopyTrade = runtimeOptions?.openCopyTrade !== false;
    const setup = options.getActiveTradeSetup();
    const evidence = buildChartObservationEvidence({
      pair: draft.pair,
      timeframe: options.getTimeframe(),
      livePrice: options.getLivePrice(),
      indicators: options.getIndicatorSnapshot?.(),
      patterns: options.getOverlayPatterns?.(),
      agentSetupName: setup?.agentName ?? (setup?.source === 'consensus' ? 'CONSENSUS' : undefined),
      agentSetupConf: setup?.conf,
      agentSetupDir: setup?.dir,
    });

    options.emitCommunitySignal({
      pair: draft.pair,
      dir: draft.dir,
      entry: draft.entry,
      tp: draft.tp,
      sl: draft.sl,
      conf: draft.conf,
      source: draft.source,
      reason: draft.reason,
      openCopyTrade,
      evidence,
    });

    options.emitGtm('terminal_chart_community_signal', {
      source: runtimeOptions?.sourceContext || 'chart-action',
      pair: draft.pair,
      dir: draft.dir,
      entry: draft.entry,
      tp: draft.tp,
      sl: draft.sl,
      conf: draft.conf,
      openCopyTrade,
    });

    options.pushChartNotice(`${draft.dir} 시그널 생성 완료 · COMMUNITY${openCopyTrade ? ' + COPY' : ''}`);
  }

  async function requestChatAssist() {
    options.emitGtm('terminal_chat_request_chart', {
      source: 'chart-bar',
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
      tradeReady: options.getChatTradeReady(),
      tradeDir: options.getChatTradeDir(),
    });

    if (options.getChatTradeReady()) {
      await activateTradeDrawing(options.getChatTradeDir());
      options.pushChartNotice(`${options.getChatTradeDir()} draw mode active`);
      return;
    }

    options.emitChatRequest({
      source: 'chart-bar',
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
    });
    options.pushChartNotice('채팅 탭에서 질문 후 거래를 시작하세요');
  }

  function dispose() {
    signalAssemblyModulePromise = null;
  }

  return {
    publishCommunitySignal,
    requestChatAssist,
    activateTradeDrawing,
    dispose,
  };
}
