# AGENTS.md

This file defines mandatory execution rules for all coding agents in this repository.

## Mandatory Start Sequence (Every Task)
1. Re-read `/Users/ej/Downloads/maxi-doge-unified/README.md` (section: `Agent Collaboration Protocol (SSOT)`).
2. Append a start entry in `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md`.
3. Confirm current branch/worktree and detect overlapping edits before making changes.
4. Run `npm run safe:status` and include the result in the start log.
5. Reserve a unique work ID using `W-YYYYMMDD-HHMM-<repo>-<agent>`.
6. Context snapshot is auto-triggered by `safe:status` (`ctx:auto` hook).
   - If automation is disabled, run manually:
     - `npm run ctx:save -- --title "<task>" --work-id "<W-ID>" --agent "<agent>"`

## Mandatory Branch/Sync Policy
1. Implement only on `codex/*` branches. Direct development on `main` is prohibited.
2. Run `npm run safe:sync` before first edit and again before push.
3. Integration into `main` must go through PR merge flow (squash/rebase), not local direct push.
4. Keep pre-push hook active via `npm run safe:hooks`.

## Mandatory Verification Gate (No Exceptions)
1. Run `npm run check` on the working branch.
2. Run `npm run build` on the working branch.
3. If either command fails, stop push/merge and fix errors first.

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
2. Append finish data in `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md`:
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

## Logging Model
- Development log (always): `/Users/ej/Downloads/maxidoge-clones/integration/docs/AGENT_WATCH_LOG.md`
- Integration log (merge-time only): `/Users/ej/Downloads/maxi-doge-unified/docs/AGENT_WATCH_LOG.md`
- Do not write routine in-progress development entries to the unified log from this clone.

## Source of Truth
- Canonical collaboration and project guide: `/Users/ej/Downloads/maxi-doge-unified/README.md`
- This repo execution rules: `/Users/ej/Downloads/maxidoge-clones/integration/AGENTS.md`
- `docs/README.md` is a redirect-only compatibility file.
