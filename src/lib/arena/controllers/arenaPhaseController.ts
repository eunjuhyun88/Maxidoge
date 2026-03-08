import type { AnalyzeResponse } from '$lib/api/arenaApi';
import type { Direction, Phase } from '$lib/stores/gameState';

export interface ArenaHypothesisSubmitInput {
  dir: Direction;
  conf: number;
  tf: string;
  vmode: 'tpsl' | 'close';
  closeN: number;
  tags: string[];
  reason: string;
  entry: number;
  tp: number;
  sl: number;
  rr: number;
}

interface CreateArenaPhaseControllerOptions {
  onDraftEnter: () => void;
  getSpeed: () => number;
  getCurrentPrice: () => number;
  getServerMatchId: () => string | null;
  runAnalysisSync?: (matchId: string) => Promise<AnalyzeResponse>;
  setServerAnalysis: (analysis: AnalyzeResponse) => void;
  applyAnalysisProjection: (analysis: AnalyzeResponse) => void;
  onAnalysisEnter: () => void;
  onAnalysisError: (error: unknown) => void;
  onHypothesisEnter: () => void;
  setHypothesisVisible: (value: boolean) => void;
  setFloatDir: (value: 'LONG' | 'SHORT' | null) => void;
  getHypothesisTimer: () => number;
  setHypothesisTimer: (value: number) => void;
  clearHypothesisInterval: () => void;
  setHypothesisInterval: (interval: ReturnType<typeof setInterval> | null) => void;
  applyNeutralTimeoutSelection: (price: number) => void;
  applySubmittedHypothesis: (selection: ArenaHypothesisSubmitInput) => void;
  submitHypothesisSync?: (dir: 'LONG' | 'SHORT' | 'NEUTRAL', conf: number) => Promise<void>;
  onHypothesisSyncError: (error: unknown) => void;
  advancePhase: () => void;
  setPreviewVisible: (value: boolean) => void;
  onPreviewEnter: () => void;
  clearPreviewAutoTimer: () => void;
  setPreviewAutoTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
  onPreviewConfirm: () => void;
  onBattleEnter: () => void;
  onResultEnter: () => void;
}

export function createArenaPhaseController(options: CreateArenaPhaseControllerOptions) {
  function initDraft() {
    options.onDraftEnter();
  }

  function initAnalysis() {
    options.onAnalysisEnter();

    const serverMatchId = options.getServerMatchId();
    if (!serverMatchId || !options.runAnalysisSync) return;

    options.runAnalysisSync(serverMatchId)
      .then((analysis) => {
        options.setServerAnalysis(analysis);
        options.applyAnalysisProjection(analysis);
      })
      .catch((error) => {
        options.onAnalysisError(error);
      });
  }

  function initHypothesis() {
    options.setHypothesisVisible(true);
    options.setFloatDir(null);
    options.onHypothesisEnter();

    const speed = options.getSpeed();
    options.setHypothesisTimer(Math.round(30 / speed));
    options.clearHypothesisInterval();

    const interval = setInterval(() => {
      const nextTimer = options.getHypothesisTimer() - 1;
      options.setHypothesisTimer(nextTimer);

      if (nextTimer > 0) return;

      options.clearHypothesisInterval();
      options.setHypothesisVisible(false);
      options.applyNeutralTimeoutSelection(options.getCurrentPrice());
      options.advancePhase();
    }, 1000);

    options.setHypothesisInterval(interval);
  }

  function initPreview() {
    options.setPreviewVisible(true);
    options.onPreviewEnter();
    options.clearPreviewAutoTimer();

    const previewTimer = setTimeout(() => {
      confirmPreview();
    }, 5000 / options.getSpeed());

    options.setPreviewAutoTimer(previewTimer);
  }

  function confirmPreview() {
    options.clearPreviewAutoTimer();
    options.setPreviewVisible(false);
    options.onPreviewConfirm();
    options.advancePhase();
  }

  function submitHypothesis(selection: ArenaHypothesisSubmitInput) {
    options.clearHypothesisInterval();
    options.setHypothesisVisible(false);
    options.applySubmittedHypothesis(selection);

    const serverMatchId = options.getServerMatchId();
    if (serverMatchId && options.submitHypothesisSync) {
      const dirMap: Record<string, 'LONG' | 'SHORT' | 'NEUTRAL'> = {
        LONG: 'LONG',
        SHORT: 'SHORT',
        NEUTRAL: 'NEUTRAL',
      };
      void options.submitHypothesisSync(dirMap[selection.dir] || 'NEUTRAL', selection.conf)
        .catch((error) => {
          options.onHypothesisSyncError(error);
        });
    }

    initPreview();
  }

  function onPhaseInit(phase: Phase) {
    switch (phase) {
      case 'DRAFT':
        initDraft();
        break;
      case 'ANALYSIS':
        initAnalysis();
        break;
      case 'HYPOTHESIS':
        initHypothesis();
        break;
      case 'BATTLE':
        options.onBattleEnter();
        break;
      case 'RESULT':
        options.onResultEnter();
        break;
    }
  }

  return {
    confirmPreview,
    initDraft,
    initAnalysis,
    initHypothesis,
    initPreview,
    onPhaseInit,
    submitHypothesis,
  };
}
