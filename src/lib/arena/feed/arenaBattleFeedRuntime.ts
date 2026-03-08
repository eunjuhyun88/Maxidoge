import { clearFeed, pushFeedItem } from '$lib/stores/battleFeedStore';
import type { Direction, Phase } from '$lib/stores/gameState';

interface CreateArenaBattleFeedRuntimeOptions {
  getPhase: () => Phase;
}

function buildAgentFeedId(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeFeedDirection(dir?: string | null): Direction | undefined {
  if (dir === 'LONG' || dir === 'SHORT' || dir === 'NEUTRAL') return dir;
  return undefined;
}

export function createArenaBattleFeedRuntime(options: CreateArenaBattleFeedRuntimeOptions) {
  function addFeed(
    icon: string,
    name: string,
    color: string,
    text: string,
    dir?: string | null,
  ) {
    pushFeedItem({
      agentId: buildAgentFeedId(name),
      agentName: name,
      agentIcon: icon,
      agentColor: color,
      text,
      dir: normalizeFeedDirection(dir),
      phase: options.getPhase(),
    });
  }

  function pushSystemFeed(text: string, phase: Phase = 'DRAFT') {
    pushFeedItem({
      agentId: 'system',
      agentName: 'SYSTEM',
      agentIcon: '🐕',
      agentColor: '#E8967D',
      text,
      phase,
    });
  }

  return {
    addFeed,
    clear: clearFeed,
    pushSystemFeed,
  };
}
