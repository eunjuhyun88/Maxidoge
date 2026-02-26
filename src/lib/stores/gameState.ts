// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Game State Store
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import type { CanonicalTimeframe } from '$lib/utils/timeframe';
import type { OrpoOutput, CtxBelief, CommanderVerdict, GuardianCheck, FBScore } from '$lib/engine/types';
import { normalizeTimeframe } from '$lib/utils/timeframe';
import { STORAGE_KEYS } from './storageKeys';
import { getLivePriceSnapshot } from './priceStore';

export type Phase = 'DRAFT' | 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE' | 'RESULT';
export type ViewMode = 'arena' | 'terminal' | 'passport';
export type Direction = 'LONG' | 'SHORT' | 'NEUTRAL';
export type RiskLevel = 'low' | 'mid' | 'aggro';
export type SquadTimeframe = CanonicalTimeframe;
export type ArenaMode = 'PVE' | 'PVP' | 'TOURNAMENT';

export interface TournamentContext {
  tournamentId: string | null;
  round: number | null;
  type: string | null;
  pair: string | null;
  entryFeeLp: number | null;
}

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
  arenaMode: ArenaMode;
  tournament: TournamentContext;
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

  // C02 Architecture outputs
  orpoOutput: OrpoOutput | null;
  ctxBeliefs: CtxBelief[];
  commanderVerdict: CommanderVerdict | null;
  guardianCheck: GuardianCheck | null;
  fbScore: FBScore | null;

  // Squad config (v2: team-wide parameters)
  squadConfig: SquadConfig;

  // Pending action (from War Room → Arena)
  pendingAction: { dir: Direction; pair: string } | null;

  // Prices (shared between arena + terminal)
  prices: { BTC: number; ETH: number; SOL: number };
  bases: { BTC: number; ETH: number; SOL: number };
  pair: string;
  timeframe: CanonicalTimeframe;
}

const defaultState: GameState = {
  currentView: 'arena',
  arenaMode: 'PVE',
  tournament: {
    tournamentId: null,
    round: null,
    type: null,
    pair: null,
    entryFeeLp: null,
  },
  phase: 'DRAFT',
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
  orpoOutput: null,
  ctxBeliefs: [],
  commanderVerdict: null,
  guardianCheck: null,
  fbScore: null,
  squadConfig: { riskLevel: 'mid', timeframe: '4h', leverageBias: 5, confidenceWeight: 5 },
  pendingAction: null,
  prices: { BTC: 97420, ETH: 3481, SOL: 198.46 },
  bases: { BTC: 97420, ETH: 3481, SOL: 198.46 },
  pair: 'BTC/USDT',
  timeframe: '4h'
};

// Load from localStorage
function loadState(): GameState {
  if (typeof window === 'undefined') return defaultState;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.gameState);
    if (saved) {
      const parsed = JSON.parse(saved);
      const squadConfig = parsed?.squadConfig
        ? { ...defaultState.squadConfig, ...parsed.squadConfig, timeframe: normalizeTimeframe(parsed.squadConfig.timeframe) }
        : defaultState.squadConfig;

      return {
        ...defaultState,
        ...parsed,
        arenaMode: parsed?.arenaMode === 'PVP' || parsed?.arenaMode === 'TOURNAMENT' ? parsed.arenaMode : 'PVE',
        tournament: {
          ...defaultState.tournament,
          ...(parsed?.tournament ?? {}),
        },
        squadConfig,
        timeframe: normalizeTimeframe(parsed?.timeframe),
        running: false,
        phase: 'DRAFT',
        inLobby: true
      };
    }
  } catch {}
  return defaultState;
}

export const gameState = writable<GameState>(loadState());

// S-03 이후 가격 동기화는 layout/chart 측 경로에서 수행한다.
// gameState.prices는 레거시 호환 필드로 유지한다.

// Auto-save persistent fields to localStorage (debounced — prices excluded intentionally)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _lastPersist = '';
gameState.subscribe(s => {
  if (typeof window === 'undefined') return;
  // Build persist object (excludes prices, phase, running, pos — transient fields)
  const persist = {
    arenaMode: s.arenaMode,
    tournament: s.tournament,
    matchN: s.matchN,
    wins: s.wins,
    losses: s.losses,
    streak: s.streak,
    lp: s.lp,
    speed: s.speed,
    selectedAgents: s.selectedAgents,
    pair: s.pair,
    timeframe: s.timeframe,
    squadConfig: s.squadConfig
  };
  const json = JSON.stringify(persist);
  // Skip if nothing changed
  if (json === _lastPersist) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _lastPersist = json;
    localStorage.setItem(STORAGE_KEYS.gameState, json);
  }, 1000);
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

/**
 * @deprecated S-03: 랜덤 지터를 제거하고 livePrice 스냅샷을 사용한다.
 * 레거시 호출 호환을 위해 유지하되, 실제 가격 소스는 priceStore다.
 */
export function updatePrices() {
  const snap = getLivePriceSnapshot(['BTC', 'ETH', 'SOL']);
  gameState.update(s => {
    const nextBtc = snap.BTC?.price ?? s.prices.BTC;
    const nextEth = snap.ETH?.price ?? s.prices.ETH;
    const nextSol = snap.SOL?.price ?? s.prices.SOL;
    if (nextBtc === s.prices.BTC && nextEth === s.prices.ETH && nextSol === s.prices.SOL) return s;

    return {
      ...s,
      prices: {
        BTC: nextBtc,
        ETH: nextEth,
        SOL: nextSol
      }
    };
  });
}
