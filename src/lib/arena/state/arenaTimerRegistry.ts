interface CreateArenaTimerRegistryOptions {
  isDestroyed: () => boolean;
}

export function createArenaTimerRegistry(options: CreateArenaTimerRegistryOptions) {
  const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  function scheduleTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      pendingTimeouts.delete(id);
      if (options.isDestroyed()) return;
      fn();
    }, ms);

    pendingTimeouts.add(id);
    return id;
  }

  function clearTimeoutHandle(timer: ReturnType<typeof setTimeout> | null) {
    if (timer) {
      clearTimeout(timer);
      pendingTimeouts.delete(timer);
    }
    return null;
  }

  function destroy() {
    pendingTimeouts.forEach((timer) => clearTimeout(timer));
    pendingTimeouts.clear();
  }

  return {
    clearTimeoutHandle,
    destroy,
    scheduleTimeout,
  };
}
