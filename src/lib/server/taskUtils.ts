/**
 * Fire-and-forget wrapper with error logging.
 * Prevents silent failures in background tasks (RAG saves, activity events, profile syncs).
 */
export function fireAndForget(label: string, task: Promise<unknown>): void {
  task.catch((err: unknown) => {
    console.warn(`[bg:${label}]`, err instanceof Error ? err.message : String(err));
  });
}
