import { DOGE_WORDS } from '$lib/engine/phases';

export interface ArenaFloatingWord {
  id: number;
  text: string;
  color: string;
  x: number;
  dur: number;
}

export interface ArenaParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface CreateArenaVisualEffectsRuntimeOptions {
  scheduleTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  getFloatingWords: () => ArenaFloatingWord[];
  setFloatingWords: (next: ArenaFloatingWord[]) => void;
  setArenaParticles: (next: ArenaParticle[]) => void;
}

const DOGE_FLOAT_COLORS = ['#FF5E7A', '#E8967D', '#66CCE6', '#00CC88', '#DCB970', '#F0EDE4'];

export function createArenaVisualEffectsRuntime(options: CreateArenaVisualEffectsRuntimeOptions) {
  function seedArenaParticles() {
    options.setArenaParticles(
      Array.from({ length: 12 }, (_, index) => ({
        id: index,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 3,
        speed: 0.5 + Math.random() * 1.5,
        opacity: 0.1 + Math.random() * 0.2,
      })),
    );
  }

  function emitDogeFloatBurst() {
    const count = 3 + Math.floor(Math.random() * 3);

    for (let index = 0; index < count; index += 1) {
      options.scheduleTimeout(() => {
        const id = Date.now() + index;
        options.setFloatingWords([
          ...options.getFloatingWords(),
          {
            id,
            text: DOGE_WORDS[Math.floor(Math.random() * DOGE_WORDS.length)],
            color: DOGE_FLOAT_COLORS[Math.floor(Math.random() * DOGE_FLOAT_COLORS.length)],
            x: 10 + Math.random() * 80,
            dur: 1.5 + Math.random(),
          },
        ]);
        options.scheduleTimeout(() => {
          options.setFloatingWords(
            options.getFloatingWords().filter((word) => word.id !== id),
          );
        }, 2500);
      }, index * 200);
    }
  }

  return {
    emitDogeFloatBurst,
    seedArenaParticles,
  };
}
