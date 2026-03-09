// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Wallet Shell Store
// Owns wallet connection transport and wallet modal shell state only.
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { STORAGE_KEYS } from './storageKeys';
import { loadFromStorage, autoSave } from '$lib/utils/storage';
import {
  authSessionStore,
  type AuthSessionState,
} from './authSessionStore';
export {
  completeDemoView,
  recordMatch,
  skipWalletConnection,
  userPhase,
} from './userLifecycleStore';
import {
  createSimulatedWalletConnection
} from '$lib/wallet/simulatedWallet';

export interface WalletState {
  // Wallet
  connected: boolean;
  address: string | null;
  shortAddr: string | null;
  balance: number;
  chain: string;
  provider: string | null;
}

function normalizeProvider(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (value === 'metamask' || value === 'coinbase' || value === 'walletconnect' || value === 'phantom') {
    return value;
  }

  if (value === 'meta mask' || value === 'metamask wallet') return 'metamask';
  if (value === 'coinbase wallet') return 'coinbase';
  if (value === 'wallet connect') return 'walletconnect';
  return null;
}

const defaultWallet: WalletState = {
  connected: false,
  address: null,
  shortAddr: null,
  balance: 0,
  chain: 'ARB',
  provider: null
};

// Load from localStorage
function loadWallet(): WalletState {
  const saved = loadFromStorage<Partial<WalletState>>(STORAGE_KEYS.wallet, null as unknown as Partial<WalletState>);
  if (!saved) return defaultWallet;
  const merged = { ...defaultWallet, ...saved };
  const provider = normalizeProvider(merged.provider);
  return {
    ...merged,
    provider,
    chain: typeof merged.chain === 'string' && merged.chain.trim() ? merged.chain.toUpperCase() : defaultWallet.chain,
  };
}

export const walletStore = writable<WalletState>(loadWallet());

autoSave(walletStore, STORAGE_KEYS.wallet, (w) => {
  return w;
}, 300);

// Derived stores
export const isWalletConnected = derived(walletStore, $w => $w.connected);

function toShortAddr(address: string | null): string | null {
  if (!address || address.length < 10) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function applyAuthSessionToWalletState(wallet: WalletState, session: AuthSessionState): WalletState {
  const user = session.user;
  const keepLiveConnection = wallet.connected && !!wallet.address;
  const walletAddress = typeof user?.walletAddress === 'string'
    ? user.walletAddress
    : typeof user?.wallet === 'string'
      ? user.wallet
      : null;
  const address = keepLiveConnection ? wallet.address : walletAddress;
  const shortAddr = keepLiveConnection ? wallet.shortAddr : toShortAddr(address);

  if (user && session.authenticated) {
    return {
      ...wallet,
      address,
      shortAddr,
    };
  }

  if (!session.hydrated) {
    return wallet;
  }

  return {
    ...wallet,
    address: wallet.connected ? wallet.address : null,
    shortAddr: wallet.connected ? wallet.shortAddr : null,
  };
}

authSessionStore.subscribe((session) => {
  walletStore.update((wallet) => applyAuthSessionToWalletState(wallet, session));
});

// ═══ Actions ═══

// Wallet connection (now first step before email)
export function connectWallet(provider: string = 'metamask', addressOverride?: string, chain: string = 'ARB') {
  const connection = createSimulatedWalletConnection(provider, addressOverride, chain);

  walletStore.update(w => ({
    ...w,
    connected: true,
    address: connection.address,
    shortAddr: connection.shortAddr,
    balance: connection.balance,
    chain: connection.chain,
    provider: connection.provider
  }));
}

// Disconnect
export function disconnectWallet() {
  walletStore.update(w => ({
    ...w,
    connected: false,
    address: null,
    shortAddr: null,
    balance: 0,
    provider: null,
    chain: defaultWallet.chain
  }));
}
