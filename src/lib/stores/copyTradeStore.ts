// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Copy Trade Builder Store
// War Room signal selection → Copy Trade Modal → Publish to Signal Room
// ═══════════════════════════════════════════════════════════════

import { writable, derived, get } from 'svelte/store';
import type { AgentSignal } from '$lib/data/warroom';
import { getConsensus } from '$lib/data/warroom';
import { openQuickTrade, removeQuickTrade, replaceQuickTradeId } from './quickTradeStore';
import { removeTracked, replaceTrackedSignalId, trackSignal } from './trackedSignalStore';
import { hydrateUserProfile } from './userProfileProjectionStore';
import { notifications } from './notificationsStore';
import { publishCopyTradeApi } from '$lib/api/tradingApi';
import type { CopyTradeEvidenceItem, PublishCopyTradeDraft, TradeDirection } from '$lib/contracts/trading';

export interface CopyTradeDraft extends Omit<PublishCopyTradeDraft, 'orderType' | 'marginMode' | 'evidence'> {
  dir: TradeDirection;
  orderType: 'market' | 'limit';
  leverage: number;
  sizePercent: number;
  marginMode: 'cross' | 'isolated';
  evidence: CopyTradeEvidenceItem[];
  note: string;
}

interface CopyTradeState {
  isOpen: boolean;
  step: 1 | 2 | 3;
  selectedSignalIds: string[];
  draft: CopyTradeDraft;
  isPublishing: boolean;
  publishError: string | null;
  publishMutationId: string | null;
}

export interface ExternalCopySignal {
  pair: string;
  dir: TradeDirection;
  entry: number;
  tp: number;
  sl: number;
  conf: number;
  source?: string;
  reason?: string;
}

const defaultDraft: CopyTradeDraft = {
  pair: 'BTC/USDT',
  dir: 'LONG',
  orderType: 'market',
  entry: 0,
  tp: [0],
  sl: 0,
  leverage: 5,
  sizePercent: 50,
  marginMode: 'isolated',
  evidence: [],
  note: '',
};

function cloneDefaultDraft(): CopyTradeDraft {
  return {
    ...defaultDraft,
    tp: [...defaultDraft.tp],
    evidence: [],
  };
}

function createInitialState(): CopyTradeState {
  return {
    isOpen: false,
    step: 1,
    selectedSignalIds: [],
    draft: cloneDefaultDraft(),
    isPublishing: false,
    publishError: null,
    publishMutationId: null,
  };
}

/** WarRoom에서 현재 스캔 시그널 등록 (CopyTrade에서 참조) */
let _registeredSignals: AgentSignal[] = [];
export function registerScanSignals(signals: AgentSignal[]) {
  _registeredSignals = signals;
}

function normalizeSignalPrice(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v);
  if (abs >= 100) return Number(v.toFixed(2));
  return Number(v.toFixed(4));
}

function getDraftConfidence(draft: CopyTradeDraft): number {
  return draft.evidence.length
    ? Math.round(draft.evidence.reduce((sum, item) => sum + item.conf, 0) / draft.evidence.length)
    : 70;
}

function buildPublishNote(draft: CopyTradeDraft): string {
  const evidenceText = draft.evidence
    .map((item) => `${item.icon} ${item.name}: ${item.text} (${item.conf}%)`)
    .join('\n');
  if (!evidenceText) return draft.note.trim();
  return draft.note.trim() ? `${draft.note.trim()}\n\n${evidenceText}` : evidenceText;
}

function validateDraft(draft: CopyTradeDraft): string | null {
  if (!draft.pair.trim()) return 'Pair is required.';
  if (!Number.isFinite(draft.entry) || draft.entry <= 0) return 'Entry price must be greater than 0.';
  if (!Number.isFinite(draft.sl) || draft.sl <= 0) return 'Stop loss must be greater than 0.';
  if (!Array.isArray(draft.tp) || draft.tp.length === 0) return 'At least one take profit target is required.';
  if (draft.tp.some((target) => !Number.isFinite(target) || target <= 0)) {
    return 'All take profit targets must be greater than 0.';
  }
  return null;
}

