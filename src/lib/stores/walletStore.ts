// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Wallet & User State Store
// Per UserJourney Lifecycle spec: P0→P5 progression
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';

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
  walletModalStep: 'welcome' | 'wallet-select' | 'connecting' | 'sign-message' | 'connected' | 'signup' | 'demo-intro' | 'profile';
  signature: string | null;
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
  if (typeof window === 'undefined') return defaultWallet;
  try {
    const saved = localStorage.getItem('maxidoge_wallet');
    if (saved) return { ...defaultWallet, ...JSON.parse(saved) };
  } catch {}
  return defaultWallet;
}

export const walletStore = writable<WalletState>(loadWallet());

// Persist
walletStore.subscribe(w => {
  if (typeof window === 'undefined') return;
  const { showWalletModal, walletModalStep, signature, ...persistable } = w;
  localStorage.setItem('maxidoge_wallet', JSON.stringify(persistable));
});

// Derived stores
export const isWalletConnected = derived(walletStore, $w => $w.connected);
export const userTier = derived(walletStore, $w => $w.tier);
export const userPhase = derived(walletStore, $w => $w.phase);

// ═══ Actions ═══

export function openWalletModal() {
  walletStore.update(w => {
    // New flow: wallet first → then email
    const step = w.connected && w.email ? 'profile'
      : w.connected && !w.email ? 'signup'
      : w.tier !== 'guest' && !w.connected ? 'wallet-select'
      : 'welcome';
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
    phase: Math.max(w.phase, 1),
    hasCompletedOnboarding: true,
    walletModalStep: 'profile'
  }));
}

// Complete demo viewing
export function completeDemoView() {
  walletStore.update(w => ({
    ...w,
    hasSeenDemo: true,
    phase: Math.max(w.phase, 1),
    walletModalStep: 'wallet-select'
  }));
}

// Wallet connection (now first step before email)
export function connectWallet(provider: string = 'MetaMask') {
  // Simulate wallet connection (replace with real Web3 later)
  const fakeAddr = '0x' + Array.from({ length: 40 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');

  walletStore.update(w => ({
    ...w,
    connected: true,
    address: fakeAddr,
    shortAddr: fakeAddr.slice(0, 6) + '...' + fakeAddr.slice(-4),
    balance: +(Math.random() * 10000 + 500).toFixed(2),
    chain: 'ARB',
    provider,
    walletModalStep: 'sign-message' // New: go to sign step
  }));
}

// Sign message to verify ownership
export function signMessage() {
  // Simulate message signing (replace with ethers.js signMessage later)
  const fakeSig = '0x' + Array.from({ length: 130 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');

  walletStore.update(w => ({
    ...w,
    tier: w.email ? 'connected' : 'guest',
    signature: fakeSig,
    phase: Math.max(w.phase, 2),
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
    tier: w.email ? 'registered' : 'guest'
  }));
}

// Track match completion (for P2→P3 progression)
export function recordMatch(won: boolean, lpDelta: number) {
  walletStore.update(w => {
    const matches = w.matchesPlayed + 1;
    const lp = w.totalLP + lpDelta;
    let phase = w.phase;
    // P3 progression: after 10 matches
    if (matches >= 10 && phase < 3) phase = 3;
    // P4 progression: after 50 matches
    if (matches >= 50 && phase < 4) phase = 4;
    return { ...w, matchesPlayed: matches, totalLP: lp, phase };
  });
}
