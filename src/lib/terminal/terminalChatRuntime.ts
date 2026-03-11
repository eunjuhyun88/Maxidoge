import { sendTerminalChatMessage, TerminalApiError } from '$lib/api/terminalApi';
import { formatTerminalClock } from './terminalEventMappers';
import {
  buildAgentMeta,
  detectMentionedAgent,
  inferSuggestedDirection,
  isPatternScanIntent,
  type ChatTradeDirection,
} from './terminalHelpers';
import type {
  ChatMsg,
  ScanIntelDetail,
  TerminalChatConnectionStatus,
} from './terminalTypes';
import { buildOfflineAgentReply } from './terminalViewModel';

const AGENT_META = buildAgentMeta();

type LivePricesSnapshot = Record<string, unknown>;

export function createTerminalChatRuntime(params: {
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  getPair: () => string;
  getTimeframe: () => string;
  getLivePrices: () => LivePricesSnapshot;
  getLatestScan: () => ScanIntelDetail | null;
  getChatSuggestedDir: () => ChatTradeDirection;
  setChatSuggestedDir: (dir: ChatTradeDirection) => void;
  setChatTradeReady: (ready: boolean) => void;
  setChatConnectionStatus: (status: TerminalChatConnectionStatus) => void;
  setIsTyping: (typing: boolean) => void;
  appendChatMessage: (message: ChatMsg) => void;
  triggerPatternScanFromChat: (source: string, time: string) => Promise<void>;
  getAbortSignal: () => AbortSignal;
}) {
  const currentPair = () => params.getPair();
  const currentTimeframe = () => params.getTimeframe();
  const currentScan = () => params.getLatestScan();

  function setOfflineTradeState(tradeDir: ChatTradeDirection | null) {
    if (tradeDir) {
      params.setChatSuggestedDir(tradeDir);
      params.setChatTradeReady(true);
      return;
    }
    params.setChatTradeReady(false);
  }

  function toStatusLabel(error: unknown): string {
    if (error instanceof TerminalApiError) {
      return `${error.status} ${error.message}`;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return 'timeout';
    }
    return 'network';
  }

  async function handleSendChat(detail: { text: string }) {
    const text = detail.text.trim();
    if (!text) return;

    const time = formatTerminalClock();
    params.appendChatMessage({
      from: 'YOU',
      icon: '🐕',
      color: '#E8967D',
      text,
      time,
      isUser: true,
    });

    params.setIsTyping(true);

    const mentionedAgent = detectMentionedAgent(text) || undefined;
    const patternIntent = isPatternScanIntent(text);
    params.setChatTradeReady(false);
    params.emitGtm('terminal_chat_question_sent', {
      source: 'intel-chat',
      pair: currentPair(),
      timeframe: currentTimeframe(),
      chars: text.length,
      mentioned_agent: mentionedAgent || 'auto',
      intent: patternIntent ? 'pattern_scan' : 'agent_chat',
    });

    if (patternIntent) {
      params.setIsTyping(false);
      await params.triggerPatternScanFromChat('intel-chat', time);
      return;
    }

    params.setIsTyping(true);

    try {
      const response = await sendTerminalChatMessage({
        message: text,
        channel: 'terminal',
        senderKind: 'user',
        senderName: 'YOU',
        meta: {
          pair: currentPair(),
          timeframe: currentTimeframe(),
          mentionedAgent,
          livePrices: params.getLivePrices(),
        },
        signal: params.getAbortSignal(),
      });

      params.setIsTyping(false);
      params.setChatConnectionStatus('connected');

      const reply = response.agentResponse;
      if (!reply) return;

      const agentMeta = AGENT_META[reply.senderName] || AGENT_META.ORCHESTRATOR;
      params.appendChatMessage({
        from: reply.senderName,
        icon: agentMeta.icon,
        color: agentMeta.color,
        text: reply.message,
        time,
        isUser: false,
      });

      const inferred = inferSuggestedDirection(String(reply.message || ''));
      if (inferred) params.setChatSuggestedDir(inferred);
      params.setChatTradeReady(true);

      params.emitGtm('terminal_chat_answer_received', {
        source: 'intel-chat',
        pair: currentPair(),
        timeframe: currentTimeframe(),
        responder: reply.senderName || 'ORCHESTRATOR',
        chars: String(reply.message || '').length,
        suggested_dir: inferred || params.getChatSuggestedDir(),
      });
    } catch (error) {
      params.setIsTyping(false);

      const offline = buildOfflineAgentReply({
        userText: text,
        statusLabel: toStatusLabel(error),
        err: error,
        pair: currentPair(),
        timeframe: currentTimeframe(),
        latestScan: currentScan(),
      });

      params.setChatConnectionStatus(offline.connectionStatus);
      setOfflineTradeState(offline.tradeDir);

      const fallbackMeta = AGENT_META[offline.sender] || AGENT_META.ORCHESTRATOR;
      params.emitGtm('terminal_chat_answer_error', {
        source: 'intel-chat',
        pair: currentPair(),
        timeframe: currentTimeframe(),
        status: error instanceof TerminalApiError ? error.status : 'network',
        mode: 'offline_fallback',
      });
      params.appendChatMessage({
        from: offline.sender,
        icon: fallbackMeta.icon,
        color: fallbackMeta.color,
        text: offline.text,
        time,
        isUser: false,
      });
    }
  }

  return {
    handleSendChat,
  };
}
