// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — LLM Service (server-side only)
// ═══════════════════════════════════════════════════════════════
//
// 통합 LLM 호출 서비스. Groq(가장 빠름) → Gemini → DeepSeek 순으로 fallback.
// 에이전트 채팅, 분석 요약 등 모든 LLM 호출의 단일 진입점.

import {
  GROQ_API_KEY, GROQ_MODEL, groqUrl,
  GEMINI_API_KEY, GEMINI_MODEL, geminiUrl,
  DEEPSEEK_API_KEY, DEEPSEEK_MODEL, deepseekUrl,
  getAvailableProvider,
  type LLMProvider,
} from './llmConfig';

// ─── Types ────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallOptions {
  messages: LLMMessage[];
  /** 우선 사용할 provider (없으면 자동 선택) */
  provider?: LLMProvider;
  /** 최대 토큰 수 (기본 512) */
  maxTokens?: number;
  /** temperature (기본 0.7) */
  temperature?: number;
  /** 타임아웃 ms (기본 15000) */
  timeoutMs?: number;
}

export interface LLMResult {
  text: string;
  provider: LLMProvider;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

// ─── Groq (OpenAI-compatible) ─────────────────────────────────

async function callGroq(messages: LLMMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<LLMResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(groqUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Groq ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice?.message?.content) throw new Error('Groq: empty response');

    return {
      text: choice.message.content.trim(),
      provider: 'groq',
      model: GROQ_MODEL,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Gemini ───────────────────────────────────────────────────

async function callGemini(messages: LLMMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<LLMResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Gemini format: system instruction + contents
  const systemMsg = messages.find(m => m.role === 'system');
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  try {
    const res = await fetch(`${geminiUrl()}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini: empty response');

    return {
      text: text.trim(),
      provider: 'gemini',
      model: GEMINI_MODEL,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
      } : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── DeepSeek (OpenAI-compatible) ─────────────────────────────

async function callDeepSeek(messages: LLMMessage[], maxTokens: number, temperature: number, timeoutMs: number): Promise<LLMResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(deepseekUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`DeepSeek ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice?.message?.content) throw new Error('DeepSeek: empty response');

    return {
      text: choice.message.content.trim(),
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Unified Call with Fallback ───────────────────────────────

const PROVIDER_CALL: Record<LLMProvider, typeof callGroq> = {
  groq: callGroq,
  gemini: callGemini,
  deepseek: callDeepSeek,
};

const FALLBACK_ORDER: LLMProvider[] = ['groq', 'deepseek', 'gemini'];

function availableProviders(): LLMProvider[] {
  const checks: Record<LLMProvider, boolean> = {
    groq: GROQ_API_KEY.length > 0,
    deepseek: DEEPSEEK_API_KEY.length > 0,
    gemini: GEMINI_API_KEY.length > 0,
  };
  return FALLBACK_ORDER.filter(p => checks[p]);
}

/**
 * 통합 LLM 호출. 지정된 provider 또는 자동 선택 후, 실패 시 다음 provider로 fallback.
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMResult> {
  const { messages, maxTokens = 512, temperature = 0.7, timeoutMs = 15000 } = options;
  const providers = availableProviders();

  if (providers.length === 0) {
    throw new Error('No LLM provider available. Check API keys (GROQ_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY).');
  }

  // 지정된 provider가 있으면 맨 앞으로
  const preferred = options.provider;
  const ordered = preferred && providers.includes(preferred)
    ? [preferred, ...providers.filter(p => p !== preferred)]
    : providers;

  let lastError: Error | null = null;

  for (const provider of ordered) {
    try {
      return await PROVIDER_CALL[provider](messages, maxTokens, temperature, timeoutMs);
    } catch (err: any) {
      lastError = err;
      console.warn(`[llmService] ${provider} failed: ${err.message}`);
    }
  }

  throw lastError ?? new Error('All LLM providers failed');
}

/**
 * LLM 사용 가능 여부 체크
 */
export function isLLMAvailable(): boolean {
  return availableProviders().length > 0;
}

// ─── Agent Chat System Prompt Builder ─────────────────────────

export interface AgentChatContext {
  agentId: string;
  agentDescription: string;
  pair: string;
  timeframe: string;
  scanSummary?: string | null;
  scanSignals?: Array<{
    agentName: string;
    vote: string;
    confidence: number;
    analysisText: string;
    entryPrice?: number;
    tpPrice?: number;
    slPrice?: number;
  }>;
}

/**
 * 에이전트별 시스템 프롬프트 빌더.
 * 스캔 컨텍스트가 있으면 포함, 없으면 일반 분석으로 fallback.
 */
export function buildAgentSystemPrompt(ctx: AgentChatContext): string {
  const lines: string[] = [
    `You are ${ctx.agentId}, a specialized crypto trading analysis agent in the MAXI⚡DOGE terminal.`,
    `Specialty: ${ctx.agentDescription}`,
    `Current market: ${ctx.pair} on ${ctx.timeframe.toUpperCase()} timeframe.`,
    '',
    'Rules:',
    '- Respond concisely (2-4 sentences max). Use trading jargon.',
    '- Always include specific price levels, percentages, or metrics when available.',
    '- State your directional bias (LONG/SHORT/NEUTRAL) with confidence %.',
    '- Format: plain text, no markdown headers. Use → for flow, | for separators.',
    '- If asked about topics outside your specialty, briefly answer then redirect to your domain.',
    '- Korean responses are OK if the user writes in Korean.',
  ];

  if (ctx.scanSummary || (ctx.scanSignals && ctx.scanSignals.length > 0)) {
    lines.push('', '── Latest Scan Context ──');
    if (ctx.scanSummary) {
      lines.push(`Consensus: ${ctx.scanSummary}`);
    }
    if (ctx.scanSignals && ctx.scanSignals.length > 0) {
      lines.push('Agent Signals:');
      for (const sig of ctx.scanSignals.slice(0, 5)) {
        const prices = sig.entryPrice
          ? ` | ENTRY ${sig.entryPrice} / TP ${sig.tpPrice} / SL ${sig.slPrice}`
          : '';
        lines.push(`  ${sig.agentName}: ${sig.vote.toUpperCase()} ${sig.confidence}%${prices} — ${sig.analysisText}`);
      }
    }
    lines.push('', 'Use this scan data to ground your response with real numbers.');
  } else {
    lines.push('', 'No recent scan data available. Provide general analysis based on your specialty.');
  }

  return lines.join('\n');
}

/**
 * 오케스트레이터 시스템 프롬프트 (멘션 없이 질문할 때)
 */
export function buildOrchestratorSystemPrompt(ctx: Omit<AgentChatContext, 'agentId' | 'agentDescription'>): string {
  const lines: string[] = [
    'You are the ORCHESTRATOR, the lead AI commander of the MAXI⚡DOGE 8-agent crypto intelligence system.',
    `Current market: ${ctx.pair} on ${ctx.timeframe.toUpperCase()} timeframe.`,
    '',
    'Your agents: STRUCTURE (chart), VPA (volume), ICT (smart money), DERIV (derivatives), VALUATION (on-chain), FLOW (fund flows), SENTI (sentiment), MACRO (macro).',
    '',
    'Rules:',
    '- Synthesize multi-agent perspectives into actionable insights.',
    '- Respond concisely (3-5 sentences max). Use trading jargon.',
    '- Include directional bias, confidence, and key levels.',
    '- If the user asks about a specific domain, suggest tagging the relevant agent (e.g., "@DERIV").',
    '- Korean responses are OK if the user writes in Korean.',
  ];

  if (ctx.scanSummary || (ctx.scanSignals && ctx.scanSignals.length > 0)) {
    lines.push('', '── Latest Scan Context ──');
    if (ctx.scanSummary) lines.push(`Summary: ${ctx.scanSummary}`);
    if (ctx.scanSignals && ctx.scanSignals.length > 0) {
      lines.push('Signals:');
      for (const sig of ctx.scanSignals.slice(0, 5)) {
        lines.push(`  ${sig.agentName}: ${sig.vote.toUpperCase()} ${sig.confidence}%`);
      }
    }
    lines.push('', 'Synthesize this data in your response.');
  }

  return lines.join('\n');
}
