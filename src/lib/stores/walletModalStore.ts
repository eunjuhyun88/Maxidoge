import { get, writable } from 'svelte/store';
import { authSessionStore, type AuthSessionState } from './authSessionStore';
import { walletStore, type WalletState } from './walletStore';

export type WalletModalStep =
  | 'welcome'
  | 'wallet-select'
  | 'connecting'
  | 'sign-message'
  | 'connected'
  | 'signup'
  | 'login'
  | 'demo-intro'
  | 'profile';

export interface WalletModalState {
  open: boolean;
  step: WalletModalStep;
}

const defaultWalletModalState: WalletModalState = {
  open: false,
  step: 'welcome',
};

export const walletModalStore = writable<WalletModalState>(defaultWalletModalState);

function resolveOpenStep(wallet: WalletState, session: AuthSessionState): WalletModalStep {
  const hasAccount = session.authenticated && !!session.user;
  if (wallet.connected) {
    return hasAccount ? 'profile' : 'connected';
  }
  return hasAccount ? 'wallet-select' : 'welcome';
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
