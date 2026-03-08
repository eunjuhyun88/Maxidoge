# WIP Branch Split Plan

Date: 2026-03-06
Status: active
Source branch: `codex/terminal-uiux-gtm-wip`
Base branch for splits: `codex/terminal-uiux-gtm-refine` (`07c893f`)
Work ID: `W-20260306-2209-frontend-codex`
Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`

## Goal

Turn the current mixed WIP branch into reviewable, ship-safe slices without losing validated work or flattening unrelated changes into one commit.

## Confirmed State

1. `codex/terminal-uiux-gtm-wip` is currently `12 ahead / 0 behind` vs `origin/main`, but has no upstream configured.
2. The working tree is dirty across context-system files, chart refactor files, arena/store hygiene files, and broad UI readability updates.
3. The local validation baseline is green:
   - `npm run docs:check`: PASS
   - `npm run ctx:check -- --strict`: PASS
   - `npm run gate`: PASS
4. The current branch is not a clean ship surface because unrelated domains are mixed.
5. The current WIP commit stack is not cherry-pick-safe as a unit:
   - `283ba7c` already mixes docs, scripts, chart, terminal, stores, server, and route work.
   - `001e653`, `3bc53c4`, `d9bf887` are smaller but still sit on top of that mixed base.

## Invariants

1. `codex/terminal-uiux-gtm-wip` remains the scratch/source branch until the split is complete.
2. Do not reset, rewrite, or discard the source worktree.
3. Split by behavior and validation boundary, not by raw file count.
4. `docs/AGENT_WATCH_LOG.md` must be appended per target slice; do not bulk-port unrelated finish logs into a new slice branch.
5. `src/components/arena/ChartPanel.svelte`, `src/routes/arena/+page.svelte`, and `src/components/arena/PhaseGuide.svelte` require hunk-level splitting because logic and UI density changes are mixed in the same file.

## Why The Split Must Be File/Hunk Driven

The current source branch contains three different kinds of changes at once:

- context-system validation hardening
- ChartPanel RF-06 extraction work
- broad readability/runes/storage hygiene

The mixed `283ba7c` checkpoint commit means commit-level replay would reintroduce unrelated domains into every target branch.
The split must therefore be driven from the current source tree using exact file groups and selective hunks.

## Target Slice Set

### Slice A — Context Validation Rollup

Target branch:
- `codex/context-validation-rollup`

Purpose:
- Ship only the context-system hardening that records real validation state into brief/handoff/state artifacts.

Whole-file carry:
- `.githooks/pre-push`
- `README.md`
- `docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md`
- `scripts/dev/context-compact.sh`
- `scripts/dev/post-merge-sync.sh`
- `scripts/dev/sync-branch.sh`

Special handling:
- `docs/AGENT_WATCH_LOG.md`
  - Do not copy the current dirty file wholesale.
  - Append a fresh finish entry only for the context-validation slice after that branch passes validation.

Validation gate:
- `npm run docs:check`
- `npm run ctx:check -- --strict`
- `npm run gate`

Exit condition:
- latest brief/handoff/state on the target branch show `docs:check/check/build/gate = pass`
- no chart/UI-density files are included in the diff

### Slice B — ChartPanel RF-06 Extraction

Target branch:
- `codex/chartpanel-rf06`

Purpose:
- Preserve the ChartPanel decomposition work as a coherent refactor slice.

Whole-file carry from source branch:
- `src/components/arena/chart/chartDrawingSession.ts`
- `src/components/arena/chart/chartOverlayRenderer.ts`
- `src/components/arena/chart/chartPositionInteraction.ts`
- `src/components/arena/chart/chartRuntimeBindings.ts`

Supporting file:
- `src/lib/chart/chartHelpers.ts`
  - keep the typed `GTMWindow` cleanup with the chart slice

Hunk-split files:
- `src/components/arena/ChartPanel.svelte`
  - Keep:
    - imports of `chartPositionInteraction` and `chartRuntimeBindings`
    - `runChartCleanup()`
    - drag/hover/wheel logic using `resolvePositionInteractionTarget()` and `getNextPositionWheelPrice()`
    - runtime binding setup via `bindChartRuntimeInteractions()`
    - cleanup consolidation in `onDestroy`
  - Exclude:
    - 8px -> 9px font-size changes
    - cosmetic readability-only CSS adjustments

Optional validation backstop:
- If Slice B alone fails `npm run check` because arena route runes cleanup is still missing, absorb only the minimal logic hunks from Slice C:
  - `src/routes/arena/+page.svelte`
  - `src/components/arena/PhaseGuide.svelte`

Validation gate:
- `npm run check`
- `npm run check:budget`
- `npm run build`

Exit condition:
- `ChartPanel.svelte` becomes smaller in responsibility without bundling the UI density sweep
- no global typography sweep files are included unless they are strictly required for validation

### Slice C — Runtime / Store Hygiene

Target branch:
- `codex/runtime-store-hygiene`

Purpose:
- Separate the non-visual safety cleanup from both context and ChartPanel work.

Whole-file carry:
- `src/lib/utils/storage.ts`
- `src/lib/stores/activeGamesStore.ts`
- `src/lib/stores/agentData.ts`
- `src/lib/stores/communityStore.ts`
- `src/lib/stores/gameState.ts`
- `src/lib/stores/matchHistoryStore.ts`
- `src/lib/stores/pnlStore.ts`
- `src/lib/stores/predictStore.ts`
- `src/lib/stores/quickTradeStore.ts`
- `src/lib/stores/trackedSignalStore.ts`
- `src/lib/stores/walletStore.ts`
- `src/lib/api/gmxApi.ts`
- `src/lib/engine/fewShotBuilder.ts`
- `src/lib/engine/mockArenaData.ts`
- `src/lib/server/marketSnapshotService.ts`
- `src/lib/server/ragService.ts`
- `src/lib/services/scanService.ts`

Hunk-split files:
- `src/routes/arena/+page.svelte`
  - Keep:
    - `$state(...)` conversion for mutable route-local UI state
    - `missionText` derived replacement
    - `state -> gs` runes-safe migration
    - `on:click` -> `onclick` event updates needed for Svelte 5 warnings/build
  - Exclude:
    - font-size/color readability tuning in the style block
- `src/components/arena/PhaseGuide.svelte`
  - Keep:
    - `$effect` timer cleanup return
  - Exclude:
    - `.pg-action` font-size change

Validation gate:
- `npm run check`
- `npm run build`

Exit condition:
- store persistence boilerplate is centralized behind `src/lib/utils/storage.ts`
- route/runtime hygiene is green without pulling in broad UI density changes

### Slice D — UI Density / Readability

Target branch:
- `codex/ui-density-readability`

Purpose:
- Isolate the broad UI polish pass so it can be reviewed as a design/readability change instead of smuggling through refactor branches.

Whole-file carry:
- `src/components/arena-v2/AnalysisScreen.svelte`
- `src/components/arena-v2/BattleCardView.svelte`
- `src/components/arena-v2/BattleChartView.svelte`
- `src/components/arena-v2/BattleMissionView.svelte`
- `src/components/arena-v2/BattleScreen.svelte`
- `src/components/arena-v2/DraftScreen.svelte`
- `src/components/arena-v2/HypothesisScreen.svelte`
- `src/components/arena-v2/ResultScreen.svelte`
- `src/components/arena-v2/shared/PhaseBar.svelte`
- `src/components/arena-war/ActionFeed.svelte`
- `src/components/arena-war/AgentSprite.svelte`
- `src/components/arena-war/AnalyzePhase.svelte`
- `src/components/arena-war/BattleEffects.svelte`
- `src/components/arena-war/BattlePhase.svelte`
- `src/components/arena-war/BattleVisualizer.svelte`
- `src/components/arena-war/DraftPhase.svelte`
- `src/components/arena-war/VSMeterBar.svelte`
- `src/components/arena/BattleStage.svelte`
- `src/components/arena/HypothesisPanel.svelte`
- `src/components/arena/Lobby.svelte`
- `src/components/arena/MatchHistory.svelte`
- `src/components/arena/ResultPanel.svelte`
- `src/components/arena/SpeechBubble.svelte`
- `src/components/arena/SquadConfig.svelte`
- `src/components/arena/ViewPicker.svelte`
- `src/components/arena/WarRoomPanel.svelte`
- `src/components/arena/MVPVote.svelte`
- `src/components/arena/views/AgentArenaView.svelte`
- `src/components/arena/views/CardDuelView.svelte`
- `src/components/arena/views/ChartWarView.svelte`
- `src/components/arena/views/MissionControlView.svelte`
- `src/components/community/OracleLeaderboard.svelte`
- `src/components/live/LivePanel.svelte`
- `src/components/modals/CopyTradeModal.svelte`
- `src/components/modals/OracleModal.svelte`
- `src/components/modals/PassportModal.svelte`
- `src/components/modals/SettingsModal.svelte`
- `src/components/modals/WalletModal.svelte`
- `src/components/shared/ContextBanner.svelte`
- `src/components/shared/EmptyState.svelte`
- `src/components/shared/HPBar.svelte`
- `src/components/shared/NotificationTray.svelte`
- `src/components/shared/P0Banner.svelte`
- `src/components/shared/PartyTray.svelte`
- `src/components/shared/ToastStack.svelte`
- `src/components/shared/TokenDropdown.svelte`
- `src/components/terminal/BottomPanel.svelte`
- `src/components/terminal/DirectionBadge.svelte`
- `src/components/terminal/GmxTradePanel.svelte`
- `src/components/terminal/PolymarketBetPanel.svelte`
- `src/components/terminal/TerminalControlBar.svelte`
- `src/components/terminal/VerdictBanner.svelte`
- `src/components/terminal/VerdictCard.svelte`
- `src/components/terminal/intel/IntelChatSection.svelte`
- `src/components/terminal/intel/IntelFeedNews.svelte`
- `src/components/terminal/intel/IntelFeedOnchain.svelte`
- `src/components/terminal/intel/IntelFeedTrending.svelte`
- `src/components/terminal/intel/IntelPositions.svelte`
- `src/components/terminal/terminalShell.css`
- `src/components/terminal/warroom/warroom.css`
- `src/lib/styles/tokens.css`
- `src/routes/+page.svelte`
- `src/routes/agents/+page.svelte`
- `src/routes/arena-v2/+page.svelte`
- `src/routes/passport/+page.svelte`
- `src/routes/settings/+page.svelte`
- `src/routes/signals/+page.svelte`

Hunk-split files:
- `src/components/arena/ChartPanel.svelte`
  - UI density / readability CSS hunks only
- `src/routes/arena/+page.svelte`
  - style-block font-size / color tuning only
- `src/components/arena/PhaseGuide.svelte`
  - `.pg-action` font-size hunk only

Validation gate:
- `npm run check`
- `npm run check:budget`
- `npm run build`

Exit condition:
- reviewers can assess readability/perf policy separately from runtime refactors
- the diff remains almost entirely presentational

## Recommended Execution Order

1. Slice A — context-system validation rollup
2. Slice B — ChartPanel RF-06 extraction
3. Slice C — runtime/store hygiene
4. Slice D — UI density/readability

Reason:
- Slice A is already validation-backed and smallest.
- Slice B contains the highest-complexity logic extraction and should be reviewed before broad polish.
- Slice C is medium-risk but lower review noise than Slice B.
- Slice D is intentionally the broadest and most subjective; it should be last.

## Worktree / Branch Creation

Create clean split branches from `codex/terminal-uiux-gtm-refine`:

```bash
npm run safe:split -- context-validation-rollup --describe
npm run safe:split -- context-validation-rollup --create-worktree --stage
npm run safe:split -- chartpanel-rf06 --describe
npm run safe:split -- runtime-store-hygiene --describe
npm run safe:split -- ui-density-readability --describe
```

The helper script:

- creates the target worktree when requested
- links `node_modules` from the source worktree when the target does not have one yet
- copies whole-file carry from the source worktree
- writes `.agent-context/split/<slice>.md` in the target worktree with mixed-file and validation follow-ups

## Extraction Rules

1. Source of truth is the current source worktree, not just `codex/terminal-uiux-gtm-wip` HEAD.
   - committed files can be restored from branch history
   - dirty tracked files need a patch or manual hunk transfer
   - untracked files must be copied explicitly

2. For whole-file carry, prefer the slice helper so the file manifest stays canonical:

```bash
npm run safe:split -- <slice> --create-worktree --stage
```

3. For committed source files, prefer:

```bash
git restore --source=codex/terminal-uiux-gtm-wip -- <path...>
```

4. For dirty tracked files, export path-scoped patches from the source worktree:

```bash
git diff -- <path...> > /tmp/<slice>.patch
```

Then apply only the intended hunks in the target branch.

5. For untracked files, copy them from the source worktree path into the target worktree and review before commit.

6. Never copy `docs/AGENT_WATCH_LOG.md` wholesale between slices.
   - append a new slice-specific finish entry after that target branch validates

## Definition Of Done

The split is complete only when:

1. Slice A, B, C, and D each exist on their own branch.
2. Each slice passes its own declared validation gate.
3. No slice contains obviously unrelated files from another slice.
4. The source scratch branch can be retired or rebased only after the extracted slices are safely preserved elsewhere.
