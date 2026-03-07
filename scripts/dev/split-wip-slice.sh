#!/usr/bin/env bash
set -euo pipefail

usage() {
	echo "Usage: bash scripts/dev/split-wip-slice.sh <slice> [options]"
	echo ""
	echo "Slices:"
	echo "  context-validation-rollup"
	echo "  chartpanel-rf06"
	echo "  runtime-store-hygiene"
	echo "  ui-density-readability"
	echo ""
	echo "Options:"
	echo "  --list                 List available slices"
	echo "  --describe             Print slice manifest and exit"
	echo "  --create-worktree      Create target worktree from base branch if missing"
	echo "  --stage                Stage whole-file carry in target worktree"
	echo "  --dry-run              Print actions without copying files"
	echo "  --skip <path>          Skip a manifest path (repeatable)"
	echo "  --source-dir <path>    Source worktree (default: current repo root)"
	echo "  --target-dir <path>    Target worktree (default: sibling repo worktree)"
	echo "  --base-branch <name>   Base branch for new worktree (default: codex/terminal-uiux-gtm-refine)"
}

ROOT_DIR="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$ROOT_DIR")"
PARENT_DIR="$(dirname "$ROOT_DIR")"

SLICE=""
SOURCE_DIR="$ROOT_DIR"
TARGET_DIR=""
BASE_BRANCH="codex/terminal-uiux-gtm-refine"
CREATE_WORKTREE=0
STAGE_CHANGES=0
DRY_RUN=0
DESCRIBE_ONLY=0
LIST_ONLY=0
SKIP_PATHS=()

while [ "$#" -gt 0 ]; do
	case "$1" in
		--list)
			LIST_ONLY=1
			shift
			;;
		--describe)
			DESCRIBE_ONLY=1
			shift
			;;
		--create-worktree)
			CREATE_WORKTREE=1
			shift
			;;
		--stage)
			STAGE_CHANGES=1
			shift
			;;
		--dry-run)
			DRY_RUN=1
			shift
			;;
		--skip)
			SKIP_PATHS+=("${2:-}")
			shift 2
			;;
		--source-dir)
			SOURCE_DIR="${2:-}"
			shift 2
			;;
		--target-dir)
			TARGET_DIR="${2:-}"
			shift 2
			;;
		--base-branch)
			BASE_BRANCH="${2:-}"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			if [ -z "$SLICE" ]; then
				SLICE="$1"
				shift
			else
				echo "Unknown argument: $1"
				usage
				exit 1
			fi
			;;
	esac
done

list_slices() {
	cat <<'EOF'
context-validation-rollup
chartpanel-rf06
runtime-store-hygiene
ui-density-readability
EOF
}

if [ "$LIST_ONLY" -eq 1 ]; then
	list_slices
	exit 0
fi

if [ -z "$SLICE" ]; then
	usage
	exit 1
fi

SLICE_BRANCH=""
SLICE_PURPOSE=""
WHOLE_FILES=()
MIXED_FILES=()
VALIDATION_CMDS=()
SLICE_NOTES=()

