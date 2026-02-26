# AGENTS.md

This file defines mandatory execution rules for all coding agents in this repository.

## Mandatory Start Sequence (Every Task)
1. Re-read `/Users/ej/Downloads/maxi-doge-unified/README.md` (section: `Agent Collaboration Protocol (SSOT)`).
2. Run `git status --short --branch` and confirm current branch/worktree state.
3. Reserve a unique work ID using `W-YYYYMMDD-HHMM-<repo>-<agent>`.
4. Append a START entry in `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md` with:
   - Repo path
   - Branch
   - Base `origin/main` hash
   - Working tree status
   - Task summary
   - Overlap/conflict check result
5. Do not start edits on `main`. Work must run on `codex/<task-name>` branch.

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

## Mandatory Verification Gate (No Exceptions)
1. Run `npm run check` on the working branch.
2. Run `npm run build` on the working branch.
3. If either command fails, stop push/merge and fix errors first.

## Mandatory Finish Sequence
1. Commit and push only after passing check/build.
2. Append FINISH data in `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md`:
   - What changed
   - Validation results
   - Commit hash
   - Push status
   - Final working tree status
3. If this task is merged into `main`, run `npm run check` and `npm run build` again on `main`.
4. If this task is merged into `main`, append an integration summary in `/Users/ej/Downloads/maxi-doge-unified/docs/AGENT_WATCH_LOG.md`:
   - What changed (summary)
   - Validation results on `main`
   - Merge hash
   - Push status
5. Push/merge actions require explicit user request or approval.

## Logging Model
- Development log (always): `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md`
- Integration log (merge-time only): `/Users/ej/Downloads/maxi-doge-unified/docs/AGENT_WATCH_LOG.md`
- Do not write routine in-progress development entries to the unified log from this clone.

## Source of Truth
- Canonical collaboration and project guide: `/Users/ej/Downloads/maxi-doge-unified/README.md`
- This repo execution rules: `/Users/ej/Downloads/maxidoge-clones/integration/AGENTS.md`
- `docs/README.md` is a redirect-only compatibility file.
