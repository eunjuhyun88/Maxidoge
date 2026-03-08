import type { ArenaAgentChatAuthor, ArenaAgentUiState } from './arenaAgentRuntime';

interface ArenaAgentBridgeRuntime {
  addChatMessage: (author: ArenaAgentChatAuthor, text: string, isAction?: boolean) => void;
  setAgentEnergy: (agentId: string, energy: number) => void;
  setAgentState: (agentId: string, state: string) => void;
  setSpeech: (agentId: string, text: string, duration?: number) => void;
}

interface ArenaAgentBridgeSyncHooks {
  syncAgentEnergy?: (agentId: string, energy: number) => void;
  syncAgentState?: (agentId: string, state: string) => void;
}

interface CreateArenaAgentBridgeOptions {
  runtime: ArenaAgentBridgeRuntime;
  getAgentStates: () => Record<string, ArenaAgentUiState>;
  setAgentStates: (next: Record<string, ArenaAgentUiState>) => void;
}

export function createArenaAgentBridge(options: CreateArenaAgentBridgeOptions) {
  let syncHooks: ArenaAgentBridgeSyncHooks = {};

  function bindPresentationSync(nextHooks: ArenaAgentBridgeSyncHooks) {
    syncHooks = nextHooks;
  }

  function setSpeech(agentId: string, text: string, duration = 1500) {
    options.runtime.setSpeech(agentId, text, duration);
  }

  function setAgentState(agentId: string, state: string) {
    options.runtime.setAgentState(agentId, state);
    syncHooks.syncAgentState?.(agentId, state);
  }

  function setAgentEnergy(agentId: string, energy: number) {
    options.runtime.setAgentEnergy(agentId, energy);
    syncHooks.syncAgentEnergy?.(agentId, energy);
  }

  function addChatMessage(author: ArenaAgentChatAuthor, text: string, isAction = false) {
    options.runtime.addChatMessage(author, text, isAction);
  }

  function addSystemChat(icon: string, color: string, text: string, isAction = true) {
    options.runtime.addChatMessage(
      { id: 'SYS', name: 'SYSTEM', icon, color },
      text,
      isAction,
    );
  }

  function setVoteDir(agentId: string, dir: string) {
    const current = options.getAgentStates();
    const next = current[agentId];
    if (!next) {
      return;
    }
    options.setAgentStates({
      ...current,
      [agentId]: {
        ...next,
        voteDir: dir,
      },
    });
  }

  return {
    addChatMessage,
    addSystemChat,
    bindPresentationSync,
    setAgentEnergy,
    setAgentState,
    setSpeech,
    setVoteDir,
  };
}
