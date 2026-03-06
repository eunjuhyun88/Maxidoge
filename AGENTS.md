# AGENTS.md

This file defines mandatory execution rules for all coding agents in this repository.

## Mandatory Start Sequence (Every Task)
1. Re-read `/Users/ej/Downloads/maxi-doge-unified/README.md` (section: `Agent Collaboration Protocol (SSOT)`).
2. Re-read `/Users/ej/Downloads/maxidoge-clones/frontend/docs/README.md` and load only the docs relevant to the current surface/task.
   - Do not start with `docs/archive/*`, old audits, or sibling clone folders unless the active docs explicitly send you there.
3. If the task changes architecture, state ownership, contracts, or product behavior, read `/Users/ej/Downloads/maxidoge-clones/frontend/ARCHITECTURE.md` and the relevant canonical doc under `docs/`.
4. Run `git status --short --branch` and confirm current branch/worktree state.
5. Reserve a unique work ID using `W-YYYYMMDD-HHMM-<repo>-<agent>`.
6. Append a START entry in `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md` with:
   - Repo path
   - Branch
   - Base `origin/main` hash
   - Working tree status
   - Task summary
   - Overlap/conflict check result
7. Run `npm run safe:status` and include the result in the start log.
8. Context snapshot is auto-triggered by `safe:status` (`ctx:auto` hook).
   - If automation is disabled, run manually:
     - `npm run ctx:save -- --title "<task>" --work-id "<W-ID>" --agent "<agent>"`
9. Do not start edits on `main`. Work must run on `codex/<task-name>` branch.

## Mandatory Branch/Sync Policy
1. `main` is always protected:
   - No direct push to `main`
   - No rebase on `main`
   - No force push on `main`
2. Personal branch rule:
   - Use `codex/<task-name>` format
   - Rebase is allowed on personal branch only
   - After rebase, push with `--force-with-lease` only with explicit user approval
3. Shared branch rule:
   - Rebase prohibited
   - Force push prohibited
   - Sync latest `main` by merge only
4. Before PR/merge, fetch and sync from latest remote:
   - `git fetch origin --prune`
   - Personal branch: rebase or merge allowed
   - Shared branch: merge only
5. Run `npm run safe:sync` before first edit and again before push.
6. Keep pre-push hook active via `npm run safe:hooks`.

## Mandatory Verification Gate (No Exceptions)
1. Run `npm run docs:check` on the working branch.
2. Run `npm run check` on the working branch.
3. Run `npm run build` on the working branch.
4. If either command fails, stop push/merge and fix errors first.

## Mandatory Context Budgeting (Multi-Agent)
1. Automatic context save/compact runs at:
   - `safe:status`
   - `safe:sync` (start/end)
   - `pre-push`
   - `post-merge`
2. Manual fallback (when automation disabled/fails):
   - `npm run ctx:save -- --title "<handoff>" --work-id "<W-ID>" --agent "<agent>"`
   - `npm run ctx:compact`
3. Restore command must always disambiguate mode:
   - `npm run ctx:restore -- --mode context`
   - `npm run ctx:restore -- --mode files`
4. Keep `.agent-context/` local-only (gitignored). Never commit runtime snapshots or secret notes.

## Mandatory Finish Sequence
1. Commit and push only after passing check/build.
2. Append FINISH data in `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md`:
   - What changed
   - Validation results
   - Commit hash
   - Push status
   - Final working tree status
3. Confirm context compaction exists for handoff (`.agent-context/compact/*-latest.md`).
   - If missing, run `npm run ctx:compact`.
4. If this task is merged into `main`, run `npm run check` and `npm run build` again on `main`.
5. If this task is merged into `main`, append an integration summary in `/Users/ej/Downloads/maxi-doge-unified/docs/AGENT_WATCH_LOG.md`:
   - What changed (summary)
   - Validation results on `main`
   - Merge hash
   - Push status
6. If the task changed architecture, surface behavior, or authority boundaries, update the relevant canonical doc under `docs/`, not only the watch log.
7. Push/merge actions require explicit user request or approval.

## Logging Model
- Development log (always): `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md`
- Integration log (merge-time only): `/Users/ej/Downloads/maxi-doge-unified/docs/AGENT_WATCH_LOG.md`
- Do not write routine in-progress development entries to the unified log from this clone.

## Source of Truth
- Canonical collaboration and project guide: `/Users/ej/Downloads/maxi-doge-unified/README.md`
- This repo execution rules: `/Users/ej/Downloads/maxidoge-clones/integration/AGENTS.md`
- Root architecture map: `/Users/ej/Downloads/maxidoge-clones/frontend/ARCHITECTURE.md`
- Task-level docs router: `/Users/ej/Downloads/maxidoge-clones/frontend/docs/README.md`
- Canonical docs layer: `docs/{DESIGN,FRONTEND,PLANS,PRODUCT_SENSE,QUALITY_SCORE,RELIABILITY,SECURITY}.md`
- Historical/reference-only docs: `/Users/ej/Downloads/maxidoge-clones/frontend/docs/archive/`
- Sibling clone folders are not canonical implementation targets.

## Recommended Model Routing
- Preferred setup:
  - `gpt5.2 xhigh` for TL tasks (planning, review, orchestration).
  - `gpt-5.3-codex xhigh` for execution tasks (implementation, fix, integration).
- Principle:
  - Keep strategic reasoning and implementation execution split for higher throughput and lower coordination noise.
