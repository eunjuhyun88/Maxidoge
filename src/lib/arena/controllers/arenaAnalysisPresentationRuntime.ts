import type { AgentDef } from '$lib/data/agents';
import { SOURCES } from '$lib/data/agents';
import { DOGE_GATHER } from '$lib/engine/phases';
import { getFormPos } from '$lib/engine/arenaCharacters';
import type { Direction } from '$lib/stores/gameState';

interface ArenaAnalysisPresentationRuntimeOptions {
  getActiveAgents: () => AgentDef[];
  getSpeed: () => number;
  safeTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  addFeed: (icon: string, name: string, color: string, text: string, dir?: Direction | null) => void;
  setBattleNarration: (text: string) => void;
  addChatMessage: (agent: AgentDef, text: string, isAction?: boolean) => void;
  setAgentState: (agentId: string, state: string) => void;
  setAgentEnergy: (agentId: string, energy: number) => void;
  setSpeech: (agentId: string, text: string, duration?: number) => void;
  setVoteDir: (agentId: string, dir: string) => void;
  showCharAction: (agentId: string, emoji: string, label: string) => void;
  moveChar: (agentId: string, x: number, y: number) => void;
  applyScoutDecorations: () => void;
  playScanSound: () => void;
  playChargeSound: () => void;
  playVoteSound: () => void;
}

const SOURCE_BY_AGENT_ID: Record<string, string> = {
  structure: 'binance',
  deriv: 'coinglass',
  flow: 'onchain',
  senti: 'social',
  macro: 'feargreed',
};

export function createArenaAnalysisPresentationRuntime(
  options: ArenaAnalysisPresentationRuntimeOptions,
) {
  function resolveAgentSource(agent: AgentDef, index: number) {
    const sourceId = SOURCE_BY_AGENT_ID[agent.id];
    return SOURCES.find((source) => source.id === sourceId) || SOURCES[index % SOURCES.length];
  }

  function runScoutSequence() {
    const activeAgents = options.getActiveAgents();
    const speed = options.getSpeed();

    options.addFeed('🔍', 'SCOUT', '#66CCE6', 'Agents scouting data sources...');
    options.applyScoutDecorations();

    activeAgents.forEach((agent, index) => {
      const targetSource = resolveAgentSource(agent, index);

      options.safeTimeout(() => {
        options.setAgentState(agent.id, 'walk');
        options.moveChar(agent.id, targetSource.x * 100, targetSource.y * 100);
        options.playScanSound();
        options.setBattleNarration(`🔍 ${agent.name}가 데이터를 스캔 중...`);
        options.addChatMessage(agent, `📡 ${targetSource.label || 'data source'} 스캔 중...`);

        options.safeTimeout(() => {
          options.setAgentState(agent.id, 'charge');
          options.setAgentEnergy(agent.id, 30);
          options.setSpeech(agent.id, agent.speech.scout, 800 / speed);
          options.showCharAction(agent.id, '🔍', 'SCAN');

          options.safeTimeout(() => {
            options.setAgentEnergy(agent.id, 75);
            options.addFeed(agent.icon, agent.name, agent.color, agent.finding.title, agent.dir);
            options.setBattleNarration(`📊 ${agent.name}: ${agent.finding.title}`);
            options.addChatMessage(agent, `${agent.finding.title} · ${agent.finding.detail}`);
            options.showCharAction(agent.id, agent.icon, agent.finding.title.slice(0, 12));

            options.safeTimeout(() => {
              options.setAgentEnergy(agent.id, 100);
              options.playChargeSound();
              options.setAgentState(agent.id, 'alert');
              const homePos = getFormPos(index, activeAgents.length);
              options.moveChar(agent.id, homePos.x, homePos.y);

              options.safeTimeout(() => {
                options.setAgentState(agent.id, 'idle');
              }, 500 / speed);
            }, 300 / speed);
          }, 300 / speed);
        }, 500 / speed);
      }, (index * 500) / speed);
    });
  }

  function runGatherSequence() {
    const activeAgents = options.getActiveAgents();

    options.addFeed('📊', 'GATHER', '#66CCE6', 'Gathering analysis data...');
    options.setBattleNarration('📊 에이전트들이 분석 데이터를 수집 중...');

    activeAgents.forEach((agent, index) => {
      options.safeTimeout(() => {
        options.setAgentState(agent.id, 'vote');
        options.setSpeech(agent.id, DOGE_GATHER[index % DOGE_GATHER.length], 400);
        options.addChatMessage(agent, agent.finding.detail);
      }, index * 150);
    });
  }

  function runCouncilSequence() {
    const activeAgents = options.getActiveAgents();
    const speed = options.getSpeed();

    options.addFeed('🗳', 'COUNCIL', '#E8967D', 'Agents voting on direction...');
    options.setBattleNarration('🗳 에이전트 투표 시작!');

    activeAgents.forEach((agent, index) => {
      options.safeTimeout(() => {
        options.setVoteDir(agent.id, agent.dir);
        options.setSpeech(agent.id, agent.speech.vote, 600);
        options.playVoteSound();
        options.addFeed(agent.icon, agent.name, agent.color, `Vote: ${agent.dir} (${agent.conf}%)`, agent.dir);
        options.setBattleNarration(`🗳 ${agent.name}: ${agent.dir} (${agent.conf}% 확신)`);
        options.addChatMessage(agent, `${agent.speech.vote} · ${agent.dir} ${agent.conf}%`);
      }, (index * 400) / speed);
    });
  }

  return {
    runCouncilSequence,
    runGatherSequence,
    runScoutSequence,
  };
}
