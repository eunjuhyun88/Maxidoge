# Practical Context Validation

This file explains how to prove that the context system is helping during real work, not just in structural reports.

## Goal

A context system is only useful if it changes behavior in live tasks.

For this repo, that means proving at least four things:

1. agents open fewer docs before the first correct edit
2. agents resume faster after a context break
3. at least some measured runs show positive time saved versus a believable baseline
4. at least some measured runs leave observable file-change evidence, not just synthetic telemetry events

## Representative Task Protocol

Use representative work, not toy tasks.

Good candidates:

- one bug fix in an existing surface
- one medium feature edit that crosses route/store/API boundaries
- one resume-after-break task where the agent must recover context from repo artifacts

Prefer measuring from a known git baseline:

- same commit for routed and baseline comparisons
- clean worktree if possible
- if the worktree is already dirty, note that explicitly in the run summary

For each task:

1. start a measured run
2. log doc opens and discovery events before the first edit
3. log `first_edit` when the first meaningful code change begins
4. finish the run with a believable `--baseline-minutes`
5. if possible, also record a routed-vs-baseline comparison
6. make sure the run actually leaves changed files or changed first-edit paths by the time the run finishes

## Minimum Real-Work Loop

```bash
npm run agent:start -- --agent planner --surface terminal --task-id "TASK-001"
npm run agent:event -- --type doc_open --path docs/README.md
npm run agent:event -- --type registry_query --note "search: terminal"
npm run agent:event -- --type retrieve_query --note "arena chart ownership"
npm run agent:event -- --type first_edit --path src/components/arena/ChartPanel.svelte
npm run agent:finish -- --status success --baseline-minutes 20
npm run agent:report
```

If you can compare routed mode and baseline mode for the same task, also record:

```bash
npm run eval:ab:record -- \
  --task-id "TASK-001" \
  --surface "terminal" \
  --routed-docs 3 \
  --baseline-docs 9 \
  --routed-minutes 3 \
  --baseline-minutes 8
npm run eval:ab:refresh
```

## What Counts As Good Evidence

- at least 3 finished measured runs
- at least 1 run with baseline minutes captured
- at least 1 run with observable edit evidence
- at least 1 run with positive time saved
- average docs before first edit at or below the configured target
- at least 1 routed-vs-baseline win

The exact thresholds live in `context-kit.json` under `evaluation.validation`.

## Validation Report

Generate the practical verdict with:

```bash
npm run eval:validate
```

Then read:

- `docs/generated/context-validation-report.md`
- `docs/generated/agent-usage-report.md`
- `docs/generated/context-ab-report.md`
- `docs/generated/context-efficiency-report.md`

## Interpretation

- `PASS`
  - structural routing is healthy and there is enough real task evidence
- `NEEDS EVIDENCE`
  - the structure may be fine, but the repo has not recorded enough live work yet
- `FAIL`
  - the measured evidence is below the configured threshold

## Anti-Patterns

- logging one synthetic toy run and calling it proof
- logging events without leaving any real file-change evidence
- using unrealistic baseline minutes
- comparing routed mode and baseline mode on different commits
- recording doc opens but not logging `first_edit`
- treating structural savings alone as proof of actual productivity