function createDraftFromSignals(selectedIds: string[], signalPool?: AgentSignal[]): CopyTradeState | null {
  const pool = signalPool ?? _registeredSignals;
  const signals = pool.filter((signal) => selectedIds.includes(signal.id));
  if (signals.length === 0) return null;

  const consensus = getConsensus(signals);
  const primary = signals[0];
  const avgEntry = Math.round(signals.reduce((sum, signal) => sum + signal.entry, 0) / signals.length);
  const tpValues = signals.filter((signal) => signal.vote === consensus.dir.toLowerCase()).map((signal) => signal.tp);
  const slValues = signals.filter((signal) => signal.vote === consensus.dir.toLowerCase()).map((signal) => signal.sl);
  const avgTp = tpValues.length ? Math.round(tpValues.reduce((a, b) => a + b, 0) / tpValues.length) : primary.tp;
  const avgSl = slValues.length ? Math.round(slValues.reduce((a, b) => a + b, 0) / slValues.length) : primary.sl;

  return {
    isOpen: true,
    step: 1,
    selectedSignalIds: [...selectedIds],
    isPublishing: false,
    publishError: null,
    publishMutationId: null,
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
      evidence: signals.map((signal) => ({
        icon: signal.icon,
        name: signal.name,
        text: signal.text,
        conf: signal.conf,
        color: signal.color,
      })),
      note: '',
    },
  };
}

