import {
  fetchPassportLearningStatus,
  fetchPassportLearningDatasets,
  fetchPassportLearningEvals,
  fetchPassportLearningTrainJobs,
  fetchPassportLearningReports,
  runPassportLearningWorker,
  queuePassportRetrainJob,
  generatePassportLearningReport,
  type PassportLearningStatus,
  type PassportDatasetVersion,
  type PassportEvalReport,
  type PassportTrainJob,
  type PassportReport,
} from '$lib/api/passportLearningApi';
import { getErrorMessage } from '$lib/utils/errorUtils';

export interface PassportLearningPanelState {
  statusRemote: PassportLearningStatus | null;
  datasetsRemote: PassportDatasetVersion[];
  evalsRemote: PassportEvalReport[];
  trainJobsRemote: PassportTrainJob[];
  reportsRemote: PassportReport[];
  hydrated: boolean;
  refreshing: boolean;
  actionRunning: boolean;
  actionMessage: string;
  errorMessage: string;
}

interface PassportLearningSummary {
  closedWinRate: number;
  avgWinPnl: number;
  avgLossPnl: number;
  longBiasPct: number;
}

interface CreatePassportLearningPanelControllerOptions {
  getState: () => PassportLearningPanelState;
  setState: (next: PassportLearningPanelState) => void;
  getSummary: () => PassportLearningSummary;
}

export function createPassportLearningPanelState(): PassportLearningPanelState {
  return {
    statusRemote: null,
    datasetsRemote: [],
    evalsRemote: [],
    trainJobsRemote: [],
    reportsRemote: [],
    hydrated: false,
    refreshing: false,
    actionRunning: false,
    actionMessage: '',
    errorMessage: '',
  };
}

export function createPassportLearningPanelController(
  options: CreatePassportLearningPanelControllerOptions
) {
  function updateState(
    updater: Partial<PassportLearningPanelState> | ((state: PassportLearningPanelState) => PassportLearningPanelState)
  ) {
    const current = options.getState();
    const next = typeof updater === 'function'
      ? updater(current)
      : { ...current, ...updater };
    options.setState(next);
  }

  async function hydrate() {
    updateState({
      refreshing: true,
      errorMessage: '',
    });

    try {
      const [status, datasets, evals, jobs, reports] = await Promise.all([
        fetchPassportLearningStatus(),
        fetchPassportLearningDatasets({ limit: 6 }),
        fetchPassportLearningEvals({ limit: 6 }),
        fetchPassportLearningTrainJobs(6),
        fetchPassportLearningReports({ limit: 4 }),
      ]);

      updateState({
        statusRemote: status,
        datasetsRemote: datasets,
        evalsRemote: evals,
        trainJobsRemote: jobs,
        reportsRemote: reports,
        hydrated: true,
        errorMessage: '',
      });
    } catch (error: unknown) {
      updateState({
        hydrated: true,
        errorMessage: getErrorMessage(error) || 'Failed to load learning pipeline',
      });
    } finally {
      updateState({
        refreshing: false,
      });
    }
  }

  async function runAction(
    runner: () => Promise<string | null>,
    fallbackErrorMessage: string
  ) {
    if (options.getState().actionRunning) return;

    updateState({
      actionRunning: true,
      actionMessage: '',
    });

    try {
      const actionMessage = await runner();
      if (!actionMessage) {
        updateState({
          errorMessage: fallbackErrorMessage,
        });
      } else {
        updateState({
          actionMessage,
          errorMessage: '',
        });
      }
    } catch (error: unknown) {
      updateState({
        errorMessage: getErrorMessage(error) || fallbackErrorMessage,
      });
    }

    await hydrate();

    updateState({
      actionRunning: false,
    });
  }

  async function runWorkerNow() {
    await runAction(async () => {
      const worker = await runPassportLearningWorker({
        workerId: `passport-ui:${Date.now()}`,
        limit: 50,
      });
      return worker
        ? `Worker ${worker.workerId} processed ${worker.processed}/${worker.claimed} events`
        : null;
    }, 'Worker run failed. Check auth or DB connection.');
  }

  async function queueRetrainNow() {
    await runAction(async () => {
      const datasetVersionIds = options.getState().datasetsRemote
        .slice(0, 3)
        .map((item) => item.datasetVersionId);
      const job = await queuePassportRetrainJob({
        modelRole: 'policy',
        targetModelVersion: `policy-ui-${Date.now()}`,
        datasetVersionIds,
        triggerReason: 'manual_passport_ui',
      });
      return job ? `Retrain job queued: ${job.targetModelVersion}` : null;
    }, 'Failed to queue retrain job.');
  }

  async function generateReportNow() {
    await runAction(async () => {
      const summary = options.getSummary();
      const report = await generatePassportLearningReport({
        reportType: 'on_demand',
        summary:
          `# Passport AI Report\n\n` +
          `- generated_at: ${new Date().toISOString()}\n` +
          `- closed_win_rate: ${summary.closedWinRate}%\n` +
          `- avg_win: ${summary.avgWinPnl.toFixed(2)}%\n` +
          `- avg_loss: ${summary.avgLossPnl.toFixed(2)}%\n` +
          `- long_bias: ${summary.longBiasPct}%`,
      });
      return report ? `Report generated: ${report.modelVersion}` : null;
    }, 'Failed to generate report draft.');
  }

  return {
    generateReportNow,
    hydrate,
    queueRetrainNow,
    runWorkerNow,
  };
}
