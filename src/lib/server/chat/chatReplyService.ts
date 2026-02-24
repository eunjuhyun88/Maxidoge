import { AGENT_POOL } from '$lib/engine/agents';
import { normalizeAgentName } from '$lib/chat/agentRouting';
import {
  callLLM,
  isLLMAvailable,
  buildAgentSystemPrompt,
  buildOrchestratorSystemPrompt,
  type LLMMessage,
} from '$lib/server/llmService';
import { getErrorMessage } from '$lib/utils/errorUtils';
import type { AgentReply, ScanContext } from './chatTypes';

function toNum(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 100) return value.toFixed(2);
  return value.toFixed(4);
}

/** Template fallback (LLM 불가 시 사용) */
function buildAgentReplyFallback(
  agentId: string,
  _message: string,
  context: ScanContext | null,
  meta: Record<string, unknown>
): AgentReply {
  const fallbackPair = typeof meta.pair === 'string' && meta.pair ? meta.pair : 'BTC/USDT';
  const fallbackTf = typeof meta.timeframe === 'string' && meta.timeframe ? meta.timeframe : '4h';

  if (!context || context.signals.length === 0) {
    return {
      agentId,
      scanId: context?.scanId ?? null,
      source: 'fallback',
      text:
        `${agentId} response ready. Latest scan context is unavailable right now. ` +
        `Re-run scan on ${fallbackPair} ${String(fallbackTf).toUpperCase()} and ask again.`,
    };
  }

  if (agentId === 'ORCHESTRATOR') {
    const top = context.signals
      .slice(0, 3)
      .map((s) => `${s.agent_name} ${s.vote.toUpperCase()} ${Math.round(toNum(s.confidence, 0))}%`)
      .join(' · ');
    return {
      agentId,
      scanId: context.scanId,
      source: 'scan_context',
      text:
        `${context.pair} ${context.timeframe.toUpperCase()} consensus ${String(context.consensus || 'neutral').toUpperCase()} ` +
        `(${context.avgConfidence ?? 0}%). ${context.summary || ''}${top ? ` Top: ${top}` : ''}`,
    };
  }

  const target = context.signals.find((sig) => {
    const byId = normalizeAgentName(sig.agent_id);
    const byName = normalizeAgentName(sig.agent_name);
    return byId === agentId || byName === agentId;
  });

  if (!target) {
    return {
      agentId,
      scanId: context.scanId,
      source: 'scan_context',
      text:
        `${agentId} has no direct factor row in this scan. ` +
        `Current consensus is ${String(context.consensus || 'neutral').toUpperCase()} (${context.avgConfidence ?? 0}%).`,
    };
  }

  const conf = Math.round(toNum(target.confidence, 0));
  return {
    agentId,
    scanId: context.scanId,
    source: 'scan_context',
    text:
      `${target.agent_name} ${target.vote.toUpperCase()} ${conf}% · ${context.pair} ${context.timeframe.toUpperCase()} ` +
      `ENTRY ${formatPrice(toNum(target.entry_price, 0))} / TP ${formatPrice(toNum(target.tp_price, 0))} / ` +
      `SL ${formatPrice(toNum(target.sl_price, 0))}. ${target.analysis_text}`,
  };
}

/** LLM 기반 에이전트 응답 생성 (실패 시 template fallback) */
export async function buildAgentReply(
  agentId: string,
  message: string,
  context: ScanContext | null,
  meta: Record<string, unknown>
): Promise<AgentReply> {
  // LLM 사용 불가 → 기존 template fallback
  if (!isLLMAvailable()) {
    return buildAgentReplyFallback(agentId, message, context, meta);
  }

  const fallbackPair = typeof meta.pair === 'string' && meta.pair ? meta.pair : 'BTC/USDT';
  const fallbackTf = typeof meta.timeframe === 'string' && meta.timeframe ? meta.timeframe : '4h';

  // 실시간 가격 (meta에서 전달받음)
  const livePrices = (meta.livePrices && typeof meta.livePrices === 'object')
    ? meta.livePrices as Record<string, number>
    : {};

  // Scan context → LLM signal data 변환
  const scanSignals = context?.signals?.map(s => ({
    agentName: s.agent_name,
    vote: s.vote,
    confidence: Math.round(toNum(s.confidence, 0)),
    analysisText: s.analysis_text || '',
    entryPrice: toNum(s.entry_price, 0),
    tpPrice: toNum(s.tp_price, 0),
    slPrice: toNum(s.sl_price, 0),
  })) ?? [];

  const scanSummary = context
    ? `${context.pair} ${context.timeframe.toUpperCase()} ${String(context.consensus || 'neutral').toUpperCase()} (${context.avgConfidence ?? 0}%). ${context.summary || ''}`
    : null;

  // 시스템 프롬프트 빌드
  const agentDef = AGENT_POOL[agentId as keyof typeof AGENT_POOL];
  let systemPrompt: string;

  if (agentId === 'ORCHESTRATOR' || !agentDef) {
    systemPrompt = buildOrchestratorSystemPrompt({
      pair: fallbackPair,
      timeframe: fallbackTf,
      scanSummary,
      scanSignals,
      livePrices,
    });
  } else {
    systemPrompt = buildAgentSystemPrompt({
      agentId,
      agentDescription: agentDef.description,
      pair: fallbackPair,
      timeframe: fallbackTf,
      scanSummary,
      scanSignals,
      livePrices,
    });
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];

  try {
    const result = await callLLM({
      messages,
      maxTokens: 300,
      temperature: 0.7,
      timeoutMs: 12000,
    });

    return {
      agentId,
      scanId: context?.scanId ?? null,
      source: context?.signals?.length ? 'scan_context' : 'fallback',
      text: result.text,
    };
  } catch (err: unknown) {
    console.warn(`[chat/messages] LLM call failed for ${agentId}, using template fallback:`, getErrorMessage(err));
    return buildAgentReplyFallback(agentId, message, context, meta);
  }
}

