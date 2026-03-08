import type { ArenaAgentUiState } from '$lib/arena/controllers/arenaAgentRuntime';
import type { ArenaHypothesisSubmitInput } from '$lib/arena/controllers/arenaPhaseController';
import type { ArenaBattleChatMessage } from '$lib/arena/battle/arenaBattlePresentationRuntime';
import type { ArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
import type { ArenaFloatingWord, ArenaParticle } from '$lib/arena/state/arenaVisualEffectsRuntime';
import type {
  ArenaBattleHudDisplay,
  ArenaBattlePhaseDisplay,
  ArenaModeDisplay,
  ArenaPreviewDisplay,
  ArenaResultState,
  ArenaScoreSummary,
} from '$lib/arena/state/arenaTypes';
import type { AgentDef } from '$lib/data/agents';
import type { BattleTurn, CharSpriteState } from '$lib/engine/arenaCharacters';
import type { FBScore } from '$lib/engine/types';
import type { ArenaChartAnnotation, ArenaChartMarker } from '$lib/arena/adapters/arenaChartBridge';
import type { ArenaMode, Direction, Hypothesis } from '$lib/stores/gameState';

export interface ArenaChartPanelProps {
  showPosition: boolean;
  posEntry: number | null;
  posTp: number | null;
  posSl: number | null;
  posDir: Direction;
  agentAnnotations: ArenaChartAnnotation[];
  agentMarkers: ArenaChartMarker[];
}

export interface ArenaChartRailProps {
  chartPanelProps: ArenaChartPanelProps;
  onDragTP?: (detail: { price: number }) => void;
  onDragSL?: (detail: { price: number }) => void;
  onDragEntry?: (detail: { price: number }) => void;
  hypothesisVisible?: boolean;
  hypothesisTimer?: number;
  onHypothesisSubmit?: (selection: ArenaHypothesisSubmitInput) => void;
  floatDir?: 'LONG' | 'SHORT' | null;
  onSelectFloatDir?: (value: 'LONG' | 'SHORT' | null) => void;
  previewVisible?: boolean;
  previewDisplay?: ArenaPreviewDisplay | null;
  onConfirmPreview?: () => void;
  score?: number;
  scoreSummary?: ArenaScoreSummary;
  streak?: number;
  wins?: number;
  losses?: number;
  lp?: number;
  arenaMode?: ArenaMode;
  arenaModeDisplay?: ArenaModeDisplay;
  hypothesisBadge?: string | null;
  hypothesisDir?: Direction | null;
  showMarkers?: boolean;
  onToggleMarkers?: () => void;
  onTogglePositionVisibility?: () => void;
  onGoLobby?: () => void;
}

export interface ArenaBattleSidebarProps {
  missionText?: string;
  battlePhaseDisplay?: ArenaBattlePhaseDisplay;
  vsMeter?: number;
  enemyHp?: number;
  battleHudDisplay?: ArenaBattleHudDisplay;
  arenaParticles?: ArenaParticle[];
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
  floatingWords?: ArenaFloatingWord[];
}
