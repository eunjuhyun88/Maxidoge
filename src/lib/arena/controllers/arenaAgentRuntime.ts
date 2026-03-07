import type { ArenaBattleChatMessage } from '$lib/arena/battle/arenaBattlePresentationRuntime';

interface ArenaAgentLike {
  id: string;
}

export interface ArenaAgentChatAuthor {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ArenaAgentUiState {
  state: string;
  speech: string;
  energy: number;
  voteDir: string;
  posX?: number;
  posY?: number;
}

interface CreateArenaAgentRuntimeOptions<TAgent extends ArenaAgentLike> {
  getActiveAgents: () => ReadonlyArray<TAgent>;
  getAgentStates: () => Record<string, ArenaAgentUiState>;
  setAgentStates: (next: Record<string, ArenaAgentUiState>) => void;
  getChatMessages: () => Array<ArenaBattleChatMessage & { id: number }>;
  setChatMessages: (next: Array<ArenaBattleChatMessage & { id: number }>) => void;
  safeTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

export function createArenaAgentRuntime<TAgent extends ArenaAgentLike>(
  options: CreateArenaAgentRuntimeOptions<TAgent>,
) {
  let speechTimers: Record<string, ReturnType<typeof setInterval>> = {};

  function updateAgentState(
    agentId: string,
    updater: (current: ArenaAgentUiState) => ArenaAgentUiState,
  ) {
    const agentStates = options.getAgentStates();
    const current = agentStates[agentId];
    if (!current) {
      return;
    }

    options.setAgentStates({
      ...agentStates,
      [agentId]: updater(current),
    });
  }

  function initAgentStates() {
    const next: Record<string, ArenaAgentUiState> = {};
    for (const agent of options.getActiveAgents()) {
      next[agent.id] = { state: 'idle', speech: '', energy: 0, voteDir: '' };
    }
    options.setAgentStates(next);
  }

  function setSpeech(agentId: string, text: string, dur = 1500) {
    if (speechTimers[agentId]) {
      clearInterval(speechTimers[agentId]);
      delete speechTimers[agentId];
    }

    let charIdx = 0;
    updateAgentState(agentId, (current) => ({ ...current, speech: '' }));

    speechTimers[agentId] = setInterval(() => {
      charIdx += 1;
      if (charIdx >= text.length) {
        clearInterval(speechTimers[agentId]);
        delete speechTimers[agentId];
        updateAgentState(agentId, (current) => ({ ...current, speech: text }));

        if (dur > 0) {
          options.safeTimeout(() => {
            updateAgentState(agentId, (current) => ({ ...current, speech: '' }));
          }, dur);
        }
        return;
      }

      updateAgentState(agentId, (current) => ({
        ...current,
        speech: text.slice(0, charIdx) + '|',
      }));
    }, 30);
  }

  function setAgentState(agentId: string, state: string) {
    updateAgentState(agentId, (current) => ({ ...current, state }));
  }

  function setAgentEnergy(agentId: string, energy: number) {
    updateAgentState(agentId, (current) => ({ ...current, energy }));
  }

  function appendChatMessage(message: ArenaBattleChatMessage) {
    options.setChatMessages([
      ...options.getChatMessages(),
      { id: Date.now() + Math.random(), ...message },
    ].slice(-20));
  }

  function addChatMessage(author: ArenaAgentChatAuthor, text: string, isAction = false) {
    appendChatMessage({
      agentId: author.id,
      name: author.name,
      icon: author.icon,
      color: author.color,
      text,
      isAction,
    });
  }

  function destroy() {
    Object.values(speechTimers).forEach((timer) => clearInterval(timer));
    speechTimers = {};
  }

  return {
    addChatMessage,
    appendChatMessage,
    destroy,
    initAgentStates,
    setAgentEnergy,
    setAgentState,
    setSpeech,
  };
}
