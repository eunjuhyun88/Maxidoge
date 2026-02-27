// ═══════════════════════════════════════════════════════════════
// Stockclaw — Agent Persona Service (B-01)
// Emergency Meeting: Among Us-style agent debate with LLM personas
// ═══════════════════════════════════════════════════════════════
//
// 8개 에이전트 각각 고유 페르소나. 드래프트된 3 에이전트가
// 자신의 분석 데이터로 서로 반박하는 대사를 LLM으로 생성.
// ~$0.015/매치 (3 agents × $0.005 LLM call)

import { query } from '$lib/server/db';
import { callLLM, type LLMMessage } from '$lib/server/llmService';
import type {
  AgentId,
  AgentOutput,
  AgentDialogue,
  EmergencyMeetingData,
  EmergencyMeetingVoteSummary,
  Direction,
} from '$lib/engine/types';

// ── Agent Persona Definitions ───────────────────────────────

export interface AgentPersona {
  id: AgentId;
  name: string;
  nameKR: string;
  personality: string;        // LLM system prompt personality
  catchphrase: string;        // 시그니처 대사
  speakingStyle: string;      // 말투 지시
}

export const AGENT_PERSONAS: Record<AgentId, AgentPersona> = {
  STRUCTURE: {
    id: 'STRUCTURE',
    name: 'Structure',
    nameKR: '차트 순수주의자',
    personality: '차트만 믿는 광신도. EMA, 추세선, 패턴만이 진실이라 믿는다. 다른 데이터는 "노이즈"라고 무시.',
    catchphrase: '차트는 거짓말 안 해.',
    speakingStyle: '단호하고 간결. 차트 용어를 남발. "봐, 이 추세선을..." 식으로 시각적 근거 제시.',
  },
  VPA: {
    id: 'VPA',
    name: 'VPA',
    nameKR: '볼륨 광신자',
    personality: '거래량 없으면 무의미하다는 극단적 볼륨주의자. 가격 움직임은 볼륨이 확인해줘야 유효하다.',
    catchphrase: '볼륨 없는 무빙은 가짜다.',
    speakingStyle: '흥분 잘 하고 과장법 사용. "이 볼륨 봤어?!" 식으로 감탄사 많음.',
  },
  ICT: {
    id: 'ICT',
    name: 'ICT',
    nameKR: '스마트머니 음모론자',
    personality: '스마트머니 개념(FVG, 유동성풀, 오더블록)에 집착. 시장은 큰손들의 함정이라 믿는 음모론자.',
    catchphrase: 'FVG가 모든 걸 말해주고 있어.',
    speakingStyle: '음모론적 톤. "그들이 원하는 건..." 식으로 마켓메이커를 의인화.',
  },
  DERIV: {
    id: 'DERIV',
    name: 'Deriv',
    nameKR: '파생 악마',
    personality: '청산 캐스케이드와 펀딩비에 집착하는 파생상품 전문가. 레버리지 포지션이 시장을 움직인다고 확신.',
    catchphrase: '야 이 차트충아! FR 0.04%인데 롱이라고?',
    speakingStyle: '공격적이고 도발적. 숫자를 들이밀며 상대를 압박. 은어와 줄임말 사용.',
  },
  VALUATION: {
    id: 'VALUATION',
    name: 'Valuation',
    nameKR: '가치투자 노인',
    personality: '온체인 메트릭(MVRV, NVT, 사이클)만 보는 구세대 가치투자자. 단타를 경멸.',
    catchphrase: 'MVRV가 말해주고 있잖아.',
    speakingStyle: '느릿느릿하고 교훈적. "내가 2017년에도..." 식으로 과거 회상 즐김.',
  },
  FLOW: {
    id: 'FLOW',
    name: 'Flow',
    nameKR: '온체인 스토커',
    personality: '고래 지갑을 실시간 추적하는 온체인 탐정. 거래소 입출금이 모든 것의 단서.',
    catchphrase: '고래 5천 BTC 바이낸스 입금했어.',
    speakingStyle: '속삭이듯 말하다 갑자기 소리치는 스타일. 첩보원 느낌.',
  },
  SENTI: {
    id: 'SENTI',
    name: 'Senti',
    nameKR: '역발상 광인',
    personality: '공포가 극대화될 때 사고, 탐욕이 극대화될 때 파는 역발상 트레이더. 군중심리의 반대편.',
    catchphrase: '다들 무서워할 때가 기회야.',
    speakingStyle: '냉소적이고 비꼬는 톤. "하하, 다들 패닉이네" 식으로 냉정함 과시.',
  },
  MACRO: {
    id: 'MACRO',
    name: 'Macro',
    nameKR: '월가 출신 꼰대',
    personality: '전통 금융 출신. DXY, 국채 수익률, CPI 등 매크로 지표만 중시. 크립토를 약간 업신여김.',
    catchphrase: 'DXY 하락 + 10년물 하향 = 리스크온.',
    speakingStyle: '금융 전문용어 남발. 영어 섞어쓰기. "As I was saying..." 식으로 권위적.',
  },
};