set_manifest() {
	case "$SLICE" in
		context-validation-rollup)
			SLICE_BRANCH="codex/context-validation-rollup"
			SLICE_PURPOSE="Context-system validation hardening with truthful brief/handoff/state artifacts."
			WHOLE_FILES=(
				".githooks/pre-push"
				"README.md"
				"docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md"
				"scripts/dev/context-compact.sh"
				"scripts/dev/post-merge-sync.sh"
				"scripts/dev/sync-branch.sh"
			)
			MIXED_FILES=()
			VALIDATION_CMDS=(
				"npm run docs:check"
				"npm run ctx:check -- --strict"
				"npm run gate"
			)
			SLICE_NOTES=(
				"Do not bulk-copy docs/AGENT_WATCH_LOG.md. Append a fresh finish entry only after the slice validates."
				"After extraction, generate a slice-local checkpoint and compact brief before push."
			)
			;;
		chartpanel-rf06)
			SLICE_BRANCH="codex/chartpanel-rf06"
			SLICE_PURPOSE="ChartPanel RF-06 runtime extraction without the readability sweep."
			WHOLE_FILES=(
				"src/components/arena/chart/chartDrawingSession.ts"
				"src/components/arena/chart/chartOverlayRenderer.ts"
				"src/components/arena/chart/chartPositionInteraction.ts"
				"src/components/arena/chart/chartRuntimeBindings.ts"
				"src/lib/chart/chartHelpers.ts"
			)
			MIXED_FILES=(
				"src/components/arena/ChartPanel.svelte"
				"src/routes/arena/+page.svelte"
				"src/components/arena/PhaseGuide.svelte"
			)
			VALIDATION_CMDS=(
				"npm run check"
				"npm run check:budget"
				"npm run build"
			)
			SLICE_NOTES=(
				"Keep ChartPanel logic/runtime hunks only. Exclude font-size and readability CSS changes."
				"If arena route runes cleanup is strictly required for a green branch, absorb only the minimum logic hunks from the mixed files."
			)
			;;
		runtime-store-hygiene)
			SLICE_BRANCH="codex/runtime-store-hygiene"
			SLICE_PURPOSE="Non-visual runes and persistence cleanup separated from chart refactor and UI polish."
			WHOLE_FILES=(
				"src/lib/utils/storage.ts"
				"src/lib/stores/activeGamesStore.ts"
				"src/lib/stores/agentData.ts"
				"src/lib/stores/communityStore.ts"
				"src/lib/stores/gameState.ts"
				"src/lib/stores/matchHistoryStore.ts"
				"src/lib/stores/pnlStore.ts"
				"src/lib/stores/predictStore.ts"
				"src/lib/stores/quickTradeStore.ts"
				"src/lib/stores/trackedSignalStore.ts"
				"src/lib/stores/walletStore.ts"
				"src/lib/api/gmxApi.ts"
				"src/lib/engine/fewShotBuilder.ts"
				"src/lib/engine/mockArenaData.ts"
				"src/lib/server/marketSnapshotService.ts"
				"src/lib/server/ragService.ts"
				"src/lib/services/scanService.ts"
			)
			MIXED_FILES=(
				"src/routes/arena/+page.svelte"
				"src/components/arena/PhaseGuide.svelte"
			)
			VALIDATION_CMDS=(
				"npm run check"
				"npm run build"
			)
			SLICE_NOTES=(
				"Keep route-local state, derived fixes, and event syntax updates. Exclude readability-only style changes."
				"src/lib/utils/storage.ts does not exist in base 07c893f, so it must be carried explicitly."
			)
			;;
		ui-density-readability)
			SLICE_BRANCH="codex/ui-density-readability"
			SLICE_PURPOSE="Broad readability and density polish isolated from runtime refactors."
			WHOLE_FILES=(
				"src/components/arena-v2/AnalysisScreen.svelte"
				"src/components/arena-v2/BattleCardView.svelte"
				"src/components/arena-v2/BattleChartView.svelte"
				"src/components/arena-v2/BattleMissionView.svelte"
				"src/components/arena-v2/BattleScreen.svelte"
				"src/components/arena-v2/DraftScreen.svelte"
				"src/components/arena-v2/HypothesisScreen.svelte"
				"src/components/arena-v2/ResultScreen.svelte"
				"src/components/arena-v2/shared/PhaseBar.svelte"
				"src/components/arena-war/ActionFeed.svelte"
				"src/components/arena-war/AgentSprite.svelte"
				"src/components/arena-war/AnalyzePhase.svelte"
				"src/components/arena-war/BattleEffects.svelte"
				"src/components/arena-war/BattlePhase.svelte"
				"src/components/arena-war/BattleVisualizer.svelte"
				"src/components/arena-war/DraftPhase.svelte"
				"src/components/arena-war/VSMeterBar.svelte"
				"src/components/arena/BattleStage.svelte"
				"src/components/arena/HypothesisPanel.svelte"
				"src/components/arena/Lobby.svelte"
				"src/components/arena/MatchHistory.svelte"
				"src/components/arena/MVPVote.svelte"
				"src/components/arena/ResultPanel.svelte"
				"src/components/arena/SpeechBubble.svelte"
				"src/components/arena/SquadConfig.svelte"
				"src/components/arena/ViewPicker.svelte"
				"src/components/arena/WarRoomPanel.svelte"
				"src/components/arena/views/AgentArenaView.svelte"
				"src/components/arena/views/CardDuelView.svelte"
				"src/components/arena/views/ChartWarView.svelte"
				"src/components/arena/views/MissionControlView.svelte"
				"src/components/community/OracleLeaderboard.svelte"
				"src/components/live/LivePanel.svelte"
				"src/components/modals/CopyTradeModal.svelte"
				"src/components/modals/OracleModal.svelte"
				"src/components/modals/PassportModal.svelte"
				"src/components/modals/SettingsModal.svelte"
				"src/components/modals/WalletModal.svelte"
				"src/components/shared/ContextBanner.svelte"
				"src/components/shared/EmptyState.svelte"
				"src/components/shared/HPBar.svelte"
				"src/components/shared/NotificationTray.svelte"
				"src/components/shared/P0Banner.svelte"
				"src/components/shared/PartyTray.svelte"
				"src/components/shared/ToastStack.svelte"
				"src/components/shared/TokenDropdown.svelte"
				"src/components/terminal/BottomPanel.svelte"
				"src/components/terminal/DirectionBadge.svelte"
				"src/components/terminal/GmxTradePanel.svelte"
				"src/components/terminal/PolymarketBetPanel.svelte"
				"src/components/terminal/TerminalControlBar.svelte"
				"src/components/terminal/VerdictBanner.svelte"
				"src/components/terminal/VerdictCard.svelte"
				"src/components/terminal/intel/IntelChatSection.svelte"
				"src/components/terminal/intel/IntelFeedNews.svelte"
				"src/components/terminal/intel/IntelFeedOnchain.svelte"
				"src/components/terminal/intel/IntelFeedTrending.svelte"
				"src/components/terminal/intel/IntelPositions.svelte"
				"src/components/terminal/terminalShell.css"
				"src/components/terminal/warroom/warroom.css"
				"src/lib/styles/tokens.css"
				"src/routes/+page.svelte"
				"src/routes/agents/+page.svelte"
				"src/routes/arena-v2/+page.svelte"
				"src/routes/passport/+page.svelte"
				"src/routes/settings/+page.svelte"
				"src/routes/signals/+page.svelte"
			)
			MIXED_FILES=(
				"src/components/arena/ChartPanel.svelte"
				"src/routes/arena/+page.svelte"
				"src/components/arena/PhaseGuide.svelte"
			)
			VALIDATION_CMDS=(
				"npm run check"
				"npm run check:budget"
				"npm run build"
			)
			SLICE_NOTES=(
				"Keep presentational density, spacing, contrast, and typography changes only."
				"Mixed files should contribute CSS/style hunks only; leave runtime logic behind."
			)
			;;
		*)
			echo "Unknown slice: $SLICE"
			list_slices
			exit 1
			;;
	esac
}

