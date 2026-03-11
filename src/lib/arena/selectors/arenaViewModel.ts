import type {
  ArenaApiSyncStatusDisplay,
  ArenaAgentSummary,
  ArenaBattleHudDisplay,
  ArenaBattlePhaseDisplay,
  ArenaModeDisplay,
  ArenaPhaseTrackStep,
  ArenaPreviewDisplay,
  ArenaResultState,
  ArenaScoreSummary,
} from '../state/arenaTypes';
import type { ArenaMode, Hypothesis, Phase, SquadConfig, TournamentContext } from '$lib/stores/gameState';
import { formatTimeframeLabel } from '$lib/utils/timeframe';

const ARENA_PHASE_TRACK: ReadonlyArray<{ id: Phase; label: string }> = [
  { id: 'DRAFT', label: 'DRAFT' },
  { id: 'ANALYSIS', label: 'SCAN' },
  { id: 'HYPOTHESIS', label: 'HYPO' },
  { id: 'BATTLE', label: 'BATTLE' },
  { id: 'RESULT', label: 'RESULT' },
];

export function buildArenaResultOverlayTitle(mode: ArenaMode, win: boolean): string {
  if (mode === 'TOURNAMENT') {
    return win ? '🏆 TOURNAMENT WIN 🏆' : '☠ TOURNAMENT LOSS ☠';
  }
  if (mode === 'PVP') {
    return win ? '🏆 YOU WIN! 🏆' : '💀 YOU LOSE 💀';
  }
  return win ? '🏁 PVE CLEAR' : '❌ PVE FAILED';
}

export function buildArenaMissionText(hypothesis: Hypothesis | null): string {
  if (!hypothesis) {
    return 'STANDBY — 포지션을 설정하세요';
  }
  return `${hypothesis.dir} R:R 1:${hypothesis.rr?.toFixed(1) || '?'} · TP $${Math.round(hypothesis.tp || 0).toLocaleString()}`;
}

export function buildArenaPhaseTrack(currentPhase: Phase): ArenaPhaseTrackStep[] {
  const currentIndex = ARENA_PHASE_TRACK.findIndex((step) => step.id === currentPhase);

  return ARENA_PHASE_TRACK.map((step, index) => ({
    ...step,
    active: step.id === currentPhase,
    done: step.id === 'DRAFT' ? currentIndex > 0 : index < currentIndex,
  }));
}

export function buildArenaModeDisplay(
  mode: ArenaMode,
  tournament: TournamentContext,
  fallbackPair: string,
): ArenaModeDisplay {
  const roundBadge = mode === 'TOURNAMENT' && tournament.round ? `R${tournament.round}` : null;
  return {
    label: mode,
    roundBadge,
    fullLabel: roundBadge ? `${mode} · ${roundBadge}` : mode,
    tournamentMeta: mode === 'TOURNAMENT' && tournament.tournamentId
      ? `${tournament.type ?? 'TOURNAMENT'} · ${tournament.pair ?? fallbackPair} · ROUND ${tournament.round ?? 1}`
      : null,
  };
}

export function buildArenaScoreSummary(
  score: number,
  agentCount: number,
  matchNumber: number,
): ArenaScoreSummary {
  const directionLabel = score >= 60 ? 'LONG' : 'SHORT';
  return {
    directionLabel,
    directionColor: directionLabel === 'LONG' ? '#00CC88' : '#FF5E7A',
    meta: `${agentCount} agents · M${matchNumber}`,
  };
}

export function buildArenaHypothesisBadge(hypothesis: Hypothesis | null): string | null {
  if (!hypothesis) return null;
  return `${hypothesis.dir} · R:R 1:${hypothesis.rr.toFixed(1)}`;
}

export function buildArenaPreviewDisplay(
  hypothesis: Hypothesis | null,
  squadConfig: SquadConfig,
): ArenaPreviewDisplay | null {
  if (!hypothesis) return null;

  return {
    dirClass: hypothesis.dir === 'SHORT' ? 'short' : hypothesis.dir === 'NEUTRAL' ? 'neutral' : 'long',
    dirIcon: hypothesis.dir === 'SHORT' ? '▼' : hypothesis.dir === 'NEUTRAL' ? '●' : '▲',
    dirLabel: hypothesis.dir,
    entryLabel: formatArenaDollar(hypothesis.entry),
    tpLabel: formatArenaDollar(hypothesis.tp),
    slLabel: formatArenaDollar(hypothesis.sl),
    rrLabel: `1:${hypothesis.rr.toFixed(1)}`,
    configLabel: `${squadConfig.riskLevel.toUpperCase()} · ${formatTimeframeLabel(squadConfig.timeframe)} · Lev ${squadConfig.leverageBias}x`,
    squadConfig,
  };
}

export function buildArenaApiSyncStatus(
  apiError: string | null,
  serverMatchId: string | null,
): ArenaApiSyncStatusDisplay | null {
  if (apiError) {
    return {
      tone: 'error',
      label: '⚠️ Offline mode',
    };
  }

  if (serverMatchId) {
    return {
      tone: 'synced',
      label: '🟢 Synced',
    };
  }

  return null;
}

export function buildArenaBattlePhaseDisplay(
  phaseLabel: { name: string; color: string },
  battlePhaseLabel: string,
  timer: number,
): ArenaBattlePhaseDisplay {
  return {
    color: phaseLabel.color,
    label: battlePhaseLabel || phaseLabel.name,
    timerLabel: timer > 0 ? `${Math.ceil(timer)}s` : null,
  };
}

export function buildArenaBattleHudDisplay(
  currentPrice: number,
  enemyHp: number,
  battleNarration: string,
): ArenaBattleHudDisplay {
  return {
    enemyHpAccent: enemyHp > 50 ? '#ffaa00' : '#ff2d55',
    enemyHpLabel: `${Math.round(enemyHp)}`,
    narration: battleNarration || '에이전트 대기 중...',
    priceLabel: Number.isFinite(currentPrice) ? formatArenaDollar(currentPrice) : '--',
  };
}

export function buildArenaBattleLogPreview<T>(
  messages: ReadonlyArray<T>,
  limit = 5,
): T[] {
  return messages.slice(-limit);
}

export function buildArenaViewAgentSummaries<
  T extends { id: string; name: string; icon: string; color: string; dir: string; conf: number },
>(agents: ReadonlyArray<T>): ArenaAgentSummary[] {
  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    icon: agent.icon,
    color: agent.color,
    dir: agent.dir,
    conf: agent.conf,
  }));
}

export function buildArenaResultStateSeed(): ArenaResultState {
  return {
    win: false,
    lp: 0,
    tag: '',
    motto: '',
    opponentScore: 0,
  };
}

function formatArenaDollar(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}