// ── Emergency Meeting Generation ────────────────────────────

const PERSONA_TEMPERATURE = 0.85;
const EMERGENCY_MEETING_MAX_TOKENS = 256;

/** DB error helper */
const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

/**
 * 개별 agent의 Emergency Meeting 대사 생성
 */
async function generateAgentDialogue(
  persona: AgentPersona,
  agentOutput: AgentOutput,
  otherAgents: AgentOutput[],
  pair: string,
): Promise<AgentDialogue> {
  const otherSummaries = otherAgents
    .map(a => `${a.agentId}(${a.direction} ${a.confidence}%: "${a.thesis.slice(0, 80)}")`)
    .join('\n');

  const factorSummary = agentOutput.factors
    .slice(0, 4)
    .map(f => `${f.factorId}: ${f.value > 0 ? '+' : ''}${f.value} — ${f.detail.slice(0, 50)}`)
    .join('\n');

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: [
        `You are ${persona.nameKR} (${persona.name}), an agent in a crypto trading arena.`,
        `Personality: ${persona.personality}`,
        `Speaking style: ${persona.speakingStyle}`,
        `Catchphrase: "${persona.catchphrase}"`,
        '',
        'Rules:',
        '- Respond in Korean (일부 영어/전문용어 OK)',
        '- 2-4 sentences max, in character',
        '- Reference YOUR specific data to defend your position',
        '- Attack at least one other agent\'s reasoning',
        '- Be dramatic and entertaining, like Among Us emergency meeting',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `[Emergency Meeting] ${pair} 분석 토론`,
        '',
        `Your analysis: ${agentOutput.direction} (${agentOutput.confidence}%)`,
        `Your thesis: ${agentOutput.thesis}`,
        `Your key data:`,
        factorSummary,
        '',
        `Other agents say:`,
        otherSummaries,
        '',
        `Express your position and challenge the others. Stay in character!`,
      ].join('\n'),
    },
  ];

  try {
    const result = await callLLM({
      messages,
      maxTokens: EMERGENCY_MEETING_MAX_TOKENS,
      temperature: PERSONA_TEMPERATURE,
      timeoutMs: 10_000,
    });

    return {
      agentId: persona.id,
      specId: agentOutput.specId,
      personaName: persona.nameKR,
      direction: agentOutput.direction,
      confidence: agentOutput.confidence,
      dialogueText: result.text,
      isImposter: false,  // determined later
    };
  } catch (err) {
    console.warn(`[agentPersona] ${persona.id} dialogue generation failed:`, err);
    // Fallback to catchphrase
    return {
      agentId: persona.id,
      specId: agentOutput.specId,
      personaName: persona.nameKR,
      direction: agentOutput.direction,
      confidence: agentOutput.confidence,
      dialogueText: `${persona.catchphrase} ${agentOutput.direction} ${agentOutput.confidence}%.`,
      isImposter: false,
    };
  }
}

/**
 * Determine which agent is the "imposter" (least aligned with eventual price movement).
 * For now, uses agent confidence vs direction consensus as proxy.
 */
function determineImposter(dialogues: AgentDialogue[]): AgentId | null {
  if (dialogues.length === 0) return null;

  // Count direction votes
  const longCount = dialogues.filter(d => d.direction === 'LONG').length;
  const shortCount = dialogues.filter(d => d.direction === 'SHORT').length;
  const consensusDir: Direction = longCount > shortCount ? 'LONG' : longCount < shortCount ? 'SHORT' : 'NEUTRAL';

  if (consensusDir === 'NEUTRAL') return null;

  // The agent going against consensus with highest confidence is the imposter suspect
  const dissenters = dialogues.filter(d => d.direction !== consensusDir && d.direction !== 'NEUTRAL');
  if (dissenters.length === 0) return null;

  // Most confident dissenter = imposter
  dissenters.sort((a, b) => b.confidence - a.confidence);
  return dissenters[0].agentId;
}

