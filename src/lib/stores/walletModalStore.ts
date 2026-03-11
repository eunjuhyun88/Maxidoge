import { get, writable } from 'svelte/store';
import { authSessionStore, type AuthSessionState } from './authSessionStore';
import { walletStore, type WalletState } from './walletStore';

export type WalletModalStep =
  | 'wallet-select'
  | 'connecting'
  | 'sign-message'
  | 'resolving'
  | 'signup'
  | 'profile'
  // Legacy steps (kept for backward compat, redirect in WalletModal)
  | 'welcome'
  | 'connected'
  | 'login'
  | 'demo-intro';

export interface WalletModalState {
  open: boolean;
  step: WalletModalStep;
}

const defaultWalletModalState: WalletModalState = {
  open: false,
  step: 'wallet-select',
};

export const walletModalStore = writable<WalletModalState>(defaultWalletModalState);

function resolveOpenStep(wallet: WalletState, session: AuthSessionState): WalletModalStep {
  const hasAccount = session.authenticated && !!session.user;
  if (hasAccount) return 'profile';
  if (wallet.connected) return 'sign-message';
  return 'wallet-select';
}

export function openWalletModal() {
  walletModalStore.update(() => ({
    open: true,
    step: resolveOpenStep(get(walletStore), get(authSessionStore)),
  }));
}

export function closeWalletModal() {
  walletModalStore.update((state) => ({ ...state, open: false }));
}

export function setWalletModalStep(step: WalletModalStep) {
  walletModalStore.update((state) => ({ ...state, step }));
}
