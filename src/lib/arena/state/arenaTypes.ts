import type {
  ArenaMode,
  Hypothesis,
  Phase,
  SquadConfig,
  TournamentContext,
} from '$lib/stores/gameState';

export interface ArenaResultState {
  win: boolean;
  lp: number;
  tag: string;
  motto: string;
  opponentScore: number;
}

export interface ArenaPhaseTrackStep {
  id: Phase;
  label: string;
  active: boolean;
  done: boolean;
}

export interface ArenaModeDisplay {
  label: ArenaMode;
  roundBadge: string | null;
  fullLabel: string;
  tournamentMeta: string | null;
}

export interface ArenaScoreSummary {
  directionLabel: 'LONG' | 'SHORT';
  directionColor: string;
  meta: string;
}

export interface ArenaAgentSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
  dir: string;
  conf: number;
}

export interface ArenaDisplayContext {
  mode: ArenaMode;
  tournament: TournamentContext;
  hypothesis: Hypothesis | null;
  phase: Phase;
}

export interface ArenaPreviewDisplay {
  dirClass: 'long' | 'short' | 'neutral';
  dirIcon: '▲' | '▼' | '●';
  dirLabel: string;
  entryLabel: string;
  tpLabel: string;
  slLabel: string;
  rrLabel: string;
  configLabel: string;
  squadConfig: SquadConfig;
}

export interface ArenaApiSyncStatusDisplay {
  tone: 'error' | 'synced';
  label: string;
}

export interface ArenaBattlePhaseDisplay {
  label: string;
  color: string;
  timerLabel: string | null;
}

export interface ArenaBattleHudDisplay {
  enemyHpAccent: string;
  enemyHpLabel: string;
  narration: string;
  priceLabel: string;
}
