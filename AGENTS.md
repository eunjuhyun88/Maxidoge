# AGENTS.md

This file defines mandatory execution rules for all coding agents in this repository.

## Mandatory Start Sequence (Every Task)
1. Re-read `/Users/ej/Downloads/maxi-doge-unified/README.md` (section: `Agent Collaboration Protocol (SSOT)`).
2. Append a start entry in `/Users/ej/Downloads/maxi-doge-unified/docs/AGENT_WATCH_LOG.md`.
3. Confirm current branch/worktree and detect overlapping edits before making changes.

## Mandatory Verification Gate (No Exceptions)
1. Run `npm run check` on the working branch.
2. Run `npm run build` on the working branch.
3. If either command fails, stop push/merge and fix errors first.

## Mandatory Finish Sequence
1. Commit and push only after passing check/build.
2. Merge into `main`.
3. On `main`, run `npm run check` and `npm run build` again.
4. Append finish data in `docs/AGENT_WATCH_LOG.md`:
   - What changed
   - Validation results
   - Commit hash
   - Merge hash
   - Push status

## Source of Truth
- Canonical collaboration and project guide: `/Users/ej/Downloads/maxi-doge-unified/README.md`
- `docs/README.md` is a redirect-only compatibility file.
