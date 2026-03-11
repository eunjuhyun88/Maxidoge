import { fetchHoldings, type PortfolioHolding } from '$lib/api/portfolioApi';
import type { HoldingAsset } from '$lib/data/holdings';

export type PassportHoldingsStateMode = 'loading' | 'live' | 'fallback';

export interface PassportHoldingsState {
  liveHoldings: HoldingAsset[];
  loaded: boolean;
  state: PassportHoldingsStateMode;
  statusMessage: string;
  syncAddress: string | null;
  syncing: boolean;
}

export interface PassportWalletSnapshot {
  connected: boolean;
  address: string | null;
}

interface CreatePassportHoldingsRuntimeOptions {
  getState: () => PassportHoldingsState;
  setState: (next: PassportHoldingsState) => void;
  toHoldingAsset: (holding: PortfolioHolding) => HoldingAsset;
}

export function createPassportHoldingsState(): PassportHoldingsState {
  return {
    liveHoldings: [],
    loaded: false,
    state: 'loading',
    statusMessage: 'Syncing wallet holdings...',
    syncAddress: null,
    syncing: false,
  };
}

export function createPassportHoldingsRuntime(options: CreatePassportHoldingsRuntimeOptions) {
  function updateState(
    updater: Partial<PassportHoldingsState> | ((state: PassportHoldingsState) => PassportHoldingsState)
  ) {
    const current = options.getState();
    const next = typeof updater === 'function'
      ? updater(current)
      : { ...current, ...updater };
    options.setState(next);
  }

  async function hydrate(wallet: PassportWalletSnapshot) {
    updateState({
      state: 'loading',
      statusMessage: 'Syncing wallet holdings...',
    });

    try {
      const res = await fetchHoldings();
      if (res?.ok && res.data.holdings.length > 0) {
        updateState({
          liveHoldings: res.data.holdings.map(options.toHoldingAsset),
          loaded: true,
          state: 'live',
          statusMessage: `Live holdings synced (${res.data.holdings.length} assets)`,
        });
        return;
      }
    } catch {
      // fallback state below
    }

    updateState({
      liveHoldings: [],
      loaded: false,
      state: 'fallback',
      statusMessage: wallet.connected
        ? 'Live holdings unavailable. Showing demo holdings.'
        : 'Connect wallet to load live holdings.',
    });
  }

  async function syncNow(wallet: PassportWalletSnapshot) {
    if (options.getState().syncing) return;

    updateState({ syncing: true });
    try {
      await hydrate(wallet);
    } finally {
      updateState({ syncing: false });
    }
  }

  async function syncForWallet(wallet: PassportWalletSnapshot) {
    const current = options.getState();
    if (!wallet.connected || !wallet.address) {
      if (current.syncAddress !== null) {
        updateState({ syncAddress: null });
      }
      return;
    }

    if (wallet.address === current.syncAddress) return;

    updateState({ syncAddress: wallet.address });
    await hydrate(wallet);
  }

  function resetIfDisconnected(wallet: PassportWalletSnapshot) {
    const current = options.getState();
    if (
      (wallet.connected && wallet.address) ||
      (!current.loaded && current.liveHoldings.length === 0 && current.state !== 'live')
    ) {
      return;
    }

    updateState({
      syncAddress: null,
      liveHoldings: [],
      loaded: false,
      state: 'fallback',
      statusMessage: 'Connect wallet to load live holdings.',
    });
  }

  return {
    hydrate,
    resetIfDisconnected,
    syncForWallet,
    syncNow,
  };
}
