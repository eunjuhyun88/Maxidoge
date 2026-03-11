import type { ArenaBattleHudDisplay } from '$lib/arena/state/arenaTypes';
import type { ArenaAgentUiState } from '$lib/arena/controllers/arenaAgentRuntime';
import type { AgentDef } from '$lib/data/agents';
import type { BattleTurn, CharSpriteState } from '$lib/engine/arenaCharacters';

export interface ArenaBattleParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

export interface ArenaBattleStageSurfaceProps {
  battleHudDisplay?: ArenaBattleHudDisplay;
  arenaParticles?: ArenaBattleParticle[];
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
}
