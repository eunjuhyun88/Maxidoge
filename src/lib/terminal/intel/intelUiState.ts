import type { IntelPanelTab } from './intelTypes';

const INTEL_PANEL_TABS: IntelPanelTab[] = ['chat', 'feed', 'positions'];

export function isIntelPanelTab(value: unknown): value is IntelPanelTab {
  return typeof value === 'string' && INTEL_PANEL_TABS.includes(value as IntelPanelTab);
}

export function createUiStateSaveQueue(
  saveUiState: (partial: Record<string, unknown>) => Promise<unknown> | void,
  delayMs = 260,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    queue(partial: Record<string, unknown>) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void saveUiState(partial), delayMs);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export async function loadInitialIntelPanelState(params: {
  prioritizeChat: boolean;
  fetchUiState: () => Promise<{ terminalActiveTab?: unknown } | null | undefined>;
}): Promise<IntelPanelTab> {
  if (params.prioritizeChat) {
    return 'chat';
  }

  const uiState = await params.fetchUiState();
  return isIntelPanelTab(uiState?.terminalActiveTab) ? uiState.terminalActiveTab : 'chat';
}