set_manifest

if [ -z "$TARGET_DIR" ]; then
	SLUG="${SLICE_BRANCH#codex/}"
	TARGET_DIR="$PARENT_DIR/$REPO_NAME-$SLUG"
fi

describe_manifest() {
	echo "slice: $SLICE"
	echo "branch: $SLICE_BRANCH"
	echo "purpose: $SLICE_PURPOSE"
	echo "base branch: $BASE_BRANCH"
	echo "source dir: $SOURCE_DIR"
	echo "target dir: $TARGET_DIR"
	echo ""
	echo "[whole-file carry]"
	for path in "${WHOLE_FILES[@]}"; do
		echo "$path"
	done
	echo ""
	echo "[mixed files]"
	if [ "${#MIXED_FILES[@]}" -eq 0 ]; then
		echo "(none)"
	else
		for path in "${MIXED_FILES[@]}"; do
			echo "$path"
		done
	fi
	echo ""
	echo "[validation]"
	for cmd in "${VALIDATION_CMDS[@]}"; do
		echo "$cmd"
	done
	echo ""
	echo "[notes]"
	for note in "${SLICE_NOTES[@]}"; do
		echo "- $note"
	done
}

if [ "$DESCRIBE_ONLY" -eq 1 ]; then
	describe_manifest
	exit 0
fi

if [ ! -d "$SOURCE_DIR/.git" ] && [ ! -f "$SOURCE_DIR/.git" ]; then
	echo "Source dir is not a git worktree: $SOURCE_DIR"
	exit 1
fi

ensure_target_worktree() {
	if [ -d "$TARGET_DIR/.git" ] || [ -f "$TARGET_DIR/.git" ]; then
		return 0
	fi
	if [ "$CREATE_WORKTREE" -ne 1 ]; then
		echo "Target worktree missing: $TARGET_DIR"
		echo "Run again with --create-worktree or create it manually first."
		exit 1
	fi
	if [ "$DRY_RUN" -eq 1 ]; then
		echo "[split:$SLICE] would create worktree: $TARGET_DIR ($SLICE_BRANCH from $BASE_BRANCH)"
		return 0
	fi
	bash "$ROOT_DIR/scripts/dev/new-worktree.sh" "${SLICE_BRANCH#codex/}" "$BASE_BRANCH"
}

link_node_modules() {
	local source_node_modules="$SOURCE_DIR/node_modules"
	local target_node_modules="$TARGET_DIR/node_modules"
	if [ ! -e "$source_node_modules" ] || [ -e "$target_node_modules" ]; then
		return 0
	fi
	if [ "$DRY_RUN" -eq 1 ]; then
		echo "[split:$SLICE] would link node_modules -> $source_node_modules"
		return 0
	fi
	ln -s "$source_node_modules" "$target_node_modules"
	echo "[split:$SLICE] linked node_modules"
}

