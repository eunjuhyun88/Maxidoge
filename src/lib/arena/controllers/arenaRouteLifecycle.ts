import { setPhaseInitCallback } from '$lib/engine/gameLoop';
import type { Phase } from '$lib/stores/gameState';

type ArenaMatchSceneComponentType = typeof import('../../../components/arena/ArenaMatchScene.svelte').default;

interface CreateArenaRouteLifecycleOptions {
  getSceneComponent: () => ArenaMatchSceneComponentType | null;
  setSceneComponent: (component: ArenaMatchSceneComponentType) => void;
  onPhaseInit: (phase: Phase) => void;
  onKeydown: (event: KeyboardEvent) => void;
}

export function createArenaRouteLifecycle(options: CreateArenaRouteLifecycleOptions) {
  function ensureArenaMatchSceneComponent() {
    if (options.getSceneComponent() || typeof window === 'undefined') {
      return;
    }

    void import('../../../components/arena/ArenaMatchScene.svelte').then((module) => {
      options.setSceneComponent(module.default);
    });
  }

  function warmScene(inLobby: boolean, phase: Phase) {
    if (inLobby || phase === 'DRAFT') {
      return;
    }

    ensureArenaMatchSceneComponent();
  }

  function mount() {
    setPhaseInitCallback(options.onPhaseInit);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', options.onKeydown);
    }
  }

  function destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', options.onKeydown);
    }
  }

  return {
    destroy,
    ensureArenaMatchSceneComponent,
    mount,
    warmScene,
  };
}
