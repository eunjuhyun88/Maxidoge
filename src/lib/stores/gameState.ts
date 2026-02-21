// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Game State Store
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';

export type Phase = 'standby' | 'config' | 'deploy' | 'hypothesis' | 'preview' | 'scout' | 'gather' | 'council' | 'verdict' | 'compare' | 'battle' | 'result' | 'cooldown';
export type ViewMode = 'arena' | 'terminal' | 'passport';
export type Direction = 'LONG' | 'SHORT' | 'NEUTRAL';
export type RiskLevel = 'low' | 'mid' | 'aggro';
export type SquadTimeframe = '5m' | '1h' | '4h' | '1D';

export interface SquadConfig {
  riskLevel: RiskLevel;
  timeframe: SquadTimeframe;
  leverageBias: number;    // 1-10
  confidenceWeight: number; // 1-10
}

export interface Position {
  entry: number;
  tp: number;
  sl: number;
  dir: Direction;
  rr: number;
  size: number;
  lev: number;
}

export interface Hypothesis {
  dir: Direction;
  conf: number;
  tags: Set<string>;
  tf: string;
  vmode: 'tpsl' | 'close';
  closeN: number;
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  consensusType?: string;
  lpMult?: number;
}

export interface GameState {
  // Navigation
  currentView: ViewMode;

  // Arena state
  phase: Phase;
  running: boolean;
  matchN: number;
  wins: number;
  losses: number;
  streak: number;
  lp: number;
  score: number;
  timer: number;
  speed: number;
  inLobby: boolean;

  // Match data
  selectedAgents: string[];
  pos: Position | null;
  hypothesis: Hypothesis | null;
  battleResult: string | null;
  battleCandlesSinceEntry: number;
  chartPattern: string | null;

  // Opponent
  opponent: {
    score: number;
    dir: Direction;
    agents: string[];
  } | null;

  // Squad config (v2: team-wide parameters)
  squadConfig: SquadConfig;

  // Pending action (from War Room → Arena)
  pendingAction: { dir: Direction; pair: string } | null;

  // Prices (shared between arena + terminal)
  prices: { BTC: number; ETH: number; SOL: number };
  bases: { BTC: number; ETH: number; SOL: number };
  pair: string;
  timeframe: string;
}

const defaultState: GameState = {
  currentView: 'arena',
  phase: 'standby',
  running: false,
  matchN: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  lp: 2340,
  score: 74,
  timer: 0,
  speed: 3,
  inLobby: true,
  selectedAgents: [],
  pos: null,
  hypothesis: null,
  battleResult: null,
  battleCandlesSinceEntry: 0,
  chartPattern: null,
  opponent: null,
  squadConfig: { riskLevel: 'mid', timeframe: '4h', leverageBias: 5, confidenceWeight: 5 },
  pendingAction: null,
  prices: { BTC: 97420, ETH: 3481, SOL: 198.46 },
  bases: { BTC: 97420, ETH: 3481, SOL: 198.46 },
  pair: 'BTC/USDT',
  timeframe: '4H'
};

// Load from localStorage
function loadState(): GameState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const saved = localStorage.getItem('maxidoge_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState, ...parsed, running: false, phase: 'standby', inLobby: true };
    }
  } catch {}
  return defaultState;
}

export const gameState = writable<GameState>(loadState());

// Auto-save persistent fields to localStorage (debounced to avoid thrashing)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _lastPersist = '';
gameState.subscribe(s => {
  if (typeof window === 'undefined') return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    const persist = {
      matchN: s.matchN,
      wins: s.wins,
      losses: s.losses,
      streak: s.streak,
      lp: s.lp,
      speed: s.speed,
      selectedAgents: s.selectedAgents
    };
    const json = JSON.stringify(persist);
    if (json !== _lastPersist) {
      _lastPersist = json;
      localStorage.setItem('maxidoge_state', json);
    }
  }, 500);
});

// Derived stores for convenience
export const currentView = derived(gameState, $s => $s.currentView);
export const isRunning = derived(gameState, $s => $s.running);
export const currentPhase = derived(gameState, $s => $s.phase);
export const prices = derived(gameState, $s => $s.prices);

// Helpers
export function setView(view: ViewMode) {
  gameState.update(s => ({ ...s, currentView: view }));
}

export function updatePrices() {
  gameState.update(s => {
    const jitter = () => 1 + (Math.random() - 0.5) * 0.0014;
    return {
      ...s,
      prices: {
        BTC: +(s.prices.BTC * jitter()).toFixed(0),
        ETH: +(s.prices.ETH * jitter()).toFixed(0),
        SOL: +(s.prices.SOL * jitter()).toFixed(2)
      }
    };
  });
}
