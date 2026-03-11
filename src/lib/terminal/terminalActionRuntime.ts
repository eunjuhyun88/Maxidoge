import {
  buildPatternScanErrorMessage,
  buildPatternScanResultMessage,
  buildPatternScanUnavailableMessage,
} from './terminalEventMappers';
import { formatPatternChatReply } from './terminalHelpers';
import type {
  ChatMsg,
  ChartPanelHandle,
  ChatTradeDirection,
  MobileTab,
  TerminalChartRequestDetail,
} from './terminalTypes';

type TerminalViewport = 'mobile' | 'tablet' | 'desktop';

export function createTerminalActionRuntime(params: {
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  getPair: () => string;
  getTimeframe: () => string;
  getViewport: () => TerminalViewport;
  getMobileTab: () => MobileTab;
  setMobileTab: (tab: MobileTab) => void;
  isLeftCollapsed: () => boolean;
  toggleLeft: () => void;
  isRightCollapsed: () => boolean;
  toggleRight: () => void;
  tryTriggerWarRoomScan: () => boolean;
  hasPendingChartScan: () => boolean;
  setPendingChartScan: (pending: boolean) => void;
  getActiveChartPanel: () => ChartPanelHandle | null;
  waitForUi: () => Promise<void>;
  appendChatMessage: (message: ChatMsg) => void;
  focusChatInput: () => void;
  getChatTradeReady: () => boolean;
  getChatSuggestedDir: () => ChatTradeDirection;
}) {
  const currentPair = () => params.getPair();
  const currentTimeframe = () => params.getTimeframe();

  function autoSwitchMobileTab(target: MobileTab, reason: string): boolean {
    if (params.getViewport() !== 'mobile' || params.getMobileTab() === target) return false;
    params.emitGtm('terminal_mobile_tab_auto_switch', {
      from_tab: params.getMobileTab(),
      to_tab: target,
      reason,
    });
    params.setMobileTab(target);
    return true;
  }

  function requestTerminalScan(source: string, pairHint?: string, timeframeHint?: string) {
    params.emitGtm('terminal_scan_request_shell', {
      source,
      pair: pairHint || currentPair(),
      timeframe: timeframeHint || currentTimeframe(),
    });

    if (params.tryTriggerWarRoomScan()) return;

    params.setPendingChartScan(true);
    if (params.getViewport() === 'desktop' && params.isLeftCollapsed()) {
      params.toggleLeft();
    }
    autoSwitchMobileTab('warroom', 'scan_request');
  }

  function flushPendingTerminalScan() {
    if (!params.hasPendingChartScan()) return;
    if (params.tryTriggerWarRoomScan()) {
      params.setPendingChartScan(false);
    }
  }

  function focusIntelChat(source: string) {
    if (params.getViewport() === 'desktop' && params.isRightCollapsed()) {
      params.toggleRight();
    }
    autoSwitchMobileTab('intel', source);
    params.focusChatInput();
  }

  function handleChartScanRequest(detail: TerminalChartRequestDetail) {
    requestTerminalScan(detail.source || 'chart-panel', detail.pair, detail.timeframe);
  }

  function handleChartChatRequest(detail: TerminalChartRequestDetail) {
    params.emitGtm('terminal_chat_request_shell', {
      source: detail.source || 'chart-panel',
      pair: detail.pair || currentPair(),
      timeframe: detail.timeframe || currentTimeframe(),
      trade_ready: params.getChatTradeReady(),
    });
    focusIntelChat(detail.source || 'chart-panel');
  }

  async function triggerPatternScanFromChat(source: string, time: string) {
    const switched = autoSwitchMobileTab('chart', 'pattern_scan_from_chat');
    if (switched) await params.waitForUi();

    await params.waitForUi();
    const chartPanel = params.getActiveChartPanel();
    if (!chartPanel || typeof chartPanel.runPatternScanFromIntel !== 'function') {
      params.emitGtm('terminal_pattern_scan_request_failed', {
        source,
        reason: 'chart_panel_unavailable',
        pair: currentPair(),
        timeframe: currentTimeframe(),
      });
      params.appendChatMessage(buildPatternScanUnavailableMessage(time));
      return;
    }

    try {
      const report = await chartPanel.runPatternScanFromIntel({ scope: 'visible', focus: true });
      params.emitGtm('terminal_pattern_scan_request', {
        source,
        pair: currentPair(),
        timeframe: currentTimeframe(),
        scope: report.scope,
        candle_count: report.candleCount,
        pattern_count: report.patternCount,
        ok: report.ok,
      });
      params.appendChatMessage(buildPatternScanResultMessage(formatPatternChatReply(report), time));
    } catch (error) {
      params.emitGtm('terminal_pattern_scan_request_failed', {
        source,
        reason: 'runtime_error',
        pair: currentPair(),
        timeframe: currentTimeframe(),
      });
      params.appendChatMessage(buildPatternScanErrorMessage(time));
      console.error('[terminal] pattern scan from chat failed:', error);
    }
  }

  async function triggerTradePlanFromChat(source: string) {
    if (!params.getChatTradeReady()) {
      params.emitGtm('terminal_trade_plan_request_blocked', {
        source,
        reason: 'chat_answer_required',
        pair: currentPair(),
        timeframe: currentTimeframe(),
      });
      focusIntelChat(`${source}-chat-first`);
      return;
    }

    if (params.getViewport() === 'desktop' && params.isRightCollapsed()) {
      params.toggleRight();
    }

    const switched = autoSwitchMobileTab('chart', 'trade_plan_from_chat');
    if (switched) await params.waitForUi();

    await params.waitForUi();
    const chartPanel = params.getActiveChartPanel();
    if (!chartPanel || typeof chartPanel.activateTradeDrawing !== 'function') {
      params.emitGtm('terminal_trade_plan_request_failed', {
        source,
        reason: 'chart_panel_unavailable',
        pair: currentPair(),
        timeframe: currentTimeframe(),
      });
      return;
    }

    params.emitGtm('terminal_trade_plan_request', {
      source,
      pair: currentPair(),
      timeframe: currentTimeframe(),
      suggested_dir: params.getChatSuggestedDir(),
    });
    await chartPanel.activateTradeDrawing(params.getChatSuggestedDir());
  }

  async function handleDecisionPrimaryAction(paramsForDecision: {
    terminalScanning: boolean;
    hasLatestScan: boolean;
  }) {
    if (paramsForDecision.terminalScanning) return;
    if (!paramsForDecision.hasLatestScan) {
      requestTerminalScan('decision-rail');
      return;
    }
    if (params.getChatTradeReady()) {
      await triggerTradePlanFromChat('decision-rail');
      return;
    }
    focusIntelChat('decision-rail-chat');
  }

  return {
    flushPendingTerminalScan,
    handleChartChatRequest,
    handleChartScanRequest,
    handleDecisionPrimaryAction,
    requestTerminalScan,
    triggerPatternScanFromChat,
    triggerTradePlanFromChat,
  };
}
