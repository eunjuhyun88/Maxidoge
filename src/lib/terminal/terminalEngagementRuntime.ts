import type { MobileTab } from './terminalHelpers';
import type { TerminalDensityMode } from './terminalTypes';
import { get, readonly, writable } from 'svelte/store';

export interface CreateTerminalEngagementRuntimeOptions {
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  getPair: () => string;
  getTimeframe: () => string;
  getIsMobile: () => boolean;
  densityStorageKey: string;
}

export function readTerminalDensityMode(storageKey: string): TerminalDensityMode {
  try {
    return localStorage.getItem(storageKey) === 'pro' ? 'pro' : 'essential';
  } catch {
    return 'essential';
  }
}

export function createTerminalEngagementRuntime(options: CreateTerminalEngagementRuntimeOptions) {
  const mobileTabStore = writable<MobileTab>('chart');
  const densityModeStore = writable<TerminalDensityMode>(readTerminalDensityMode(options.densityStorageKey));
  let mobileViewTracked = false;
  let mobileNavTracked = false;

  function buildContext(extra?: Record<string, unknown>) {
    return {
      pair: options.getPair(),
      timeframe: options.getTimeframe(),
      ...extra,
    };
  }

  function setMobileTab(tab: MobileTab) {
    const fromTab = get(mobileTabStore);
    if (fromTab === tab) return;
    mobileTabStore.set(tab);
    options.emitGtm('terminal_mobile_tab_change', buildContext({
      tab,
      from_tab: fromTab,
      source: 'bottom-nav',
    }));
  }

  function toggleDensityMode() {
    const nextMode = get(densityModeStore) === 'essential' ? 'pro' : 'essential';
    densityModeStore.set(nextMode);
    try {
      localStorage.setItem(options.densityStorageKey, nextMode);
    } catch {}
    options.emitGtm('terminal_density_mode_toggle', buildContext({
      mode: nextMode,
    }));
  }

  function syncMobileViewportTracking() {
    const isMobile = options.getIsMobile();

    if (isMobile && !mobileViewTracked) {
      mobileViewTracked = true;
      options.emitGtm('terminal_mobile_view', buildContext({
        tab: get(mobileTabStore),
      }));
    } else if (!isMobile && mobileViewTracked) {
      mobileViewTracked = false;
    }

    if (isMobile && !mobileNavTracked) {
      mobileNavTracked = true;
      options.emitGtm('terminal_mobile_nav_impression', buildContext({
        tab: get(mobileTabStore),
      }));
    } else if (!isMobile && mobileNavTracked) {
      mobileNavTracked = false;
    }
  }

  return {
    densityMode: readonly(densityModeStore),
    mobileTab: readonly(mobileTabStore),
    setMobileTab,
    toggleDensityMode,
    syncMobileViewportTracking,
  };
}
