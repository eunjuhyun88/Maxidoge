<script lang="ts">
  import ArenaBattleMissionBar from './ArenaBattleMissionBar.svelte';
  import ArenaBattleCombatHud from './ArenaBattleCombatHud.svelte';
  import ArenaBattleNarrationLog from './ArenaBattleNarrationLog.svelte';
  import type {
    ArenaBattleHudDisplay,
    ArenaBattlePhaseDisplay,
    ArenaModeDisplay,
    ArenaResultState,
  } from '$lib/arena/state/arenaTypes';
  import type { ArenaBattleChatMessage } from '$lib/arena/battle/arenaBattlePresentationRuntime';
  import type { ArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
  import type { ArenaAgentUiState } from '$lib/arena/controllers/arenaAgentRuntime';
  import type { AgentDef } from '$lib/data/agents';
  import type { BattleTurn, CharSpriteState } from '$lib/engine/arenaCharacters';
  import type { FBScore } from '$lib/engine/types';
  import type { Hypothesis } from '$lib/stores/gameState';

  interface Props {
    missionText?: string;
    battlePhaseDisplay?: ArenaBattlePhaseDisplay;
    vsMeter?: number;
    enemyHp?: number;
    battleHudDisplay?: ArenaBattleHudDisplay;
    arenaParticles?: Array<{ id: number; x: number; y: number; size: number; speed: number; opacity: number }>;
    activeAgents?: AgentDef[];
    charSprites?: Record<string, CharSpriteState>;
    currentTurnIdx?: number;
    battleTurns?: BattleTurn[];
    agentStates?: Record<string, ArenaAgentUiState>;
    showVsSplash?: boolean;
    showCritical?: boolean;
    criticalText?: string;
    showCombo?: boolean;
    comboCount?: number;
    battleLogPreview?: Array<ArenaBattleChatMessage & { id: number }>;
    battleLogCount?: number;
    rewardState?: ArenaRewardState;
    onCloseReward?: () => void;
    resultVisible?: boolean;
    resultData?: ArenaResultState;
    streak?: number;
    fbScore?: FBScore | null;
    pvpVisible?: boolean;
    resultOverlayTitle?: string;
    arenaModeDisplay?: ArenaModeDisplay;
    score?: number;
    hypothesis?: Hypothesis | null;
    onGoLobby?: () => void;
    onPlayAgain?: () => void;
    floatingWords?: Array<{ id: number; text: string; color: string; x: number; dur: number }>;
  }

  let {
    missionText = '',
    battlePhaseDisplay = { label: 'STANDBY', color: '#ffffff', timerLabel: null },
    vsMeter = 50,
    enemyHp = 100,
    battleHudDisplay = { enemyHpAccent: '#ff2d55', enemyHpLabel: '100', narration: '에이전트 대기 중...', priceLabel: '--' },
    arenaParticles = [],
    activeAgents = [],
    charSprites = {},
    currentTurnIdx = -1,
    battleTurns = [],
    agentStates = {},
    showVsSplash = false,
    showCritical = false,
    criticalText = '',
    showCombo = false,
    comboCount = 0,
    battleLogPreview = [],
    battleLogCount = 0,
    rewardState = { visible: false, xpGain: 0, streak: 0, badges: [] },
    onCloseReward = () => {},
    resultVisible = false,
    resultData = { win: false, lp: 0, tag: '', motto: '', opponentScore: 0 },
    streak = 0,
    fbScore = null,
    pvpVisible = false,
    resultOverlayTitle = '',
    arenaModeDisplay = { label: 'PVE', roundBadge: null, fullLabel: 'PVE', tournamentMeta: null },
    score = 0,
    hypothesis = null,
    onGoLobby = () => {},
    onPlayAgain = () => {},
    floatingWords = [],
  }: Props = $props();

  const arenaBattleStageSurfaceModule = import('./ArenaBattleStageSurface.svelte');
  const arenaBattleOutcomeOverlayModule = import('./ArenaBattleOutcomeOverlay.svelte');

</script>

<div class="arena-sidebar">
  <ArenaBattleMissionBar {missionText} {battlePhaseDisplay} {onGoLobby} />

  <ArenaBattleCombatHud {vsMeter} {enemyHp} {battleHudDisplay} />

  {#await arenaBattleStageSurfaceModule then arenaBattleStageSurfaceNs}
    {@const ArenaBattleStageSurface = arenaBattleStageSurfaceNs.default}
    <ArenaBattleStageSurface
      {battleHudDisplay}
      {arenaParticles}
      {activeAgents}
      {charSprites}
      {currentTurnIdx}
      {battleTurns}
      {agentStates}
      {showVsSplash}
      {showCritical}
      {criticalText}
      {showCombo}
      {comboCount}
    />
  {/await}

  <ArenaBattleNarrationLog {battleHudDisplay} {battleLogPreview} {battleLogCount} />

  {#await arenaBattleOutcomeOverlayModule then arenaBattleOutcomeOverlayNs}
    {@const ArenaBattleOutcomeOverlay = arenaBattleOutcomeOverlayNs.default}
    <ArenaBattleOutcomeOverlay
      {rewardState}
      {onCloseReward}
      {resultVisible}
      {resultData}
      {streak}
      {fbScore}
      {pvpVisible}
      {resultOverlayTitle}
      {arenaModeDisplay}
      {score}
      {hypothesis}
      {onGoLobby}
      {onPlayAgain}
      {floatingWords}
    />
  {/await}
</div>

<style>
  .arena-sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: linear-gradient(180deg, #0a0a12 0%, #0d0a14 50%, #0a0a12 100%);
    border-left: 1px solid rgba(255,105,180,.15);
  }
</style>
