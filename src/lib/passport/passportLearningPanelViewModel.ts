import type { PassportLearningPanelState } from '$lib/passport/passportLearningPanelController';

export type PassportLearningPipelineState =
  | 'ATTENTION'
  | 'BOOTSTRAP'
  | 'LOCAL_ONLY'
  | 'RUNNING'
  | 'SYNCED';

export function hasPassportLearningOps(state: PassportLearningPanelState): boolean {
  return Boolean(
    state.statusRemote ||
    state.datasetsRemote.length ||
    state.evalsRemote.length ||
    state.trainJobsRemote.length ||
    state.reportsRemote.length
  );
}

export function buildPassportLearningPipelineState(
  state: PassportLearningPanelState
): PassportLearningPipelineState {
  const status = state.statusRemote;
  if (!status) return 'LOCAL_ONLY';
  if (status.outbox.failed > 0 || status.trainJobs.failed > 0) return 'ATTENTION';
  if (status.outbox.processing > 0 || status.trainJobs.running > 0) return 'RUNNING';
  if (status.latestDataset) return 'SYNCED';
  return 'BOOTSTRAP';
}

export function buildPassportLearningStatusLine(state: PassportLearningPanelState): string {
  const status = state.statusRemote;
  if (!status) {
    return 'Learning backend is not connected for this user/session yet.';
  }

  return `Outbox P:${status.outbox.pending} / R:${status.outbox.processing} / F:${status.outbox.failed} · Jobs Q:${status.trainJobs.queued} / Run:${status.trainJobs.running} / OK:${status.trainJobs.succeeded}`;
}
