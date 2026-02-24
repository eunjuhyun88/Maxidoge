export type RoutedAgentId =
  | 'STRUCTURE'
  | 'VPA'
  | 'ICT'
  | 'DERIV'
  | 'VALUATION'
  | 'FLOW'
  | 'SENTI'
  | 'MACRO'
  | 'ORCHESTRATOR';

const ROUTED_AGENT_IDS = new Set<RoutedAgentId>([
  'STRUCTURE',
  'VPA',
  'ICT',
  'DERIV',
  'VALUATION',
  'FLOW',
  'SENTI',
  'MACRO',
  'ORCHESTRATOR',
]);

const AGENT_ALIASES = new Map<string, RoutedAgentId>([
  ['STRUCTURE', 'STRUCTURE'],
  ['STR', 'STRUCTURE'],
  ['VPA', 'VPA'],
  ['ICT', 'ICT'],
  ['DERIV', 'DERIV'],
  ['VALUATION', 'VALUATION'],
  ['VALUE', 'VALUATION'],
  ['FLOW', 'FLOW'],
  ['SENTI', 'SENTI'],
  ['SENTIMENT', 'SENTI'],
  ['MACRO', 'MACRO'],
  ['GUARDIAN', 'ORCHESTRATOR'],
  ['COMMANDER', 'ORCHESTRATOR'],
  ['SCANNER', 'ORCHESTRATOR'],
  ['AGENT', 'ORCHESTRATOR'],
  ['ORCHESTRATOR', 'ORCHESTRATOR'],
  ['SYSTEM', 'ORCHESTRATOR'],
]);

/**
 * 정규화된 에이전트 ID 반환.
 * - @ 접두, 특수문자 제거
 * - alias -> canonical ID 매핑
 */
export function normalizeAgentName(raw: unknown): RoutedAgentId | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.toUpperCase().replace(/^@+/, '').replace(/[^A-Z0-9_]/g, '');
  if (!cleaned) return null;
  const aliasMapped = AGENT_ALIASES.get(cleaned);
  if (aliasMapped) return aliasMapped;
  if (ROUTED_AGENT_IDS.has(cleaned as RoutedAgentId)) return cleaned as RoutedAgentId;
  return null;
}

/**
 * 채팅 메시지에서 멘션 에이전트 추론.
 * - meta.mentionedAgent 우선
 * - 메시지 내 @mention 후순위
 */
export function detectMentionedAgent(
  message: string,
  meta: { mentionedAgent?: unknown } = {}
): RoutedAgentId | null {
  const metaAgent = normalizeAgentName(meta.mentionedAgent);
  if (metaAgent) return metaAgent;

  const mentionMatches = message.matchAll(/@([a-z0-9_]+)/gi);
  for (const match of mentionMatches) {
    const token = normalizeAgentName(match[1]);
    if (token) return token;
  }
  return null;
}

/**
 * 멘션이 없을 때 질문 인텐트로 에이전트 라우팅.
 * 일치 항목이 없으면 null (호출부에서 ORCHESTRATOR fallback 처리).
 */
export function inferAgentFromIntent(message: string): RoutedAgentId | null {
  const lower = message.toLowerCase();

  // STRUCTURE — 차트/캔들/패턴/구조
  if (/차트|candle|캔들|패턴|pattern|bos|choch|ob|fvg|support|resist|지지|저항|추세|trend|구조|structure/i.test(lower)) {
    return 'STRUCTURE';
  }
  // DERIV — 파생/펀딩/OI/청산/옵션
  if (/파생|deriv|펀딩|funding|oi|open.?interest|청산|liquid|옵션|option|선물|futures|숏|롱|레버/i.test(lower)) {
    return 'DERIV';
  }
  // VALUATION — 온체인/밸류에이션/MVRV/NUPL
  if (/온체인|on.?chain|mvrv|nupl|sopr|nvt|valuation|밸류|네트워크|network|active.?addr|whale|고래/i.test(lower)) {
    return 'VALUATION';
  }
  // FLOW — 자금흐름/거래소/넷플로우/거래량
  if (/자금|flow|플로우|넷플로우|netflow|거래소|exchange|inflow|outflow|유입|유출|이동/i.test(lower)) {
    return 'FLOW';
  }
  // VPA — 거래량/볼륨/CVD
  if (/거래량|volume|볼륨|cvd|delta|vwap|profile|흡수|absorption/i.test(lower)) {
    return 'VPA';
  }
  // ICT — 스마트머니/유동성/imbalance
  if (/스마트.?머니|smart.?money|ict|유동성|liquid|imbalance|breaker|mitigation/i.test(lower)) {
    return 'ICT';
  }
  // SENTI — 센티멘트/공포/탐욕/소셜
  if (/센티|senti|감정|공포|탐욕|fear|greed|소셜|social|여론|분위기/i.test(lower)) {
    return 'SENTI';
  }
  // MACRO — 매크로/경제/금리/연준
  if (/매크로|macro|경제|금리|interest.?rate|연준|fed|cpi|gdp|달러|dollar|dxy|국채/i.test(lower)) {
    return 'MACRO';
  }
  return null;
}
