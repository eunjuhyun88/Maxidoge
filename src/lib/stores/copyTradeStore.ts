// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Copy Trade Builder Store
// War Room signal selection → Copy Trade Modal → Publish to Signal Room
// ═══════════════════════════════════════════════════════════════

import { writable, derived } from 'svelte/store';
import { AGENT_SIGNALS, getConsensus, type AgentSignal } from '$lib/data/warroom';
import { openQuickTrade } from './quickTradeStore';
import { trackSignal } from './trackedSignalStore';
import { incrementTrackedSignals } from './userProfileStore';

export interface CopyTradeDraft {
  pair: string;
  dir: 'LONG' | 'SHORT';
  orderType: 'market' | 'limit';
  entry: number;
  tp: number[];
  sl: number;
  leverage: number;
  sizePercent: number;
  marginMode: 'cross' | 'isolated';
  evidence: { icon: string; name: string; text: string; conf: number; color: string }[];
  note: string;
}

interface CopyTradeState {
  isOpen: boolean;
  step: 1 | 2 | 3;
  selectedSignalIds: string[];
  draft: CopyTradeDraft;
}

export interface ExternalCopySignal {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  conf: number;
  source?: string;
  reason?: string;
}

const defaultDraft: CopyTradeDraft = {
  pair: 'BTC/USDT',
  dir: 'SHORT',
  orderType: 'market',
  entry: 68200,
  tp: [66100],
  sl: 69500,
  leverage: 5,
  sizePercent: 50,
  marginMode: 'isolated',
  evidence: [],
  note: '',
};

function createCopyTradeStore() {
  const store = writable<CopyTradeState>({
    isOpen: false,
    step: 1,
    selectedSignalIds: [],
    draft: { ...defaultDraft },
  });

  return {
    subscribe: store.subscribe,

    openModal(selectedIds: string[]) {
      const signals = AGENT_SIGNALS.filter(s => selectedIds.includes(s.id));
      if (signals.length === 0) return;

      const consensus = getConsensus(signals);
      const primary = signals[0];

      // Auto-fill draft from selected signals
      const avgEntry = Math.round(signals.reduce((s, sig) => s + sig.entry, 0) / signals.length);
      const tpValues = signals.filter(s => s.vote === consensus.dir.toLowerCase()).map(s => s.tp);
      const slValues = signals.filter(s => s.vote === consensus.dir.toLowerCase()).map(s => s.sl);
      const avgTp = tpValues.length ? Math.round(tpValues.reduce((a, b) => a + b, 0) / tpValues.length) : primary.tp;
      const avgSl = slValues.length ? Math.round(slValues.reduce((a, b) => a + b, 0) / slValues.length) : primary.sl;

      store.set({
        isOpen: true,
        step: 1,
        selectedSignalIds: selectedIds,
        draft: {
          pair: primary.pair,
          dir: consensus.dir === 'NEUTRAL' ? 'LONG' : consensus.dir,
          orderType: 'market',
          entry: avgEntry,
          tp: [avgTp],
          sl: avgSl,
          leverage: 5,
          sizePercent: 50,
          marginMode: 'isolated',
          evidence: signals.map(s => ({ icon: s.icon, name: s.name, text: s.text, conf: s.conf, color: s.color })),
          note: '',
        },
      });
    },

    openFromSignal(signal: ExternalCopySignal) {
      const source = signal.source || 'SIGNAL ROOM';
      const confidence = Number.isFinite(signal.conf) ? Math.max(1, Math.min(100, Math.round(signal.conf))) : 70;

      store.set({
        isOpen: true,
        step: 1,
        selectedSignalIds: [],
        draft: {
          pair: signal.pair,
          dir: signal.dir,
          orderType: 'market',
          entry: Math.round(signal.entry),
          tp: [Math.round(signal.tp)],
          sl: Math.round(signal.sl),
          leverage: 5,
          sizePercent: 50,
          marginMode: 'isolated',
          evidence: [
            {
              icon: '📡',
              name: source,
              text: signal.reason || `${signal.dir} ${signal.pair} signal imported`,
              conf: confidence,
              color: '#ff8c3b',
            },
          ],
          note: signal.reason || '',
        },
      });
    },

    closeModal() {
      store.update(s => ({ ...s, isOpen: false, step: 1, selectedSignalIds: [] }));
    },

    nextStep() {
      store.update(s => ({ ...s, step: Math.min(s.step + 1, 3) as 1 | 2 | 3 }));
    },

    prevStep() {
      store.update(s => ({ ...s, step: Math.max(s.step - 1, 1) as 1 | 2 | 3 }));
    },

    updateDraft(partial: Partial<CopyTradeDraft>) {
      store.update(s => ({ ...s, draft: { ...s.draft, ...partial } }));
    },

    addTpTarget() {
      store.update(s => {
        if (s.draft.tp.length >= 3) return s;
        const lastTp = s.draft.tp[s.draft.tp.length - 1];
        const diff = Math.abs(s.draft.entry - lastTp);
        const newTp = s.draft.dir === 'LONG' ? lastTp + Math.round(diff * 0.5) : lastTp - Math.round(diff * 0.5);
        return { ...s, draft: { ...s.draft, tp: [...s.draft.tp, newTp] } };
      });
    },

    removeTpTarget(index: number) {
      store.update(s => {
        if (s.draft.tp.length <= 1) return s;
        return { ...s, draft: { ...s.draft, tp: s.draft.tp.filter((_, i) => i !== index) } };
      });
    },

    publishSignal(): boolean {
      let success = false;
      store.update(s => {
        const d = s.draft;
        const evidenceText = d.evidence.map(e => `${e.icon} ${e.name}: ${e.text} (${e.conf}%)`).join('\n');
        const noteText = d.note ? `${d.note}\n\n${evidenceText}` : evidenceText;

        // Open a QuickTrade position
        openQuickTrade(d.pair, d.dir, d.entry, d.tp[0], d.sl, 'copy-trade', noteText);

        // Track as signal for Signal Room
        trackSignal(d.pair, d.dir, d.entry, 'COPY TRADE', Math.round(d.evidence.reduce((a, e) => a + e.conf, 0) / d.evidence.length), noteText);
        incrementTrackedSignals();

        success = true;
        return { ...s, isOpen: false, step: 1, selectedSignalIds: [] };
      });
      return success;
    },
  };
}

export const copyTradeStore = createCopyTradeStore();

// Derived helpers
export const isCopyTradeOpen = derived({ subscribe: copyTradeStore.subscribe }, $s => $s.isOpen);
export const copyTradeStep = derived({ subscribe: copyTradeStore.subscribe }, $s => $s.step);
export const copyTradeDraft = derived({ subscribe: copyTradeStore.subscribe }, $s => $s.draft);
