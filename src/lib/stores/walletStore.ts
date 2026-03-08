// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Wallet & User State Store
// Per UserJourney Lifecycle spec: P0→P5 progression
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { STORAGE_KEYS } from './storageKeys';
import { loadFromStorage, autoSave } from '$lib/utils/storage';
import {
  authSessionStore,
  type AuthSessionState,
} from './authSessionStore';
import {
  createSimulatedSignature,
  createSimulatedWalletConnection
} from '$lib/wallet/simulatedWallet';
import { resolveLifecyclePhase } from './progressionRules';

export type UserTier = 'guest' | 'registered' | 'connected' | 'verified';

export interface WalletState {
  // User identity
  tier: UserTier;
  email: string | null;
  nickname: string | null;

  // Wallet
  connected: boolean;
  address: string | null;
  shortAddr: string | null;
  balance: number;
  chain: string;
  provider: string | null;

  // Progression (P0-P5)
  phase: number;         // 0-5
  hasSeenDemo: boolean;
  hasCompletedOnboarding: boolean;
  matchesPlayed: number;
  totalLP: number;

  // UI state
  showWalletModal: boolean;
  walletModalStep: 'welcome' | 'wallet-select' | 'connecting' | 'sign-message' | 'connected' | 'signup' | 'login' | 'demo-intro' | 'profile';
  signature: string | null;
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
  tier: 'guest',
  email: null,
  nickname: null,
  connected: false,
  address: null,
  shortAddr: null,
  balance: 0,
  chain: 'ARB',
  provider: null,
  phase: 0,
  hasSeenDemo: false,
  hasCompletedOnboarding: false,
  matchesPlayed: 0,
  totalLP: 0,
  showWalletModal: false,
  walletModalStep: 'welcome',
  signature: null
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
    phase: resolveLifecyclePhase(merged.matchesPlayed, merged.totalLP)
  };
}

export const walletStore = writable<WalletState>(loadWallet());

autoSave(walletStore, STORAGE_KEYS.wallet, (w) => {
  const {
    email,
    nickname,
    tier,
    showWalletModal,
    walletModalStep,
    signature,
    ...persistable
  } = w;
  void email;
  void nickname;
  void tier;
  return persistable;
}, 300);

// Derived stores
export const isWalletConnected = derived(walletStore, $w => $w.connected);
export const userTier = derived(walletStore, $w => $w.tier);
export const userPhase = derived(walletStore, $w => $w.phase);

function normalizeTier(value: unknown, fallback: UserTier): UserTier {
  const tier = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (tier === 'verified' || tier === 'connected' || tier === 'registered' || tier === 'guest') {
    return tier;
  }
  return fallback;
}

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
    const phase = Number.isFinite(Number(user.phase)) ? Math.max(1, Number(user.phase)) : Math.max(1, wallet.phase);
    return {
      ...wallet,
      email: user.email || null,
      nickname: user.nickname || null,
      tier: normalizeTier(user.tier, keepLiveConnection ? 'connected' : 'registered'),
      phase,
      hasCompletedOnboarding: true,
      showWalletModal: false,
      walletModalStep: 'profile',
      address,
      shortAddr,
    };
  }

  if (!session.hydrated) {
    return wallet;
  }

  return {
    ...wallet,
    email: null,
    nickname: null,
    tier: wallet.connected ? 'connected' : 'guest',
    showWalletModal: false,
    walletModalStep: wallet.connected ? 'connected' : 'welcome',
    address: wallet.connected ? wallet.address : null,
    shortAddr: wallet.connected ? wallet.shortAddr : null,
  };
}

authSessionStore.subscribe((session) => {
  walletStore.update((wallet) => applyAuthSessionToWalletState(wallet, session));
});

// ═══ Actions ═══

export function openWalletModal() {
  walletStore.update(w => {
    // Wallet-first flow:
    // connected + account => profile
    // connected only => choose login/signup from connected step
    // account only (session restored) but no wallet => reconnect wallet first
    const step = w.connected
      ? (w.email ? 'profile' : 'connected')
      : (w.email ? 'wallet-select' : 'welcome');
    return { ...w, showWalletModal: true, walletModalStep: step };
  });
}

export function closeWalletModal() {
  walletStore.update(w => ({ ...w, showWalletModal: false }));
}

export function setWalletModalStep(step: WalletState['walletModalStep']) {
  walletStore.update(w => ({ ...w, walletModalStep: step }));
}

// Register with email + nickname (now after wallet connect)
export function registerUser(email: string, nickname: string) {
  walletStore.update(w => ({
    ...w,
    tier: w.connected ? 'connected' : 'registered',
    email,
    nickname,
    phase: Math.max(resolveLifecyclePhase(w.matchesPlayed, w.totalLP), 1),
    hasCompletedOnboarding: true,
    walletModalStep: 'profile'
  }));
}

// Complete demo viewing
export function completeDemoView() {
  walletStore.update(w => ({
    ...w,
    hasSeenDemo: true,
    phase: Math.max(resolveLifecyclePhase(w.matchesPlayed, w.totalLP), 1),
    walletModalStep: 'wallet-select'
  }));
}

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
    provider: connection.provider,
    signature: null,
    walletModalStep: 'sign-message' // New: go to sign step
  }));
}

// Sign message to verify ownership
export function signMessage(signatureOverride?: string) {
  const signature = createSimulatedSignature(signatureOverride);

  walletStore.update(w => ({
    ...w,
    tier: w.email ? 'connected' : 'guest',
    signature,
    phase: Math.max(resolveLifecyclePhase(w.matchesPlayed, w.totalLP), 2),
    walletModalStep: 'connected'
  }));
}

// Skip wallet connection (stay at registered, still usable!)
export function skipWalletConnection() {
  walletStore.update(w => ({
    ...w,
    hasCompletedOnboarding: true,
    showWalletModal: false
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
    signature: null,
    tier: w.email ? 'registered' : 'guest'
  }));
}

// Track match completion (for P2→P3 progression)
export function recordMatch(_won: boolean, lpDelta: number) {
  walletStore.update(w => {
    const matches = w.matchesPlayed + 1;
    const lp = w.totalLP + lpDelta;
    const phase = resolveLifecyclePhase(matches, lp);
    return { ...w, matchesPlayed: matches, totalLP: lp, phase };
  });
}