/**
 * Generate full Emergency Meeting for a match.
 * Called after ANALYSIS phase when agent outputs are available.
 */
export async function generateEmergencyMeeting(
  matchId: string,
  agentOutputs: AgentOutput[],
  pair: string,
): Promise<EmergencyMeetingData> {
  // Check cache first
  try {
    const cached = await query<{ dialogue_text: string; agent_id: string; spec_id: string; persona_name: string; direction: string; confidence: number; is_imposter: boolean }>(
      `SELECT agent_id, spec_id, persona_name, direction, confidence, dialogue_text, is_imposter
       FROM agent_dialogue_cache WHERE match_id = $1 ORDER BY created_at`,
      [matchId]
    );
    if (cached.rows.length >= agentOutputs.length) {
      const dialogues: AgentDialogue[] = cached.rows.map((r: { agent_id: string; spec_id: string; persona_name: string; direction: string; confidence: number; dialogue_text: string; is_imposter: boolean }) => ({
        agentId: r.agent_id as AgentId,
        specId: r.spec_id,
        personaName: r.persona_name,
        direction: r.direction as Direction,
        confidence: Number(r.confidence),
        dialogueText: r.dialogue_text,
        isImposter: r.is_imposter,
      }));
      const imposterAgent = dialogues.find(d => d.isImposter)?.agentId ?? null;
      return {
        dialogues,
        voteSummary: buildVoteSummary(dialogues, imposterAgent),
        generatedAt: new Date().toISOString(),
      };
    }
  } catch (err: unknown) {
    if (!isTableError(err)) console.warn('[agentPersona] cache lookup failed:', err);
  }

  // Generate dialogues for each drafted agent
  const dialogues: AgentDialogue[] = [];
  for (const output of agentOutputs) {
    const persona = AGENT_PERSONAS[output.agentId];
    if (!persona) continue;

    const others = agentOutputs.filter(a => a.agentId !== output.agentId);
    const dialogue = await generateAgentDialogue(persona, output, others, pair);
    dialogues.push(dialogue);
  }

  // Determine imposter
  const imposterId = determineImposter(dialogues);
  for (const d of dialogues) {
    d.isImposter = d.agentId === imposterId;
  }

  const voteSummary = buildVoteSummary(dialogues, imposterId);

  // Cache results
  for (const d of dialogues) {
    try {
      await query(
        `INSERT INTO agent_dialogue_cache (match_id, agent_id, spec_id, persona_name, direction, confidence, dialogue_text, is_imposter)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (match_id, agent_id) DO UPDATE SET dialogue_text = EXCLUDED.dialogue_text, is_imposter = EXCLUDED.is_imposter`,
        [matchId, d.agentId, d.specId, d.personaName, d.direction, d.confidence, d.dialogueText, d.isImposter]
      );
    } catch (err: unknown) {
      if (!isTableError(err)) console.warn('[agentPersona] cache write failed:', err);
    }
  }

  return {
    dialogues,
    voteSummary,
    generatedAt: new Date().toISOString(),
  };
}

function buildVoteSummary(dialogues: AgentDialogue[], imposterId: AgentId | null): EmergencyMeetingVoteSummary {
  const longVotes = dialogues.filter(d => d.direction === 'LONG').length;
  const shortVotes = dialogues.filter(d => d.direction === 'SHORT').length;
  const neutralVotes = dialogues.filter(d => d.direction === 'NEUTRAL').length;

  const consensusDirection: Direction =
    longVotes > shortVotes ? 'LONG' :
    shortVotes > longVotes ? 'SHORT' : 'NEUTRAL';

  return {
    totalAgents: dialogues.length,
    longVotes,
    shortVotes,
    neutralVotes,
    imposterAgentId: imposterId,
    consensusDirection,
  };
}

/**
 * Get persona for a specific agent
 */
export function getPersona(agentId: AgentId): AgentPersona | null {
  return AGENT_PERSONAS[agentId] ?? null;
}
