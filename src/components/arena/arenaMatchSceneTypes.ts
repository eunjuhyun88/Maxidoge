import type {
  ArenaAgentSummary,
  ArenaApiSyncStatusDisplay,
  ArenaModeDisplay,
  ArenaPhaseTrackStep,
} from '$lib/arena/state/arenaTypes';
import type { BattlePriceTick, BattleTickState } from '$lib/engine/battleResolver';
import type { FBScore } from '$lib/engine/types';
import type { ArenaBattleSidebarProps, ArenaChartRailProps } from './arenaBattleLayoutTypes';
import type { ArenaMode, ArenaView, Direction, Hypothesis, Phase } from '$lib/stores/gameState';

export interface ArenaAltViewProps {
  phase: Phase;
  battleTick: BattleTickState | null;
  hypothesis: Hypothesis | null;
  prices: { BTC: number };
  battleResult: string | null;
  battlePriceHistory: BattlePriceTick[];
  activeAgents: ArenaAgentSummary[];
}

export interface ArenaResultPanelProps {
  win: boolean;
  battleResult: string;
  entryPrice: number;
  exitPrice: number;
  tpPrice: number;
  slPrice: number;
  direction: Direction;
  priceHistory: BattlePriceTick[];
  duration: number;
  maxRunup: number;
  maxDrawdown: number;
  rAchieved: number;
  fbScore: FBScore | null;
  lpChange: number;
  streak: number;
  agents: ArenaAgentSummary[];
  actualDirection: Direction;
}

export interface ArenaBattleLayoutSceneProps {
  chartRailProps: ArenaChartRailProps;
  battleSidebarProps: ArenaBattleSidebarProps;
}

export interface ArenaMatchSceneProps {
  arenaSyncStatus?: ArenaApiSyncStatusDisplay | null;
  confirmingExit?: boolean;
  phaseTrack?: ArenaPhaseTrackStep[];
  arenaMode?: ArenaMode;
  arenaModeDisplay?: ArenaModeDisplay;
  lp?: number;
  wins?: number;
  losses?: number;
  onConfirmGoLobby?: () => void;
  onToggleMatchHistory?: () => void;
  matchHistoryOpen?: boolean;
  onCloseMatchHistory?: () => void;
  phase?: Phase;
  pair?: string;
  timeframe?: string;
  arenaView?: ArenaView;
  onSelectArenaView?: (view: ArenaView) => void;
  altViewProps?: ArenaAltViewProps;
  resultVisible?: boolean;
  resultPanelProps?: ArenaResultPanelProps;
  onPlayAgain?: () => void;
  onLobby?: () => void;
  battleLayoutProps?: ArenaBattleLayoutSceneProps;
}