function createDraftFromExternalSignal(signal: ExternalCopySignal): CopyTradeState | null {
  const source = signal.source || 'SIGNAL ROOM';
  const confidence = Number.isFinite(signal.conf) ? Math.max(1, Math.min(100, Math.round(signal.conf))) : 70;
  const entry = normalizeSignalPrice(signal.entry);
  const tp = normalizeSignalPrice(signal.tp);
  const sl = normalizeSignalPrice(signal.sl);
  if (![entry, tp, sl].every((value) => Number.isFinite(value) && value > 0)) return null;

  return {
    isOpen: true,
    step: 1,
    selectedSignalIds: [],
    isPublishing: false,
    publishError: null,
    publishMutationId: null,
    draft: {
      pair: signal.pair,
      dir: signal.dir,
      orderType: 'market',
      entry,
      tp: [tp],
      sl,
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
  };
}

function createCopyTradeStore() {
  const store = writable<CopyTradeState>(createInitialState());

  return {
    subscribe: store.subscribe,

    openModal(selectedIds: string[], signalPool?: AgentSignal[]) {
      const nextState = createDraftFromSignals(selectedIds, signalPool);
      if (!nextState) return;
      store.set(nextState);
    },

    openFromSignal(signal: ExternalCopySignal) {
      const nextState = createDraftFromExternalSignal(signal);
      if (!nextState) return;
      store.set(nextState);
    },

    closeModal() {
      store.update((state) => {
        if (state.isPublishing) return state;
        return { ...state, isOpen: false, step: 1, selectedSignalIds: [], publishError: null, publishMutationId: null };
      });
    },

    nextStep() {
      store.update((state) => {
        if (state.isPublishing) return state;
        return { ...state, step: Math.min(state.step + 1, 3) as 1 | 2 | 3, publishError: null };
      });
    },

    prevStep() {
      store.update((state) => {
        if (state.isPublishing) return state;
        return { ...state, step: Math.max(state.step - 1, 1) as 1 | 2 | 3, publishError: null };
      });
    },

    updateDraft(partial: Partial<CopyTradeDraft>) {
      store.update((state) => {
        if (state.isPublishing) return state;
        return { ...state, draft: { ...state.draft, ...partial }, publishError: null, publishMutationId: null };
      });
    },

    addTpTarget() {
      store.update((state) => {
        if (state.isPublishing || state.draft.tp.length >= 3) return state;
        const lastTp = state.draft.tp[state.draft.tp.length - 1];
        const diff = Math.abs(state.draft.entry - lastTp);
        const nextTp = state.draft.dir === 'LONG'
          ? lastTp + Math.round(diff * 0.5)
          : lastTp - Math.round(diff * 0.5);
        return {
          ...state,
          draft: { ...state.draft, tp: [...state.draft.tp, nextTp] },
          publishError: null,
          publishMutationId: null,
        };
      });
    },

    removeTpTarget(index: number) {
      store.update((state) => {
        if (state.isPublishing || state.draft.tp.length <= 1) return state;
        return {
          ...state,
          draft: { ...state.draft, tp: state.draft.tp.filter((_, i) => i !== index) },
          publishError: null,
          publishMutationId: null,
        };
      });
    },

    async publishSignal(): Promise<boolean> {
      if (typeof window === 'undefined') return false;

      const current = get(store);
      if (current.isPublishing) return false;

      const validationError = validateDraft(current.draft);
      if (validationError) {
        store.update((state) => ({ ...state, step: 3, publishError: validationError }));
        return false;
      }

      const noteText = buildPublishNote(current.draft);
      const confidence = getDraftConfidence(current.draft);
      const clientMutationId = current.publishMutationId ?? crypto.randomUUID();
      const payloadDraft: CopyTradeDraft = {
        ...current.draft,
        tp: [...current.draft.tp],
        evidence: current.draft.evidence.map((item) => ({ ...item })),
        note: noteText,
        source: 'copy-trade',
      };
      const selectedSignalIds = [...current.selectedSignalIds];

      const localTradeId = openQuickTrade(
        payloadDraft.pair,
        payloadDraft.dir,
        payloadDraft.entry,
        payloadDraft.tp[0] ?? null,
        payloadDraft.sl,
        'copy-trade',
        payloadDraft.note,
        false
      );
      if (!localTradeId) {
        store.update((state) => ({
          ...state,
          step: 3,
          publishError: 'TP/SL configuration is invalid for the selected direction.',
        }));
        return false;
      }

      const localSignalId: string = trackSignal(
        payloadDraft.pair,
        payloadDraft.dir,
        payloadDraft.entry,
        'COPY TRADE',
        confidence,
        payloadDraft.note,
        false
      );

      store.update((state) => ({
        ...state,
        isPublishing: true,
        publishError: null,
        publishMutationId: clientMutationId,
      }));

      try {
        const result = await publishCopyTradeApi({
          selectedSignalIds,
          draft: payloadDraft,
          confidence,
          clientMutationId,
        });

        if (!result) {
          throw new Error('Failed to publish copy trade');
        }

        replaceQuickTradeId(localTradeId, result.trade.id, {
          pair: result.trade.pair,
          dir: result.trade.dir,
          entry: result.trade.entry,
          tp: result.trade.tp,
          sl: result.trade.sl,
          currentPrice: result.trade.currentPrice,
          pnlPercent: result.trade.pnlPercent,
          status: result.trade.status,
          openedAt: result.trade.openedAt,
          closedAt: result.trade.closedAt,
          closePnl: result.trade.closePnl,
          source: result.trade.source,
          note: result.trade.note,
        });

        replaceTrackedSignalId(localSignalId, result.signal.id, {
          pair: result.signal.pair,
          dir: result.signal.dir,
          source: result.signal.source,
          note: result.signal.note,
          confidence: result.signal.confidence,
          entryPrice: result.signal.entryPrice,
          currentPrice: result.signal.currentPrice,
          pnlPercent: result.signal.pnlPercent,
          status: result.signal.status,
          trackedAt: result.signal.trackedAt,
          expiresAt: result.signal.expiresAt,
        });

        store.set(createInitialState());
        void hydrateUserProfile(true);
        return true;
      } catch {
        removeQuickTrade(localTradeId);
        removeTracked(localSignalId);

        const publishError = 'Failed to publish copy trade. Check your session or try again.';
        store.update((state) => ({
          ...state,
          isPublishing: false,
          publishError,
          step: 3,
        }));

        notifications.addNotification({
          type: 'alert',
          title: 'COPY TRADE PUBLISH FAILED',
          body: 'Server publish did not complete. No trade or signal was persisted.',
          dismissable: true,
        });
        return false;
      }
    },
  };
}

export const copyTradeStore = createCopyTradeStore();

export const isCopyTradeOpen = derived({ subscribe: copyTradeStore.subscribe }, ($state) => $state.isOpen);
export const copyTradeStep = derived({ subscribe: copyTradeStore.subscribe }, ($state) => $state.step);
export const copyTradeDraft = derived({ subscribe: copyTradeStore.subscribe }, ($state) => $state.draft);
export const copyTradeIsPublishing = derived({ subscribe: copyTradeStore.subscribe }, ($state) => $state.isPublishing);
export const copyTradePublishError = derived({ subscribe: copyTradeStore.subscribe }, ($state) => $state.publishError);
