<script lang="ts">
  import type {
    PassportLearningPanelController,
    PassportLearningPanelState,
  } from '$lib/passport/passportLearningPanelController';
  import {
    buildPassportLearningPipelineState,
    buildPassportLearningStatusLine,
    hasPassportLearningOps,
  } from '$lib/passport/passportLearningPanelViewModel';
  import {
    compactSummary,
    evalMetricsPreview,
    formatAgo,
    formatDateTime,
    statusColor,
  } from './passportHelpers';

  interface Props {
    controller: PassportLearningPanelController;
    panelState: PassportLearningPanelState;
  }

  let {
    controller,
    panelState,
  }: Props = $props();

  const statusRemote = $derived(panelState.statusRemote);
  const datasetsRemote = $derived(panelState.datasetsRemote);
  const evalsRemote = $derived(panelState.evalsRemote);
  const trainJobsRemote = $derived(panelState.trainJobsRemote);
  const reportsRemote = $derived(panelState.reportsRemote);
  const hydrated = $derived(panelState.hydrated);
  const refreshing = $derived(panelState.refreshing);
  const actionRunning = $derived(panelState.actionRunning);
  const actionMessage = $derived(panelState.actionMessage);
  const errorMessage = $derived(panelState.errorMessage);
  const opsConnected = $derived(hasPassportLearningOps(panelState));
  const pipelineState = $derived(buildPassportLearningPipelineState(panelState));
  const latestStatusLine = $derived(buildPassportLearningStatusLine(panelState));
</script>

