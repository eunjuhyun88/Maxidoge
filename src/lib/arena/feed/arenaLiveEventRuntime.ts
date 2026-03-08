import { getEventCadence, pickLiveEvent } from '$lib/engine/arenaGameJuice';

export type ArenaLiveEventPhase = 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE';

export interface ArenaLiveEventFeedMessage {
  icon: string;
  name: string;
  color: string;
  text: string;
}

export interface ArenaLiveEventRuntimeController {
  start: (phase: ArenaLiveEventPhase) => void;
  clear: () => void;
  destroy: () => void;
}

interface ArenaLiveEventRuntimeOptions {
  emitFeed: (message: ArenaLiveEventFeedMessage) => void;
  getSpeed: () => number;
  isDestroyed: () => boolean;
}

export function createArenaLiveEventRuntime(
  options: ArenaLiveEventRuntimeOptions,
): ArenaLiveEventRuntimeController {
  let timer: ReturnType<typeof setInterval> | null = null;

  function clear() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function emitPhaseEvent(phase: ArenaLiveEventPhase) {
    const event = pickLiveEvent(phase);
    if (!event) return;
    options.emitFeed({
      icon: event.icon,
      name: 'EVENT',
      color: event.tint,
      text: `${event.title} · ${event.detail}`,
    });
  }

  function start(phase: ArenaLiveEventPhase) {
    clear();
    emitPhaseEvent(phase);
    timer = setInterval(() => {
      if (options.isDestroyed()) return;
      emitPhaseEvent(phase);
    }, getEventCadence(phase, options.getSpeed()));
  }

  return {
    start,
    clear,
    destroy: clear,
  };
}
