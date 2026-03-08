// ═══ Arena Character State Machine & Battle Turn Types ═══
// Extracted from arena/+page.svelte for reuse and testability

import type { AGDEFS } from '$lib/data/agents';

// 9-state character state machine
export type CharState = 'idle' | 'patrol' | 'lock' | 'windup' | 'cast' | 'impact' | 'recover' | 'celebrate' | 'panic';

// 8 action types
export type ActionType = 'dash' | 'ping' | 'shield' | 'burst' | 'hook' | 'taunt' | 'assist' | 'finisher';

export interface CharAction {
  type: ActionType;
  label: string;
  emoji: string;
  duration: number; // ms for cast animation
  shakeLevel: 'light' | 'medium' | 'heavy';
  flashColor: 'white' | 'green' | 'red' | 'gold';
}

export const ACTION_CATALOG: Record<ActionType, CharAction> = {
  dash:     { type: 'dash',     label: '돌진!',     emoji: '💨', duration: 400,  shakeLevel: 'light',  flashColor: 'white' },
  ping:     { type: 'ping',     label: '핑!',       emoji: '📡', duration: 300,  shakeLevel: 'light',  flashColor: 'white' },
  shield:   { type: 'shield',   label: '방어!',     emoji: '🛡️', duration: 600,  shakeLevel: 'light',  flashColor: 'green' },
  burst:    { type: 'burst',    label: '폭발!',     emoji: '💥', duration: 500,  shakeLevel: 'medium', flashColor: 'gold' },
  hook:     { type: 'hook',     label: '훅!',       emoji: '🪝', duration: 450,  shakeLevel: 'medium', flashColor: 'red' },
  taunt:    { type: 'taunt',    label: '도발!',     emoji: '😤', duration: 350,  shakeLevel: 'light',  flashColor: 'white' },
  assist:   { type: 'assist',   label: '지원!',     emoji: '✨', duration: 500,  shakeLevel: 'light',  flashColor: 'green' },
  finisher: { type: 'finisher', label: '필살기!',   emoji: '⚡', duration: 800,  shakeLevel: 'heavy',  flashColor: 'gold' },
};

// Per-character role → preferred actions
export const CHAR_ACTIONS: Record<string, ActionType[]> = {
  STRUCTURE: ['dash', 'shield', 'burst', 'finisher'],
  ICT:       ['hook', 'shield', 'taunt', 'finisher'],
  VPA:       ['burst', 'dash', 'assist', 'finisher'],
  FLOW:      ['ping', 'dash', 'assist', 'finisher'],
  MACRO:     ['shield', 'assist', 'burst', 'finisher'],
  DERIV:     ['burst', 'hook', 'dash', 'finisher'],
  SENTI:     ['taunt', 'ping', 'assist', 'finisher'],
  VALUATION: ['ping', 'shield', 'burst', 'finisher'],
};

export interface CharSpriteState {
  charState: CharState;
  x: number;       // % position in arena
  y: number;       // % position in arena
  targetX: number;
  targetY: number;
  actionEmoji: string;
  actionLabel: string;
  flipX: boolean;
  hp: number;       // 0-100
  energy: number;   // 0-100
  showHit: boolean;
  hitText: string;
  hitColor: string;
}

export type AgentDef = (typeof AGDEFS)[number];

export interface BattleTurn {
  agent: AgentDef;
  attackName: string;
  action: ActionType;
  effectiveness: 'super' | 'normal' | 'weak';
  isCritical: boolean;
  meterShift: number;
  dirSign: number;
  damage: number;
}

export const ATTACK_NAMES: Record<string, string> = {
  STRUCTURE: '차트 분석', VPA: '거래량 델타', ICT: '유동성 스윕',
  DERIV: '파생 분석', FLOW: '고래 추적', SENTI: '소셜 스캔',
  MACRO: '매크로 분석', VALUATION: '온체인 밸류'
};

export const ATTACK_SUPER: Record<string, string> = {
  STRUCTURE: '강세 브레이크아웃!', VPA: '거래량 폭발!', ICT: '스마트머니 포착!',
  DERIV: 'OI 급증!', FLOW: '대형 매수!', SENTI: '분위기 폭등!',
  MACRO: '글로벌 확인!', VALUATION: '저평가 발견!'
};

export const ATTACK_WEAK: Record<string, string> = {
  STRUCTURE: '패턴 불분명...', VPA: '거래량 약세...', ICT: '유동성 부족...',
  DERIV: '데이터 혼재...', FLOW: '흐름 불확실...', SENTI: '분위기 혼조...',
  MACRO: '신호 약함...', VALUATION: '밸류 중립...'
};

// Bridge: legacy agent state → char sprite state mapping
export const AGENT_TO_CHAR_STATE: Record<string, CharState> = {
  idle: 'idle', walk: 'patrol', think: 'lock', alert: 'lock',
  charge: 'windup', vote: 'cast', jump: 'celebrate', sad: 'panic',
};

/** Calculate circular formation position for agent index */
export function getFormPos(idx: number, total: number): { x: number; y: number } {
  if (total <= 0) return { x: 50, y: 50 };
  const angle = ((idx / total) * 360 - 90) * (Math.PI / 180);
  return {
    x: 50 + Math.cos(angle) * 30,
    y: 50 + Math.sin(angle) * 34
  };
}

/** Create initial sprite state for all agents in circular formation */
export function createInitialSprites(agents: AgentDef[]): Record<string, CharSpriteState> {
  const sprites: Record<string, CharSpriteState> = {};
  agents.forEach((ag, i) => {
    const pos = getFormPos(i, agents.length);
    sprites[ag.id] = {
      charState: 'idle',
      x: pos.x, y: pos.y,
      targetX: pos.x, targetY: pos.y,
      actionEmoji: '', actionLabel: '',
      flipX: pos.x > 50,
      hp: 100, energy: 0,
      showHit: false, hitText: '', hitColor: '',
    };
  });
  return sprites;
}

/** Schedule battle turns for all active agents */
export function scheduleBattleTurns(activeAgents: AgentDef[]): BattleTurn[] {
  const lastActions: Record<string, ActionType> = {};
  return activeAgents.map(ag => {
    const r = Math.random();
    const eff: 'super' | 'normal' | 'weak' = r < 0.2 ? 'super' : r > 0.8 ? 'weak' : 'normal';
    const crit = Math.random() < 0.12;
    // Pick action from character's repertoire (anti-repetition)
    const pool = CHAR_ACTIONS[ag.id] || ['burst', 'dash', 'shield', 'finisher'];
    let action: ActionType;
    if (crit || eff === 'super') {
      action = 'finisher'; // Big moments → finisher
    } else {
      const filtered = pool.filter(a => a !== lastActions[ag.id] && a !== 'finisher');
      action = filtered[Math.floor(Math.random() * filtered.length)] || pool[0];
    }
    lastActions[ag.id] = action;
    const eMult = eff === 'super' ? 1.5 : eff === 'weak' ? 0.5 : 1.0;
    const cMult = crit ? 2.0 : 1.0;
    const ds = ag.dir === 'LONG' ? 1 : -1;
    const baseDamage = (eff === 'super' ? 18 : eff === 'weak' ? 5 : 10) * cMult;
    return {
      agent: ag, attackName: ATTACK_NAMES[ag.id] || '분석',
      action, effectiveness: eff, isCritical: crit,
      meterShift: ag.conf * 0.3 * ds * eMult * cMult,
      dirSign: ds, damage: baseDamage,
    };
  });
}