<section class="passport-learning-panel">
  <div class="learning-section-header">AI LEARNING PIPELINE</div>

  <div class="learning-actions">
    <button class="learning-btn sync" onclick={() => controller.hydrate()} disabled={refreshing}>
      {refreshing ? 'REFRESHING...' : 'REFRESH'}
    </button>
    <button class="learning-btn worker" onclick={() => controller.runWorkerNow()} disabled={actionRunning}>
      RUN WORKER
    </button>
    <button class="learning-btn retrain" onclick={() => controller.queueRetrainNow()} disabled={actionRunning}>
      QUEUE RETRAIN
    </button>
    <button class="learning-btn report" onclick={() => controller.generateReportNow()} disabled={actionRunning}>
      GENERATE REPORT
    </button>
  </div>

  {#if actionMessage}
    <div class="learning-info">{actionMessage}</div>
  {/if}

  {#if errorMessage}
    <div class="learning-error">{errorMessage}</div>
  {/if}

  <div class="learning-metrics">
    <div class="learning-card">
      <div class="learning-card-icon">📦</div>
      <div class="learning-card-value" style="color:{statusColor(pipelineState)}">{pipelineState}</div>
      <div class="learning-card-label">PIPELINE</div>
    </div>
    <div class="learning-card">
      <div class="learning-card-icon">⏳</div>
      <div class="learning-card-value">{statusRemote?.outbox.pending ?? 0}</div>
      <div class="learning-card-label">OUTBOX PENDING</div>
    </div>
    <div class="learning-card">
      <div class="learning-card-icon">🛠️</div>
      <div class="learning-card-value">{statusRemote?.trainJobs.running ?? 0}</div>
      <div class="learning-card-label">TRAIN RUNNING</div>
    </div>
    <div class="learning-card">
      <div class="learning-card-icon">🧾</div>
      <div class="learning-card-value">{reportsRemote.length}</div>
      <div class="learning-card-label">REPORTS</div>
    </div>
  </div>

  <div class="learning-summary">{latestStatusLine}</div>

  <details class="learning-detail">
    <summary>LEARNING REPORTS ({reportsRemote.length})</summary>
    {#if reportsRemote.length === 0}
      <div class="learning-empty">
        {hydrated
          ? 'No report snapshot yet. Use GENERATE REPORT to create the first analysis.'
          : 'Loading reports...'}
      </div>
    {:else}
      {#each reportsRemote as report (report.reportId)}
        <div class="learning-row">
          <div class="learning-row-main">
            <span class="learning-title">{report.reportType.toUpperCase()}</span>
            <span class="learning-chip">{report.modelName}:{report.modelVersion}</span>
          </div>
          <div class="learning-row-meta">
            <span class="learning-status" style="color:{statusColor(report.status)}">{report.status.toUpperCase()}</span>
            <span class="learning-time">{formatDateTime(report.createdAt)}</span>
          </div>
        </div>
        <div class="learning-preview">{compactSummary(report.summary)}</div>
      {/each}
    {/if}
  </details>

  <details class="learning-detail">
    <summary>DATASETS ({datasetsRemote.length})</summary>
    {#if datasetsRemote.length === 0}
      <div class="learning-empty">No dataset versions found yet.</div>
    {:else}
      {#each datasetsRemote as dataset (dataset.datasetVersionId)}
        <div class="learning-row">
          <div class="learning-row-main">
            <span class="learning-title">{dataset.versionLabel}</span>
            <span class="learning-chip">{dataset.datasetType.toUpperCase()} · {dataset.sampleCount} samples</span>
          </div>
          <div class="learning-row-meta">
            <span class="learning-status" style="color:{statusColor(dataset.status)}">{dataset.status.toUpperCase()}</span>
            <span class="learning-time">{formatAgo(dataset.createdAt)}</span>
          </div>
        </div>
      {/each}
    {/if}
  </details>

  <details class="learning-detail">
    <summary>TRAIN JOBS ({trainJobsRemote.length})</summary>
    {#if trainJobsRemote.length === 0}
      <div class="learning-empty">No train jobs yet.</div>
    {:else}
      {#each trainJobsRemote as job (job.trainJobId)}
        <div class="learning-row">
          <div class="learning-row-main">
            <span class="learning-title">{job.trainType.toUpperCase()} · {job.modelRole.toUpperCase()}</span>
            <span class="learning-chip">{job.targetModelVersion}</span>
          </div>
          <div class="learning-row-meta">
            <span class="learning-status" style="color:{statusColor(job.status)}">{job.status.toUpperCase()}</span>
            <span class="learning-time">{formatAgo(job.createdAt)}</span>
          </div>
        </div>
      {/each}
    {/if}
  </details>

  <details class="learning-detail">
    <summary>EVAL REPORTS ({evalsRemote.length})</summary>
    {#if evalsRemote.length === 0}
      <div class="learning-empty">No evaluation reports yet.</div>
    {:else}
      {#each evalsRemote as evalReport (evalReport.evalId)}
        <div class="learning-row">
          <div class="learning-row-main">
            <span class="learning-title">{evalReport.evalScope.toUpperCase()}</span>
            <span class="learning-chip">{evalReport.modelVersion}</span>
          </div>
          <div class="learning-row-meta">
            <span class="learning-status" style="color:{statusColor(evalReport.gateResult)}">{evalReport.gateResult.toUpperCase()}</span>
            <span class="learning-time">{formatAgo(evalReport.createdAt)}</span>
          </div>
        </div>
        <div class="learning-preview">{evalMetricsPreview(evalReport.metrics)}</div>
      {/each}
    {/if}
  </details>

  {#if !opsConnected && hydrated}
    <div class="learning-empty">
      Learning pipeline rows are empty. This is expected before outbox worker and first train/report cycle.
    </div>
  {/if}
</section>

<style>
  .passport-learning-panel {
    border: 1px solid var(--sp-soft);
    border-radius: 12px;
    padding: var(--sp-space-5);
    background: rgba(0, 0, 0, 0.44);
  }

  .learning-section-header {
    margin-bottom: var(--sp-space-3);
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 12px;
    letter-spacing: 0.12px;
    border-left: 3px solid var(--sp-pk);
    padding-left: 8px;
  }

  .learning-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-space-2);
  }

  .learning-btn {
    min-height: 34px;
    border-radius: 999px;
    border: 1px solid var(--sp-soft);
    padding: 0 12px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--sp-w);
    font-family: var(--fp);
    font-size: 10px;
    letter-spacing: 0.1px;
    cursor: pointer;
    transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
  }

  .learning-btn:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.08);
  }

  .learning-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
  }

  .learning-btn.sync {
    border-color: rgba(139, 216, 255, 0.34);
  }

  .learning-btn.worker {
    border-color: rgba(255, 208, 96, 0.34);
  }

  .learning-btn.retrain {
    border-color: rgba(255, 140, 59, 0.34);
  }

  .learning-btn.report {
    border-color: rgba(157, 205, 185, 0.34);
  }

  .learning-info,
  .learning-error,
  .learning-empty {
    margin-top: var(--sp-space-2);
    border-radius: 8px;
    padding: var(--sp-space-2) var(--sp-space-3);
    font-family: var(--fm);
    font-size: 11px;
    line-height: 1.35;
  }

  .learning-info {
    color: #a9f0ff;
    border: 1px solid rgba(139, 216, 255, 0.28);
    background: rgba(139, 216, 255, 0.08);
  }

  .learning-error {
    color: #ffd2ca;
    border: 1px solid rgba(255, 114, 93, 0.34);
    background: rgba(255, 114, 93, 0.08);
  }

  .learning-empty {
    color: var(--sp-dim);
    border: 1px dashed var(--sp-soft);
    background: rgba(255, 255, 255, 0.02);
  }

  .learning-metrics {
    margin-top: 8px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-space-3);
  }

  .learning-card {
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    padding: var(--sp-space-3) var(--sp-space-2);
    text-align: center;
  }

  .learning-card-icon {
    font-size: 16px;
    margin-bottom: 6px;
  }

  .learning-card-value {
    color: var(--sp-w);
    font-family: var(--fd);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
  }

  .learning-card-label {
    margin-top: 4px;
    color: var(--sp-dim);
    font-family: var(--fp);
    font-size: 9px;
    letter-spacing: 0.08px;
  }

  .learning-summary {
    margin-top: var(--sp-space-3);
    padding: var(--sp-space-2) var(--sp-space-3);
    border-radius: 8px;
    border: 1px dashed var(--sp-soft);
    color: var(--sp-w);
    text-align: center;
    font-family: var(--fm);
    font-size: 12px;
  }

  .learning-detail {
    margin-top: var(--sp-space-2);
    border: 1px solid var(--sp-soft);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
  }

  .learning-detail summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    padding: var(--sp-space-2) var(--sp-space-3);
    color: var(--sp-pk-l);
    font-family: var(--fp);
    font-size: 11px;
    letter-spacing: 0.08px;
    border-bottom: 1px solid transparent;
  }

  .learning-detail[open] summary {
    border-bottom-color: var(--sp-soft);
    background: rgba(255, 140, 121, 0.08);
  }

  .learning-detail summary::-webkit-details-marker {
    display: none;
  }

  .learning-detail summary::before {
    content: '▸';
    margin-right: 7px;
    display: inline-block;
    transition: transform 0.12s ease;
  }

  .learning-detail[open] summary::before {
    transform: rotate(90deg);
  }

  .learning-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-space-2);
    padding: var(--sp-space-2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 7px;
  }

  .learning-row:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .learning-row-main,
  .learning-row-meta {
    display: flex;
    align-items: center;
    gap: var(--sp-space-2);
    min-width: 0;
  }

  .learning-row-meta {
    flex-shrink: 0;
  }

  .learning-title {
    color: var(--sp-w);
    font-family: var(--fm);
    font-size: 12px;
    font-weight: 700;
  }

  .learning-chip {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    white-space: nowrap;
  }

  .learning-status {
    font-family: var(--fd);
    font-size: 12px;
    min-width: 56px;
    text-align: right;
  }

  .learning-time {
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 11px;
  }

  .learning-preview {
    margin: 0 var(--sp-space-3) var(--sp-space-3);
    border-radius: 7px;
    border: 1px solid var(--sp-soft);
    background: rgba(0, 0, 0, 0.2);
    padding: var(--sp-space-2) var(--sp-space-3);
    color: var(--sp-dim);
    font-family: var(--fm);
    font-size: 11px;
    line-height: 1.35;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @media (max-width: 768px) {
    .passport-learning-panel {
      padding: var(--sp-space-2);
      border-radius: 9px;
    }

    .learning-actions {
      gap: var(--sp-space-1);
    }

    .learning-btn {
      min-height: 32px;
      padding: 0 8px;
      font-size: 9px;
    }

    .learning-metrics {
      gap: var(--sp-space-2);
    }

    .learning-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .learning-row-meta {
      width: 100%;
      justify-content: space-between;
    }
  }

  @media (max-width: 480px) {
    .learning-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-space-1);
    }

    .learning-card {
      padding: var(--sp-space-2) var(--sp-space-1);
    }

    .learning-card-icon {
      font-size: 13px;
      margin-bottom: 4px;
    }

    .learning-card-value {
      font-size: 14px;
    }

    .learning-card-label {
      font-size: var(--sc-fs-2xs, 9px);
    }

    .learning-summary {
      font-size: 11px;
      padding: var(--sp-space-1) var(--sp-space-2);
    }

    .learning-detail summary {
      font-size: 10px;
      padding: var(--sp-space-1) var(--sp-space-2);
    }

    .learning-title {
      font-size: 11px;
    }

    .learning-chip {
      font-size: 9px;
      padding: 2px 6px;
    }

    .learning-status {
      font-size: 11px;
      min-width: 48px;
    }
  }
</style>
