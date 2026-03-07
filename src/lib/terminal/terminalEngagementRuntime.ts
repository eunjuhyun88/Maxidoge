import type { MobileTab } from './terminalHelpers';
import type { TerminalDensityMode } from './terminalTypes';

export interface CreateTerminalEngagementRuntimeOptions {
  emitGtm: (event: string, payload?: Record<string, unknown>) => void;
  getPair: () => string;
  getTimeframe: () => string;
  getIsMobile: () => boolean;
  getMobileTab: () => MobileTab;
  setMobileTab: (tab: MobileTab) => void;
  getDensityMode: () => TerminalDensityMode;
  setDensityMode: (mode: TerminalDensityMode) => void;
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
    const fromTab = options.getMobileTab();
    if (fromTab === tab) return;
    options.setMobileTab(tab);
    options.emitGtm('terminal_mobile_tab_change', buildContext({
      tab,
      from_tab: fromTab,
      source: 'bottom-nav',
    }));
  }

  function toggleDensityMode() {
    const nextMode = options.getDensityMode() === 'essential' ? 'pro' : 'essential';
    options.setDensityMode(nextMode);
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
        tab: options.getMobileTab(),
      }));
    } else if (!isMobile && mobileViewTracked) {
      mobileViewTracked = false;
    }

    if (isMobile && !mobileNavTracked) {
      mobileNavTracked = true;
      options.emitGtm('terminal_mobile_nav_impression', buildContext({
        tab: options.getMobileTab(),
      }));
    } else if (!isMobile && mobileNavTracked) {
      mobileNavTracked = false;
    }
  }

  return {
    setMobileTab,
    toggleDensityMode,
    syncMobileViewportTracking,
  };
}
