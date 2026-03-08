import type { ArenaRewardState } from '$lib/arena/reward/arenaRewardRuntime';
import type { ArenaResultState } from '$lib/arena/state/arenaTypes';
import type {
  ArenaFloatingWord,
  ArenaParticle,
} from '$lib/arena/state/arenaVisualEffectsRuntime';

interface CreateArenaUiStateBridgeOptions {
  getFloatingWords: () => ArenaFloatingWord[];
  setFloatingWords: (next: ArenaFloatingWord[]) => void;
  setArenaParticles: (next: ArenaParticle[]) => void;
  getRewardState: () => ArenaRewardState;
  setRewardState: (next: ArenaRewardState) => void;
  setResultData: (next: ArenaResultState) => void;
  getShowMarkers: () => boolean;
  setShowMarkers: (value: boolean) => void;
  createRewardState: () => ArenaRewardState;
}

export function createArenaUiStateBridge(options: CreateArenaUiStateBridgeOptions) {
  return {
    getFloatingWords: options.getFloatingWords,
    getRewardState: options.getRewardState,
    getShowMarkers: options.getShowMarkers,
    resetRewardState: () => {
      options.setRewardState(options.createRewardState());
    },
    setArenaParticles: options.setArenaParticles,
    setFloatingWords: options.setFloatingWords,
    setResultData: options.setResultData,
    setRewardState: options.setRewardState,
    setShowMarkers: options.setShowMarkers,
    toggleMarkers: () => {
      options.setShowMarkers(!options.getShowMarkers());
    },
  };
}
