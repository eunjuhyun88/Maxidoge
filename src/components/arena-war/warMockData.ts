// ═══════════════════════════════════════════════════════════════
// Arena War — Mock Data for Prototype
// ═══════════════════════════════════════════════════════════════

import type { Direction } from '$lib/engine/types';

export type WarPhase =
  | 'SETUP'
  | 'AI_ANALYZE'
  | 'HUMAN_CALL'
  | 'REVEAL'
  | 'BATTLE'
  | 'JUDGE'
  | 'RESULT';

export const WAR_PHASES: WarPhase[] = [
  'SETUP', 'AI_ANALYZE', 'HUMAN_CALL', 'REVEAL', 'BATTLE', 'JUDGE', 'RESULT'
];

export const WAR_PHASE_DURATION: Record<WarPhase, number> = {
  SETUP: 0,        // user-controlled
  AI_ANALYZE: 8,   // 8 seconds
  HUMAN_CALL: 45,  // 45 seconds
  REVEAL: 5,       // 5 seconds
  BATTLE: 120,     // 2 minutes (24 candles × 5s)
  JUDGE: 4,        // 4 seconds
  RESULT: 0,       // user-controlled
};

// ─── AI Rival System ─────────────────────────────────────────

export interface AIRival {
  id: string;
  name: string;
  tier: string;
  icon: string;
  factorCount: number;
  taunts: {
    greet: string[];
    consensus: string[];
    dissent: string[];
    playerWin: string[];
    playerLose: string[];
    streak3: string[];
    streak5: string[];
    losing3: string[];
  };
}

export const AI_RIVALS: Record<string, AIRival> = {
  'ORPO-3': {
    id: 'ORPO-3', name: 'Rookie', tier: 'BRONZE', icon: '🤖',
    factorCount: 12,
    taunts: {
      greet: ['안녕하세요! 분석 준비 완료!', '좋은 연습 상대가 되겠습니다.'],
      consensus: ['같은 판단이네요!', '우리 생각이 같아요.'],
      dissent: ['다른 의견이시군요...', '흥미로운 판단이네요.'],
      playerWin: ['잘했어요! 다음엔 저도 더 노력할게요.', '좋은 분석이었어요!'],
      playerLose: ['이번엔 제가 이겼네요.', '다시 도전해보세요!'],
      streak3: ['3연승... 대단해요!', '실력이 있으시네요.'],
      streak5: ['5연승! 다음 레벨로 가셔야 할 것 같아요.'],
      losing3: ['힘내세요! 누구나 안 풀리는 날이 있어요.'],
    }
  },
  'ORPO-5': {
    id: 'ORPO-5', name: 'Analyst', tier: 'SILVER', icon: '🧠',
    factorCount: 24,
    taunts: {
      greet: ['24개 팩터 분석 시작합니다.', '준비되셨나요?'],
      consensus: ['같은 결론이군요. 데이터가 명확하니까.', '이건 쉬운 판이었어요.'],
      dissent: ['데이터와 반대로 가시는군요.', '흥미로운... 근거가 있으신 거겠죠?'],
      playerWin: ['좋은 판단이었습니다.', '...다음엔 다를 거예요.'],
      playerLose: ['데이터는 거짓말을 하지 않습니다.', '분석대로였죠.'],
      streak3: ['3연승... 실력인가, 운인가?'],
      streak5: ['5연승. 인정합니다. 하지만...'],
      losing3: ['전략을 바꿔보시는 건 어떨까요?'],
    }
  },
  'ORPO-7': {
    id: 'ORPO-7', name: 'Seven', tier: 'GOLD', icon: '👁️',
    factorCount: 48,
    taunts: {
      greet: ['48개 팩터를 0.3초에 분석합니다. 당신의 직감은 몇 초 걸리죠?', '또 오셨군요.'],
      consensus: ['이번엔 운이 좋았군요. 같은 판단이라니.', '쉬운 장이니까요.'],
      dissent: ['틀렸어요. 데이터가 증명합니다.', '감(感)으로 가시는 건가요?'],
      playerWin: ['...흥미롭군요. 다시.', '인간의 직감을 과소평가했나.'],
      playerLose: ['예상대로입니다.', '데이터 앞에 겸손하세요.'],
      streak3: ['3연승... 패턴이 보이기 시작합니다.'],
      streak5: ['...인정합니다. 이번만.'],
      losing3: ['아직도 도전하시나요?', '포기도 전략입니다.'],
    }
  },
  'ORPO-X': {
    id: 'ORPO-X', name: 'X', tier: 'DIAMOND', icon: '💀',
    factorCount: 48,
    taunts: {
      greet: ['당신의 패턴을 학습했습니다.', '이번에도 예측 가능합니다.'],
      consensus: ['당연한 결론입니다.'],
      dissent: ['실수하고 계십니다.', '데이터와 경험 모두 반대입니다.'],
      playerWin: ['...', '에러율 내입니다.'],
      playerLose: ['확인 완료.', '다시 오실 건가요?'],
      streak3: ['통계적 변동일 뿐입니다.'],
      streak5: ['...재보정이 필요합니다.'],
      losing3: ['패턴이 고착되고 있습니다.'],
    }
  },
};

