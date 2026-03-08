import type { SignalAttachment } from '$lib/stores/communityStore';
import { notifySignalTracked } from '$lib/stores/notificationEvents';
import { trackSignal } from '$lib/stores/trackedSignalStore';
import { incrementTrackedSignals } from '$lib/stores/userProfileStore';
import { readonly, writable } from 'svelte/store';
import {
  buildCommunitySignalAttachment,
  formatCommunitySignalPost,
  normalizeCommunitySignalConfidence,
} from './terminalEventMappers';
import type {
  ChartCommunitySignal,
  TerminalSharePrefill,
} from './terminalTypes';

export function createTerminalCommunityRuntime(params: {
  getTimeframeLabel: () => string;
  /** Current pair from gameState */
  getCurrentPair: () => string;
  /** Live price for given pair */
  getLivePrice: (pair: string) => number;
}) {
  const shareModalOpenStore = writable(false);
  const sharePrefillStore = writable<TerminalSharePrefill | null>(null);

  function closeShareModal() {
    shareModalOpenStore.set(false);
    sharePrefillStore.set(null);
  }

  /**
   * Open share modal — with or without prefill data.
   * When called from chart buttons (LONG/SHORT), prefillDetail has full signal data.
   * When called from "📡 공유" button, prefillDetail is undefined → use context hints.
   */
  function openShareModal(prefillDetail?: ChartCommunitySignal | null) {
    // Guard: onclick handlers pass MouseEvent — only accept real ChartCommunitySignal
    const detail =
      prefillDetail &&
      typeof prefillDetail === 'object' &&
      'pair' in prefillDetail &&
      'dir' in prefillDetail
        ? prefillDetail
        : null;
    if (detail) {
      const confidence = normalizeCommunitySignalConfidence(detail.conf);
      const attachment = buildCommunitySignalAttachment(detail, params.getTimeframeLabel(), confidence);
      // evidence가 있으면 attachment에도 포함
      if (detail.evidence) {
        attachment.evidence = detail.evidence;
      }
      sharePrefillStore.set({
        text: formatCommunitySignalPost(detail, params.getTimeframeLabel()),
        signal: detail.dir === 'LONG' ? 'long' : 'short',
        attachment,
        evidence: detail.evidence,
      });
    } else {
      // No chart signal — provide context hints for the form
      const pair = params.getCurrentPair();
      const livePrice = params.getLivePrice(pair);
      sharePrefillStore.set({
        text: '',
        signal: null,
        attachment: null,
        contextPair: pair,
        contextPrice: livePrice > 0 ? livePrice : undefined,
        contextTimeframe: params.getTimeframeLabel(),
      });
    }
    shareModalOpenStore.set(true);
  }

  /**
   * Called AFTER user submits the share form.
   * Handles tracking + notification that was previously done in auto-post.
   */
  function handlePostCompleted(attachment: SignalAttachment | null) {
    if (attachment) {
      trackSignal(attachment.pair, attachment.dir, attachment.entry, 'community', attachment.conf);
      incrementTrackedSignals();
      notifySignalTracked(attachment.pair, attachment.dir);
    }
    closeShareModal();
  }

  /**
   * Receives chart community signal from ChartPanel.
   * Previously auto-posted — now just opens the share modal with prefill.
   */
  function handleChartCommunitySignal(detail: ChartCommunitySignal) {
    if (!detail || !detail.pair || !detail.dir) return;
    if (![detail.entry, detail.tp, detail.sl].every((v) => Number.isFinite(v) && v > 0)) return;
    openShareModal(detail);
  }

  return {
    closeShareModal,
    handleChartCommunitySignal,
    handlePostCompleted,
    openShareModal,
    shareModalOpen: readonly(shareModalOpenStore),
    sharePrefill: readonly(sharePrefillStore),
  };
}
