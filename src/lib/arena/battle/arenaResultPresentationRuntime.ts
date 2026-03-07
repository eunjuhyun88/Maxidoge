import type { CharState } from '$lib/engine/arenaCharacters';

interface ArenaResultPresentationAgent {
  id: string;
}

interface ArenaResultPresentationOptions<TAgent extends ArenaResultPresentationAgent> {
  win: boolean;
  lpChange: number;
  resultTag: string;
  battleResult: string | null;
  currentPrice: number;
  hypothesisTp: number | null;
  activeAgents: ReadonlyArray<TAgent>;
  onWinEffects: () => void;
  onLoseEffects: () => void;
  setBattleNarration: (text: string) => void;
  addSystemChat: (icon: string, color: string, text: string) => void;
  setAgentState: (agentId: string, state: string) => void;
  setCharState: (agentId: string, state: CharState) => void;
  showCharAction: (agentId: string, emoji: string, label: string) => void;
  setSpeech: (agentId: string, text: string, duration: number) => void;
  pickWinSpeech: () => string;
  pickLoseSpeech: () => string;
}

// Result presentation is intentionally imperative. The runtime owns the branchy
// orchestration so the route only supplies state sinks and effect hooks.
export function runArenaResultPresentation<TAgent extends ArenaResultPresentationAgent>(
  options: ArenaResultPresentationOptions<TAgent>,
) {
  if (options.win) {
    options.onWinEffects();
    options.setBattleNarration(`🏆 승리! +${options.lpChange} LP!`);
    options.addSystemChat('🏆', '#00ff88', `승리!! +${options.lpChange} LP! ${options.resultTag}`);
    options.activeAgents.forEach((agent) => {
      options.setAgentState(agent.id, 'jump');
      options.setCharState(agent.id, 'celebrate');
      options.showCharAction(agent.id, '🎉', 'WIN!');
      options.setSpeech(agent.id, options.pickWinSpeech(), 800);
    });
    return;
  }

  options.onLoseEffects();
  const nearMiss = Boolean(
    options.battleResult === 'sl' &&
    options.hypothesisTp &&
    Math.abs(options.currentPrice - options.hypothesisTp) / options.hypothesisTp < 0.003,
  );

  options.setBattleNarration(
    nearMiss
      ? `😱 아깝다! TP까지 ${Math.abs(options.currentPrice - (options.hypothesisTp || 0)).toFixed(0)}$ 남았었다!`
      : `💀 패배... ${options.resultTag}`,
  );
  options.addSystemChat(
    '💀',
    '#ff5e7a',
    nearMiss ? '아깝다!! 거의 TP 도달이었는데...' : `패배... ${options.resultTag}`,
  );
  options.activeAgents.forEach((agent) => {
    options.setAgentState(agent.id, 'sad');
    options.setCharState(agent.id, 'panic');
    options.setSpeech(agent.id, options.pickLoseSpeech(), 800);
  });
}