copy_file() {
	local rel_path="$1"
	local src_path="$SOURCE_DIR/$rel_path"
	local dst_path="$TARGET_DIR/$rel_path"
	if [ ! -e "$src_path" ]; then
		echo "[split:$SLICE] missing source path: $rel_path"
		exit 1
	fi
	if [ "$DRY_RUN" -eq 1 ]; then
		echo "[split:$SLICE] would transfer $rel_path"
		return 0
	fi
	mkdir -p "$(dirname "$dst_path")"
	if git -C "$SOURCE_DIR" ls-files --error-unmatch -- "$rel_path" >/dev/null 2>&1; then
		if ! git -C "$SOURCE_DIR" diff --quiet HEAD -- "$rel_path" \
			&& git -C "$TARGET_DIR" ls-files --error-unmatch -- "$rel_path" >/dev/null 2>&1; then
			local patch_file
			patch_file="$(mktemp "/tmp/${SLICE}.XXXXXX")"
			git -C "$SOURCE_DIR" diff --binary HEAD -- "$rel_path" > "$patch_file"
			git -C "$TARGET_DIR" apply --3way --whitespace=nowarn "$patch_file"
			rm -f "$patch_file"
			echo "[split:$SLICE] applied dirty patch $rel_path"
			return 0
		fi
	fi
	cp "$src_path" "$dst_path"
	echo "[split:$SLICE] copied whole file $rel_path"
}

should_skip() {
	local rel_path="$1"
	local skipped
	if [ "${#SKIP_PATHS[@]}" -eq 0 ]; then
		return 1
	fi
	for skipped in "${SKIP_PATHS[@]}"; do
		if [ "$skipped" = "$rel_path" ]; then
			return 0
		fi
	done
	return 1
}

write_pending_note() {
	local pending_dir="$TARGET_DIR/.agent-context/split"
	local pending_file="$pending_dir/${SLICE}.md"
	if [ "$DRY_RUN" -eq 1 ]; then
		echo "[split:$SLICE] would write pending note: $pending_file"
		return 0
	fi
	mkdir -p "$pending_dir"
	{
		echo "# Split Pending"
		echo ""
		echo "- Slice: $SLICE"
		echo "- Branch: $SLICE_BRANCH"
		echo "- Source: $SOURCE_DIR"
		echo "- Target: $TARGET_DIR"
		echo ""
		echo "## Whole-file carry applied"
		for path in "${WHOLE_FILES[@]}"; do
			if should_skip "$path"; then
				continue
			fi
			echo "- $path"
		done
		echo ""
		echo "## Skipped manifest paths"
		if [ "${#SKIP_PATHS[@]}" -eq 0 ]; then
			echo "- none"
		else
			for path in "${SKIP_PATHS[@]}"; do
				echo "- $path"
			done
		fi
		echo ""
		echo "## Mixed files pending manual hunk split"
		if [ "${#MIXED_FILES[@]}" -eq 0 ]; then
			echo "- none"
		else
			for path in "${MIXED_FILES[@]}"; do
				echo "- $path"
			done
		fi
		echo ""
		echo "## Validation gate"
		for cmd in "${VALIDATION_CMDS[@]}"; do
			echo "- $cmd"
		done
		echo ""
		echo "## Notes"
		for note in "${SLICE_NOTES[@]}"; do
			echo "- $note"
		done
	} > "$pending_file"
	echo "[split:$SLICE] wrote pending note: ${pending_file#$TARGET_DIR/}"
}

ensure_target_worktree
link_node_modules

for rel_path in "${WHOLE_FILES[@]}"; do
	if should_skip "$rel_path"; then
		echo "[split:$SLICE] skipped $rel_path"
		continue
	fi
	copy_file "$rel_path"
done

if [ "$STAGE_CHANGES" -eq 1 ] && [ "$DRY_RUN" -ne 1 ]; then
	STAGE_PATHS=()
	for rel_path in "${WHOLE_FILES[@]}"; do
		if should_skip "$rel_path"; then
			continue
		fi
		STAGE_PATHS+=("$rel_path")
	done
	if [ "${#STAGE_PATHS[@]}" -gt 0 ]; then
		git -C "$TARGET_DIR" add -- "${STAGE_PATHS[@]}"
	fi
	echo "[split:$SLICE] staged whole-file carry"
fi

write_pending_note

echo ""
echo "[split:$SLICE] branch: $SLICE_BRANCH"
echo "[split:$SLICE] target: $TARGET_DIR"
echo "[split:$SLICE] mixed files pending: ${#MIXED_FILES[@]}"
if [ "${#MIXED_FILES[@]}" -gt 0 ]; then
	for path in "${MIXED_FILES[@]}"; do
		echo "  - $path"
	done
fi
echo "[split:$SLICE] validation gate:"
for cmd in "${VALIDATION_CMDS[@]}"; do
	echo "  - $cmd"
done
