import type { AgentDef } from '$lib/data/agents';
import { sfx } from '$lib/audio/sfx';
import { DOGE_BATTLE, DOGE_DEPLOYS } from '$lib/engine/phases';
import { juice_shake } from '$lib/engine/arenaGameJuice';

interface CreateArenaPhaseEffectsRuntimeOptions {
  getActiveAgents: () => AgentDef[];
  safeTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  addFeed: (icon: string, name: string, color: string, text: string) => void;
  clearArenaDynamics: () => void;
  setResultVisible: (value: boolean) => void;
  setPvpVisible: (value: boolean) => void;
  setHypothesisVisible: (value: boolean) => void;
  setPreviewVisible: (value: boolean) => void;
  setFloatDir: (value: 'LONG' | 'SHORT' | null) => void;
  resetArenaView: () => void;
  resetChartBridge: () => void;
  initAgentStates: () => void;
  emitDogeFloatBurst: () => void;
  liveEventStart: (phase: 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE') => void;
  initCharSprites: () => void;
  seedArenaParticles: () => void;
  runScoutSequence: () => void;
  runGatherSequence: () => void;
  runCouncilSequence: () => void;
  setBattleNarration: (text: string) => void;
  addSystemChat: (icon: string, color: string, text: string) => void;
  setAgentState: (agentId: string, state: string) => void;
  setSpeech: (agentId: string, text: string, duration?: number) => void;
  startBattleTurnSequence: () => void;
}

export function createArenaPhaseEffectsRuntime(options: CreateArenaPhaseEffectsRuntimeOptions) {
  function runDraftEnter() {
    options.clearArenaDynamics();
    options.setResultVisible(false);
    options.setPvpVisible(false);
    options.setHypothesisVisible(false);
    options.resetArenaView();
    options.setPreviewVisible(false);
    options.setFloatDir(null);
    options.resetChartBridge();
    options.initAgentStates();
    sfx.enter();
    options.emitDogeFloatBurst();
    options.addFeed('🐕', 'ARENA', '#E8967D', 'Draft locked. Preparing analysis...');

    options.getActiveAgents().forEach((agent, index) => {
      options.safeTimeout(() => {
        options.setAgentState(agent.id, 'alert');
        options.setSpeech(agent.id, DOGE_DEPLOYS[index % DOGE_DEPLOYS.length], 800);
      }, index * 200);
    });
  }

  function runAnalysisEnter() {
    options.liveEventStart('ANALYSIS');
    options.initCharSprites();
    options.seedArenaParticles();
    options.runScoutSequence();
    options.runGatherSequence();
    options.runCouncilSequence();
    options.addFeed('🔍', 'ANALYSIS', '#66CCE6', '5-agent analysis pipeline running...');
  }

  function runHypothesisEnter() {
    options.liveEventStart('HYPOTHESIS');
    juice_shake('light');
    sfx.charge();
    options.setBattleNarration('🎯 포지션을 설정하세요!');
    options.addSystemChat('🎯', '#ffcc00', '배팅 타임! LONG or SHORT?');
    options.addFeed('🐕', 'ARENA', '#66CCE6', 'HYPOTHESIS: pick direction and set TP/SL.');

    options.getActiveAgents().forEach((agent, index) => {
      options.safeTimeout(() => {
        options.setAgentState(agent.id, 'think');
        options.setSpeech(agent.id, '🤔...', 600);
      }, index * 300);
    });
  }

  function runPreviewEnter(hypothesisText: string) {
    options.addFeed('👁', 'PREVIEW', '#DCB970', hypothesisText);
    options.getActiveAgents().forEach((agent, index) => {
      options.safeTimeout(() => {
        options.setAgentState(agent.id, 'think');
        options.setSpeech(agent.id, '📋 reviewing...', 600);
      }, index * 200);
    });
  }

  function runPreviewConfirm() {
    sfx.charge();
    options.addFeed('✅', 'CONFIRMED', '#00CC88', 'Position confirmed — scouting begins!');
  }

  function runBattleEnter() {
    options.liveEventStart('BATTLE');
    options.addFeed('⚔', 'BATTLE', '#FF5E7A', 'Battle in progress!');

    options.getActiveAgents().forEach((agent, index) => {
      options.setAgentState(agent.id, 'alert');
      options.setSpeech(agent.id, DOGE_BATTLE[index % DOGE_BATTLE.length], 400);
    });

    options.startBattleTurnSequence();
  }

  return {
    runAnalysisEnter,
    runBattleEnter,
    runDraftEnter,
    runHypothesisEnter,
    runPreviewConfirm,
    runPreviewEnter,
  };
}
