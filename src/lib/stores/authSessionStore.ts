import { derived, writable } from 'svelte/store';
import { fetchAuthSession, type AuthUserPayload } from '$lib/api/auth';

export interface AuthSessionState {
  authenticated: boolean;
  hydrated: boolean;
  user: AuthUserPayload | null;
}

const defaultAuthSession: AuthSessionState = {
  authenticated: false,
  hydrated: false,
  user: null,
};

export const authSessionStore = writable<AuthSessionState>(defaultAuthSession);

export const authSessionIdentity = derived(authSessionStore, ($session) => ({
  authenticated: $session.authenticated,
  email: $session.user?.email ?? null,
  nickname: $session.user?.nickname ?? null,
  tier: typeof $session.user?.tier === 'string' ? $session.user.tier : null,
  phase: Number.isFinite(Number($session.user?.phase)) ? Math.max(1, Number($session.user?.phase)) : null,
  walletAddress: typeof $session.user?.walletAddress === 'string'
    ? $session.user.walletAddress
    : typeof $session.user?.wallet === 'string'
      ? $session.user.wallet
      : null,
}));

let _authHydrated = false;
let _authHydrationPromise: Promise<void> | null = null;

export function applyAuthenticatedUser(user: AuthUserPayload) {
  authSessionStore.set({
    authenticated: true,
    hydrated: true,
    user,
  });
}

export function clearAuthenticatedUser() {
  authSessionStore.set({
    authenticated: false,
    hydrated: true,
    user: null,
  });
}

export async function hydrateAuthSession(force = false) {
  if (typeof window === 'undefined') return;
  if (_authHydrated && !force) return;
  if (_authHydrationPromise) return _authHydrationPromise;

  _authHydrationPromise = (async () => {
    try {
      const res = await fetchAuthSession();
      if (res.authenticated && res.user) {
        applyAuthenticatedUser(res.user);
      } else {
        clearAuthenticatedUser();
      }
      _authHydrated = true;
    } catch (error) {
      console.warn('[authSessionStore] auth session hydrate failed', error);
    }
  })();

  try {
    await _authHydrationPromise;
  } finally {
    _authHydrationPromise = null;
  }
}