export function getAIRival(tier: string): AIRival {
  const map: Record<string, string> = {
    BRONZE: 'ORPO-3', SILVER: 'ORPO-5', GOLD: 'ORPO-7', DIAMOND: 'ORPO-X'
  };
  return AI_RIVALS[map[tier] ?? 'ORPO-7'];
}

export function getRandomTaunt(rival: AIRival, category: keyof AIRival['taunts']): string {
  const arr = rival.taunts[category];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Advantage Cards ─────────────────────────────────────────

export interface AdvantageCard {
  id: string;
  name: string;
  icon: string;
  color: string;
  content: string;
  hint: string;
}

const CARD_POOL: AdvantageCard[] = [
  { id: 'news', name: 'NEWS FLASH', icon: '📰', color: '#ff9b7f', content: '2시간 전 BTC ETF 순유입 $450M 기록', hint: 'AI는 이 뉴스를 반영하지 못합니다.' },
  { id: 'whale', name: 'WHALE ALERT', icon: '🐋', color: '#66cce6', content: '1시간 내 1000+ BTC 지갑 3개가 거래소로 이동', hint: 'AI의 FLOW 에이전트는 이 수준의 세부 데이터가 없습니다.' },
  { id: 'sentiment', name: 'SENTIMENT PULSE', icon: '💬', color: '#8b5cf6', content: '소셜 미디어 불안 지수 급등 (+42%)', hint: 'AI의 SENTI 에이전트는 집계만 봅니다.' },
  { id: 'funding', name: 'FUNDING RATE', icon: '💰', color: '#00cc88', content: '펀딩레이트 0.08% → 0.02%로 급감', hint: '레버리지 포지션이 정리되고 있습니다.' },
  { id: 'liquidation', name: 'LIQUIDATION MAP', icon: '💥', color: '#ff5e7a', content: '$96,200에 $1.2B 롱 청산 집중', hint: '가격이 이 수준에 닿으면 폭포 가능.' },
  { id: 'orderflow', name: 'ORDER FLOW', icon: '📊', color: '#dcb970', content: '최근 30분 대형 매수 주문 $85M', hint: '기관 매수가 감지되고 있습니다.' },
  { id: 'regime', name: 'REGIME SHIFT', icon: '🔄', color: '#e8967d', content: '변동성 레짐: ranging → trending 전환 감지', hint: 'AI는 레짐 전환에 1-2캔들 느립니다.' },
  { id: 'correlation', name: 'CORRELATION BREAK', icon: '🔗', color: '#a78bfa', content: 'BTC-ETH 상관관계 0.95 → 0.62로 이탈', hint: '디커플링 신호는 AI가 잘 못 잡습니다.' },
  { id: 'insider', name: 'INSIDER HINT', icon: '🔍', color: '#00e68a', content: 'STRUCTURE 에이전트 상세: EMA_TREND=+72, BREAKOUT=+45', hint: 'AI 에이전트 1개의 내부 팩터를 공개합니다.' },
  { id: 'wild', name: 'WILD CARD', icon: '🃏', color: '#ffd060', content: '랜덤 정보가 공개됩니다...', hint: '어떤 정보가 나올지 모릅니다!' },
];

export function drawAdvantageCards(count = 2): AdvantageCard[] {
  const shuffled = [...CARD_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Mock Battle Data ────────────────────────────────────────

export interface MockCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function generateMockCandles(entry: number, direction: Direction, count = 24): MockCandle[] {
  const candles: MockCandle[] = [];
  let price = entry;
  const now = Math.floor(Date.now() / 1000);
  const drift = direction === 'LONG' ? 0.0008 : direction === 'SHORT' ? -0.0008 : 0;

  for (let i = 0; i < count; i++) {
    const volatility = 0.003 + Math.random() * 0.005;
    const change = drift + (Math.random() - 0.5) * volatility;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.002);
    const low = Math.min(open, close) * (1 - Math.random() * 0.002);
    candles.push({
      time: now + i * 300,
      open, high, low, close,
      volume: 100 + Math.random() * 500,
    });
    price = close;
  }
  return candles;
}

// ─── Mock AI Decision ────────────────────────────────────────

export interface MockAIDecision {
  direction: Direction;
  confidence: number;
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  topFactors: { name: string; icon: string; value: number }[];
  orpoHints: { agentId: string; icon: string; confidence: number }[];
  ctxFlags: { agentId: string; icon: string; flag: 'RED' | 'GREEN' | 'NEUTRAL' }[];
  guardianWarns: string[];
}

export function generateMockAIDecision(pair: string): MockAIDecision {
  const isLong = Math.random() > 0.45;
  const dir: Direction = isLong ? 'LONG' : 'SHORT';
  const basePrice = pair.includes('BTC') ? 97450 : pair.includes('ETH') ? 3420 : 195;
  const entry = basePrice * (1 + (Math.random() - 0.5) * 0.005);
  const spread = basePrice * 0.018;

  return {
    direction: dir,
    confidence: 65 + Math.floor(Math.random() * 25),
    entry: Math.round(entry * 10) / 10,
    tp: Math.round((isLong ? entry + spread : entry - spread) * 10) / 10,
    sl: Math.round((isLong ? entry - spread * 0.6 : entry + spread * 0.6) * 10) / 10,
    rr: +(spread / (spread * 0.6)).toFixed(2),
    topFactors: [
      { name: 'EMA_TREND', icon: '📊', value: isLong ? 68 : -62 },
      { name: 'CVD_TREND', icon: '📈', value: isLong ? 45 : -38 },
      { name: 'ORDER_BLOCK', icon: '⚡', value: isLong ? 32 : -41 },
    ],
    orpoHints: [
      { agentId: 'STRUCTURE', icon: '📊', confidence: 65 + Math.floor(Math.random() * 25) },
      { agentId: 'VPA', icon: '📈', confidence: 40 + Math.floor(Math.random() * 35) },
      { agentId: 'ICT', icon: '⚡', confidence: 55 + Math.floor(Math.random() * 30) },
    ],
    ctxFlags: [
      { agentId: 'DERIV', icon: '💰', flag: Math.random() > 0.4 ? 'GREEN' : 'RED' },
      { agentId: 'FLOW', icon: '🐋', flag: Math.random() > 0.5 ? 'GREEN' : Math.random() > 0.5 ? 'RED' : 'NEUTRAL' },
      { agentId: 'SENTI', icon: '🧠', flag: Math.random() > 0.5 ? 'GREEN' : 'NEUTRAL' },
      { agentId: 'MACRO', icon: '🌍', flag: Math.random() > 0.6 ? 'GREEN' : 'RED' },
    ],
    guardianWarns: Math.random() > 0.6 ? ['RSI_OVERBOUGHT'] : [],
  };
}

// ─── FBS Mock ────────────────────────────────────────────────

export interface MockFBS {
  ds: number;
  re: number;
  ci: number;
  fbs: number;
}

export function generateMockFBS(won: boolean): MockFBS {
  const base = won ? 65 : 50;
  const ds = base + Math.floor(Math.random() * 25);
  const re = base - 5 + Math.floor(Math.random() * 25);
  const ci = base + Math.floor(Math.random() * 20);
  const fbs = Math.round(0.5 * ds + 0.3 * re + 0.2 * ci);
  return { ds, re, ci, fbs };
}

// ─── Badge System ────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  icon: string;
  category: 'combat' | 'mastery' | 'market' | 'season' | 'secret';
  condition: string;
  unlocked: boolean;
}

export const MOCK_BADGES: Badge[] = [
  { id: 'first_blood', name: 'First Blood', icon: '🩸', category: 'combat', condition: '첫 승리', unlocked: true },
  { id: 'ai_slayer', name: 'AI Slayer', icon: '🏆', category: 'combat', condition: '5연승', unlocked: false },
  { id: 'dissent_king', name: 'DISSENT King', icon: '👑', category: 'combat', condition: 'DISSENT WIN 10회', unlocked: false },
  { id: 'calibrated', name: 'Calibrated', icon: '🎯', category: 'mastery', condition: 'CI ≥ 90', unlocked: true },
  { id: 'risk_master', name: 'Risk Master', icon: '🛡️', category: 'mastery', condition: 'RE ≥ 85', unlocked: false },
  { id: 'triple_crown', name: 'Triple Crown', icon: '👑', category: 'mastery', condition: 'DS+RE+CI 모두 80+', unlocked: false },
  { id: 'bull_rider', name: 'Bull Rider', icon: '📈', category: 'market', condition: '상승장 5연승', unlocked: true },
  { id: 'bear_catcher', name: 'Bear Catcher', icon: '📉', category: 'market', condition: '하락장 승리', unlocked: false },
  { id: 's1_participant', name: 'S1 Participant', icon: '⭐', category: 'season', condition: 'Season 1 참가', unlocked: true },
];

// ─── Bonus Spin ──────────────────────────────────────────────

export interface SpinResult {
  tier: 'none' | 'nice' | 'great' | 'perfect' | 'jackpot';
  lp: number;
  label: string;
}

export function rollBonusSpin(): SpinResult {
  const roll = Math.random() * 100;
  if (roll < 60) return { tier: 'none', lp: 0, label: '' };
  if (roll < 85) return { tier: 'nice', lp: 3 + Math.floor(Math.random() * 3), label: 'Nice!' };
  if (roll < 95) return { tier: 'great', lp: 10 + Math.floor(Math.random() * 6), label: 'GREAT CALL!' };
  if (roll < 99) return { tier: 'perfect', lp: 25, label: 'PERFECT READ!' };
  return { tier: 'jackpot', lp: 50, label: 'JACKPOT!' };
}

// ─── News Events (for Battle Phase) ─────────────────────────

export interface NewsEvent {
  icon: string;
  title: string;
  content: string;
  bullish: boolean;
}

const NEWS_POOL: NewsEvent[] = [
  { icon: '📰', title: 'ETF INFLOW', content: 'BTC 현물 ETF $380M 순유입 확인', bullish: true },
  { icon: '🐋', title: 'WHALE MOVE', content: '대형 거래소에서 BTC 대량 출금 감지', bullish: true },
  { icon: '⚠️', title: 'REGULATION', content: '규제 강화 뉴스 발표 임박', bullish: false },
  { icon: '💰', title: 'STABLECOIN', content: 'USDT 민팅 $500M 감지', bullish: true },
  { icon: '🔴', title: 'HACK ALERT', content: 'DeFi 프로토콜 해킹 $50M 유출', bullish: false },
  { icon: '🟢', title: 'ADOPTION', content: '대형 기관 BTC 추가 매수 발표', bullish: true },
  { icon: '💥', title: 'LIQUIDATION', content: '$200M 규모 롱 청산 대기 감지', bullish: false },
  { icon: '📊', title: 'OPTIONS', content: '대규모 BTC 콜옵션 매수 감지', bullish: true },
];

export function getRandomNewsEvent(): NewsEvent | null {
  if (Math.random() > 0.4) return null; // 40% chance
  return NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)];
}
