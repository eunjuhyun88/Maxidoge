interface CreateArenaPhaseTimerRuntimeOptions {
  scheduleTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutHandle: (timer: ReturnType<typeof setTimeout> | null) => null;
}

export function createArenaPhaseTimerRuntime(options: CreateArenaPhaseTimerRuntimeOptions) {
  let hypothesisInterval: ReturnType<typeof setInterval> | null = null;
  let previewAutoTimer: ReturnType<typeof setTimeout> | null = null;
  let pvpRevealTimer: ReturnType<typeof setTimeout> | null = null;

  function clearHypothesisInterval() {
    if (hypothesisInterval) {
      clearInterval(hypothesisInterval);
      hypothesisInterval = null;
    }
  }

  function setHypothesisInterval(interval: ReturnType<typeof setInterval> | null) {
    clearHypothesisInterval();
    hypothesisInterval = interval;
  }

  function clearPreviewAutoTimer() {
    previewAutoTimer = options.clearTimeoutHandle(previewAutoTimer);
  }

  function setPreviewAutoTimer(timer: ReturnType<typeof setTimeout> | null) {
    clearPreviewAutoTimer();
    previewAutoTimer = timer;
  }

  function clearPvpRevealTimer() {
    pvpRevealTimer = options.clearTimeoutHandle(pvpRevealTimer);
  }

  function schedulePvpReveal(fn: () => void, ms: number) {
    clearPvpRevealTimer();
    pvpRevealTimer = options.scheduleTimeout(() => {
      pvpRevealTimer = null;
      fn();
    }, ms);
  }

  function destroy() {
    clearHypothesisInterval();
    clearPreviewAutoTimer();
    clearPvpRevealTimer();
  }

  return {
    clearHypothesisInterval,
    clearPreviewAutoTimer,
    clearPvpRevealTimer,
    destroy,
    schedulePvpReveal,
    setHypothesisInterval,
    setPreviewAutoTimer,
  };
}
