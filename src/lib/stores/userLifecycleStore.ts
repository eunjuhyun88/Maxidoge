import { derived, writable } from 'svelte/store';
import { STORAGE_KEYS } from './storageKeys';
import { autoSave, loadFromStorage } from '$lib/utils/storage';
import { authSessionStore } from './authSessionStore';
import { resolveLifecyclePhase } from './progressionRules';

export interface UserLifecycleState {
  phase: number;
  hasSeenDemo: boolean;
  hasCompletedOnboarding: boolean;
  matchesPlayed: number;
  totalLP: number;
}

const defaultLifecycle: UserLifecycleState = {
  phase: 0,
  hasSeenDemo: false,
  hasCompletedOnboarding: false,
  matchesPlayed: 0,
  totalLP: 0,
};

function normalizeLifecycle(raw: Partial<UserLifecycleState> | null | undefined): UserLifecycleState {
  if (!raw) return defaultLifecycle;

  const matchesPlayed = Math.max(0, Math.floor(Number(raw.matchesPlayed) || 0));
  const totalLP = Number.isFinite(Number(raw.totalLP)) ? Number(raw.totalLP) : 0;

  return {
    phase: Number.isFinite(Number(raw.phase))
      ? Math.max(Number(raw.phase), resolveLifecyclePhase(matchesPlayed, totalLP))
      : resolveLifecyclePhase(matchesPlayed, totalLP),
    hasSeenDemo: Boolean(raw.hasSeenDemo),
    hasCompletedOnboarding: Boolean(raw.hasCompletedOnboarding),
    matchesPlayed,
    totalLP,
  };
}

function loadLifecycle(): UserLifecycleState {
  const saved = loadFromStorage<Partial<UserLifecycleState> | null>(STORAGE_KEYS.userLifecycle, null);
  if (saved) return normalizeLifecycle(saved);

  // Migrate progression data from the legacy mixed wallet store if present.
  const legacyWallet = loadFromStorage<Partial<UserLifecycleState> | null>(STORAGE_KEYS.wallet, null);
  return normalizeLifecycle(legacyWallet);
}

export const userLifecycleStore = writable<UserLifecycleState>(loadLifecycle());

autoSave(userLifecycleStore, STORAGE_KEYS.userLifecycle, undefined, 300);

export const userPhase = derived(userLifecycleStore, ($lifecycle) => $lifecycle.phase);

authSessionStore.subscribe((session) => {
  if (!session.hydrated || !session.authenticated || !session.user) return;

  userLifecycleStore.update((lifecycle) => ({
    ...lifecycle,
    phase: Number.isFinite(Number(session.user?.phase))
      ? Math.max(lifecycle.phase, Number(session.user?.phase))
      : lifecycle.phase,
    hasCompletedOnboarding: true,
  }));
});

export function completeDemoView() {
  userLifecycleStore.update((lifecycle) => ({
    ...lifecycle,
    hasSeenDemo: true,
    phase: Math.max(resolveLifecyclePhase(lifecycle.matchesPlayed, lifecycle.totalLP), 1),
  }));
}

export function markWalletSignatureComplete() {
  userLifecycleStore.update((lifecycle) => ({
    ...lifecycle,
    phase: Math.max(resolveLifecyclePhase(lifecycle.matchesPlayed, lifecycle.totalLP), 2),
  }));
}

export function skipWalletConnection() {
  userLifecycleStore.update((lifecycle) => ({
    ...lifecycle,
    hasCompletedOnboarding: true,
  }));
}

export function recordMatch(_won: boolean, lpDelta: number) {
  userLifecycleStore.update((lifecycle) => {
    const matchesPlayed = lifecycle.matchesPlayed + 1;
    const totalLP = lifecycle.totalLP + lpDelta;
    return {
      ...lifecycle,
      matchesPlayed,
      totalLP,
      phase: resolveLifecyclePhase(matchesPlayed, totalLP),
    };
  });
}
