# AGENTS.md

This file defines mandatory execution rules for all coding agents in this repository.

## Mandatory Start Sequence (Every Task)
1. Re-read `/Users/ej/Downloads/maxi-doge-unified/README.md` (section: `Agent Collaboration Protocol (SSOT)`).
2. Append a start entry in `/Users/ej/Downloads/maxidoge-clones/frontend-passport/docs/AGENT_WATCH_LOG.md`.
3. Confirm current branch/worktree and detect overlapping edits before making changes.
4. Reserve a unique work ID using `W-YYYYMMDD-HHMM-<repo>-<agent>`.

## Mandatory Verification Gate (No Exceptions)
1. Run `npm run check` on the working branch.
2. Run `npm run build` on the working branch.
3. If either command fails, stop push/merge and fix errors first.

## Mandatory Finish Sequence
1. Commit and push only after passing check/build.
2. Append finish data in local `docs/AGENT_WATCH_LOG.md`:
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

## Logging Model
- Development log (always): `/Users/ej/Downloads/maxidoge-clones/frontend-passport/docs/AGENT_WATCH_LOG.md`
- Integration log (merge-time only): `/Users/ej/Downloads/maxi-doge-unified/docs/AGENT_WATCH_LOG.md`
- Do not write routine in-progress development entries to the unified log from this clone.

## Source of Truth
- Canonical collaboration and project guide: `/Users/ej/Downloads/maxi-doge-unified/README.md`
- This repo execution rules: `/Users/ej/Downloads/maxidoge-clones/frontend-passport/AGENTS.md`
- `docs/README.md` is a redirect-only compatibility file.
