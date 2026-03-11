#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './context-registry-lib.mjs';

const rootDir = process.cwd();
const checkMode = process.argv.includes('--check');
const config = readJson(path.join(rootDir, 'context-kit.json'));
const outputMarkdownPath = path.join(rootDir, 'docs/generated/context-validation-report.md');
const outputJsonPath = path.join(rootDir, 'docs/generated/context-validation-report.json');

function writeManaged(filePath, content) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (checkMode) {
    if (existing !== content) {
      throw new Error(`[context-validation] stale generated file: ${path.relative(rootDir, filePath)}`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function listAbRecords() {
  const evalDir = path.join(rootDir, '.agent-context/evaluations/tasks');
  if (!fs.existsSync(evalDir)) return [];
  return fs.readdirSync(evalDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(evalDir, name)))
    .filter((item) => item && item.taskId);
}

function statusForThreshold(actual, comparator, target) {
  if (actual === null || typeof actual === 'undefined' || Number.isNaN(actual)) return 'NEEDS EVIDENCE';
  if (comparator === '>=') return actual >= target ? 'PASS' : 'FAIL';
  if (comparator === '<=') return actual <= target ? 'PASS' : 'FAIL';
  return 'FAIL';
}

function evidenceCountStatus(actual, target) {
  if (actual === null || typeof actual === 'undefined' || Number.isNaN(actual) || actual <= 0) {
    return 'NEEDS EVIDENCE';
  }
  return actual >= target ? 'PASS' : 'NEEDS EVIDENCE';
}

function renderTarget(comparator, value, suffix = '') {
  return `${comparator} ${value}${suffix}`;
}

function formatNumber(value, digits = 2) {
  if (value === null || typeof value === 'undefined' || Number.isNaN(value)) return 'n/a';
  return Number(value).toFixed(digits);
}

const efficiency = readJson(path.join(rootDir, 'docs/generated/context-efficiency-report.json'));
const usage = readJson(path.join(rootDir, config.telemetry?.reportPath ?? 'docs/generated/agent-usage-report.json'));
const registry = readJson(path.join(rootDir, config.registry?.manifestPath ?? 'docs/generated/context-registry.json'));
const retrieval = readJson(path.join(rootDir, config.retrieval?.indexPath ?? 'docs/generated/contextual-retrieval-index.json'));
const abRecords = listAbRecords();

const validationTargets = {
  minFinishedRuns: Number(config.evaluation?.validation?.minFinishedRuns ?? 3),
  minRunsWithBaseline: Number(config.evaluation?.validation?.minRunsWithBaseline ?? 1),
  minRunsWithEditEvidence: Number(config.evaluation?.validation?.minRunsWithEditEvidence ?? 1),
  minPositiveTimeSavedRuns: Number(config.evaluation?.validation?.minPositiveTimeSavedRuns ?? 1),
  minEstimatedTimeSavedMinutes: Number(config.evaluation?.validation?.minEstimatedTimeSavedMinutes ?? 5),
  maxAverageDocsBeforeFirstEdit: Number(config.evaluation?.validation?.maxAverageDocsBeforeFirstEdit ?? config.evaluation?.ab?.targetDocsBeforeFirstEdit ?? 6),
  minRoutedWins: Number(config.evaluation?.validation?.minRoutedWins ?? 1),
  minSurfaceCount: Number(config.evaluation?.validation?.minSurfaceCount ?? 1),
  minRetrievalChunks: Number(config.evaluation?.validation?.minRetrievalChunks ?? 1),
};

const runs = Array.isArray(usage.runs) ? usage.runs : [];
const finishedRuns = Number(usage.finishedRunCount ?? 0);
const baselineInstrumentedRuns = runs.filter((run) => run.metrics?.baselineMinutes !== null && typeof run.metrics?.baselineMinutes !== 'undefined').length;
const runsWithEditEvidence = runs.filter((run) =>
  Number(run.metrics?.newChangedPathCountSinceStart ?? 0) > 0 ||
  Number(run.metrics?.firstEditPathChangedCount ?? 0) > 0
).length;
const positiveTimeSavedRuns = runs.filter((run) => (run.metrics?.timeSavedMinutes ?? 0) > 0).length;
const totalEstimatedTimeSavedMinutes = usage.totalEstimatedTimeSavedMinutes ?? null;
const averageDocsBeforeFirstEdit = usage.averageDocsBeforeFirstEdit ?? null;
const routedWins = abRecords.filter((record) => record.routedWin).length;
const surfaceCount = Array.isArray(registry.surfaces) ? registry.surfaces.length : 0;
const retrievalChunks = Number(retrieval.chunkCount ?? 0);

const scorecard = [
  {
    label: 'Structural routing gate',
    actual: efficiency.structuralReady === true ? 'PASS' : (efficiency.structuralReady === false ? 'FAIL' : 'NEEDS EVIDENCE'),
    target: 'PASS',
    result: efficiency.structuralReady === true ? 'PASS' : (efficiency.structuralReady === false ? 'FAIL' : 'NEEDS EVIDENCE'),
    evidence: efficiency.structuralReady === true ? 'context-efficiency structural gate passed' : 'run docs:refresh and docs:check',
  },
  {
    label: 'Finished measured runs',
    actual: `${finishedRuns}`,
    target: renderTarget('>=', validationTargets.minFinishedRuns),
    result: evidenceCountStatus(finishedRuns, validationTargets.minFinishedRuns),
    evidence: `${finishedRuns} finished runs recorded`,
  },
  {
    label: 'Runs with baseline minutes',
    actual: `${baselineInstrumentedRuns}`,
    target: renderTarget('>=', validationTargets.minRunsWithBaseline),
    result: evidenceCountStatus(baselineInstrumentedRuns, validationTargets.minRunsWithBaseline),
    evidence: `${baselineInstrumentedRuns} runs captured baseline minutes`,
  },
  {
    label: 'Runs with edit evidence',
    actual: `${runsWithEditEvidence}`,
    target: renderTarget('>=', validationTargets.minRunsWithEditEvidence),
    result: evidenceCountStatus(runsWithEditEvidence, validationTargets.minRunsWithEditEvidence),
    evidence: `${runsWithEditEvidence} runs left observable file-change evidence`,
  },
  {
    label: 'Positive time-saved runs',
    actual: `${positiveTimeSavedRuns}`,
    target: renderTarget('>=', validationTargets.minPositiveTimeSavedRuns),
    result: evidenceCountStatus(positiveTimeSavedRuns, validationTargets.minPositiveTimeSavedRuns),
    evidence: `${positiveTimeSavedRuns} runs show positive time saved`,
  },
  {
    label: 'Total estimated time saved',
    actual: formatNumber(totalEstimatedTimeSavedMinutes),
    target: renderTarget('>=', validationTargets.minEstimatedTimeSavedMinutes, ' min'),
    result: finishedRuns < validationTargets.minFinishedRuns
      ? 'NEEDS EVIDENCE'
      : statusForThreshold(totalEstimatedTimeSavedMinutes, '>=', validationTargets.minEstimatedTimeSavedMinutes),
    evidence: `${formatNumber(totalEstimatedTimeSavedMinutes)} minutes estimated saved`,
  },
  {
    label: 'Average docs before first edit',
    actual: formatNumber(averageDocsBeforeFirstEdit),
    target: renderTarget('<=', validationTargets.maxAverageDocsBeforeFirstEdit),
    result: finishedRuns < validationTargets.minFinishedRuns
      ? 'NEEDS EVIDENCE'
      : statusForThreshold(averageDocsBeforeFirstEdit, '<=', validationTargets.maxAverageDocsBeforeFirstEdit),
    evidence: `${formatNumber(averageDocsBeforeFirstEdit)} average docs before first edit`,
  },
  {
    label: 'Routed-vs-baseline wins',
    actual: `${routedWins}`,
    target: renderTarget('>=', validationTargets.minRoutedWins),
    result: evidenceCountStatus(routedWins, validationTargets.minRoutedWins),
    evidence: `${routedWins}/${abRecords.length} routed wins`,
  },
  {
    label: 'Discoverable surfaces',
    actual: `${surfaceCount}`,
    target: renderTarget('>=', validationTargets.minSurfaceCount),
    result: statusForThreshold(surfaceCount, '>=', validationTargets.minSurfaceCount),
    evidence: `${surfaceCount} surfaces visible in registry`,
  },
  {
    label: 'Retrieval index available',
    actual: `${retrievalChunks}`,
    target: renderTarget('>=', validationTargets.minRetrievalChunks),
    result: statusForThreshold(retrievalChunks, '>=', validationTargets.minRetrievalChunks),
    evidence: `${retrievalChunks} indexed retrieval chunks`,
  },
];

const hasFail = scorecard.some((item) => item.result === 'FAIL');
const hasNeedsEvidence = scorecard.some((item) => item.result === 'NEEDS EVIDENCE');
const validationGate = hasFail ? 'FAIL' : (hasNeedsEvidence ? 'NEEDS EVIDENCE' : 'PASS');

const nextSteps = [];
if (finishedRuns < validationTargets.minFinishedRuns) nextSteps.push(`Record at least ${validationTargets.minFinishedRuns - finishedRuns} more finished measured runs.`);
if (baselineInstrumentedRuns < validationTargets.minRunsWithBaseline) nextSteps.push('Finish at least one run with `--baseline-minutes` so time-saved evidence is not empty.');
if (runsWithEditEvidence < validationTargets.minRunsWithEditEvidence) nextSteps.push('Record at least one run that leaves real file-change evidence, not only synthetic events.');
if (routedWins < validationTargets.minRoutedWins) nextSteps.push('Record at least one routed-vs-baseline comparison with `npm run eval:ab:record`.');
if (averageDocsBeforeFirstEdit === null) nextSteps.push('Log `doc_open` and `first_edit` events during real work so focus metrics are measurable.');
if (surfaceCount < validationTargets.minSurfaceCount) nextSteps.push('Populate `context-kit.json` surfaces and refresh the registry.');
if (retrievalChunks < validationTargets.minRetrievalChunks) nextSteps.push('Expand canonical docs and rerun `npm run retrieve:refresh` or `npm run docs:refresh`.');

const summary = {
  version: 1,
  validationGate,
  targets: validationTargets,
  evidence: {
    structuralReady: efficiency.structuralReady ?? null,
    finishedRuns,
    baselineInstrumentedRuns,
    runsWithEditEvidence,
    positiveTimeSavedRuns,
    totalEstimatedTimeSavedMinutes,
    averageDocsBeforeFirstEdit,
    routedWins,
    abComparisons: abRecords.length,
    surfaceCount,
    retrievalChunks,
  },
  scorecard,
  nextSteps,
};

const markdown = [
  '# Context Validation Report',
  '',
  'This report answers the practical question: is the context system producing enough real-world evidence to claim that it saves time and reduces navigation cost?',
  '',
  '## Validation Gate',
  '',
  `- ${validationGate}`,
  '',
  '## Scorecard',
  '',
  '| Check | Actual | Target | Result | Evidence |',
  '| --- | --- | --- | --- | --- |',
  ...scorecard.map((item) => `| ${item.label} | ${item.actual} | ${item.target} | ${item.result} | ${item.evidence} |`),
  '',
  '## Current Evidence',
  '',
  `- Finished runs: \`${finishedRuns}\``,
  `- Baseline-instrumented runs: \`${baselineInstrumentedRuns}\``,
  `- Positive time-saved runs: \`${positiveTimeSavedRuns}\``,
  `- Total estimated time saved: \`${formatNumber(totalEstimatedTimeSavedMinutes)}\` minutes`,
  `- Average docs before first edit: \`${formatNumber(averageDocsBeforeFirstEdit)}\``,
  `- Routed wins: \`${routedWins}\` of \`${abRecords.length}\` comparisons`,
  `- Registry surfaces: \`${surfaceCount}\``,
  `- Retrieval chunks: \`${retrievalChunks}\``,
  '',
  '## Interpretation',
  '',
  '- `PASS` means the repo has both structural evidence and real task evidence.',
  '- `NEEDS EVIDENCE` means the system may be working, but you have not measured enough real tasks yet.',
  '- `FAIL` means measured behavior is currently below the configured threshold.',
  '',
  '## Recommended Next Steps',
  '',
  ...(nextSteps.length ? nextSteps.map((item) => `- ${item}`) : ['- No immediate evidence gaps. Keep recording representative tasks.']),
  '',
  '## Related Reports',
  '',
  '- `docs/generated/context-efficiency-report.md`',
  '- `docs/generated/agent-usage-report.md`',
  '- `docs/generated/context-ab-report.md`',
  '- `docs/generated/context-value-demo.md`',
  '',
].join('\n') + '\n';

writeManaged(outputJsonPath, `${JSON.stringify(summary, null, 2)}\n`);
writeManaged(outputMarkdownPath, markdown);

if (!checkMode) {
  console.log(`[context-validation] wrote ${path.relative(rootDir, outputMarkdownPath)}`);
  console.log(`[context-validation] gate=${validationGate}`);
}
