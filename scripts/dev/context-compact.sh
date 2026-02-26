#!/usr/bin/env bash
set -euo pipefail

usage() {
	echo "Usage: bash scripts/dev/context-compact.sh [--source <snapshot.md>] [--max-lines <n>] [--out <file>]"
	echo ""
	echo "Example:"
	echo "  npm run ctx:compact"
	echo "  npm run ctx:compact -- --max-lines 120"
}

sanitize() {
	printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g'
}

extract_section() {
	local source="$1"
	local header="$2"
	awk -v h="## $header" '
		$0 == h {in_section=1; next}
		in_section && /^## / {exit}
		in_section {print}
	' "$source"
}

trim_non_empty() {
	local limit="$1"
	awk 'NF {print}' | head -n "$limit"
}

SOURCE_FILE=""
MAX_LINES=140
OUT_FILE=""

while [ "$#" -gt 0 ]; do
	case "$1" in
		--source)
			SOURCE_FILE="${2:-}"
			shift 2
			;;
		--max-lines)
			MAX_LINES="${2:-140}"
			shift 2
			;;
		--out)
			OUT_FILE="${2:-}"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1"
			usage
			exit 1
			;;
	esac
done

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BRANCH_SAFE="$(sanitize "${BRANCH//\//-}")"
BASE_DIR="$ROOT_DIR/.agent-context"
SNAPSHOT_DIR="$BASE_DIR/snapshots/$BRANCH_SAFE"
COMPACT_DIR="$BASE_DIR/compact"
PINNED_FILE="$BASE_DIR/pinned-facts.md"
mkdir -p "$COMPACT_DIR"

if [ -z "$SOURCE_FILE" ]; then
	SOURCE_FILE="$(ls -1t "$SNAPSHOT_DIR"/*.md 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$SOURCE_FILE" ] || [ ! -f "$SOURCE_FILE" ]; then
	echo "[ctx:compact] no snapshot found."
	echo "[ctx:compact] run: npm run ctx:save -- --title '<task>'"
	exit 1
fi

if [ -z "$OUT_FILE" ]; then
	OUT_FILE="$COMPACT_DIR/$BRANCH_SAFE-latest.md"
fi

TS_HUMAN="$(date '+%Y-%m-%d %H:%M:%S %z')"
HEAD_SHA="$(git rev-parse --short HEAD)"

OBJECTIVE="$(extract_section "$SOURCE_FILE" "Objective" | trim_non_empty 6)"
WORK_IDENTITY="$(extract_section "$SOURCE_FILE" "Work Identity" | trim_non_empty 8)"
REPO_STATE="$(extract_section "$SOURCE_FILE" "Repo State" | trim_non_empty 10)"
UNCOMMITTED="$(extract_section "$SOURCE_FILE" "Uncommitted Files" | trim_non_empty 20)"
CHANGED_FILES="$(extract_section "$SOURCE_FILE" "Changed Files vs origin/main" | trim_non_empty 25)"
RECENT_COMMITS="$(extract_section "$SOURCE_FILE" "Recent Commits" | trim_non_empty 10)"
NOTES="$(extract_section "$SOURCE_FILE" "Notes" | trim_non_empty 10)"
RESUME_COMMANDS="$(extract_section "$SOURCE_FILE" "Resume Commands" | trim_non_empty 8)"
WATCH_BLOCKERS="$(extract_section "$SOURCE_FILE" "Watch Log Tail" | grep -Ei 'blocked|error|fail|pending' | trim_non_empty 10 || true)"

if [ -z "$WATCH_BLOCKERS" ]; then
	WATCH_BLOCKERS="- none"
fi

PINNED_FACTS="- none"
if [ -f "$PINNED_FILE" ]; then
	PINNED_FACTS="$(sed -n '1,120p' "$PINNED_FILE" | trim_non_empty 40)"
	[ -n "$PINNED_FACTS" ] || PINNED_FACTS="- none"
fi

{
	echo "# Compact Context"
	echo ""
	echo "- Generated: $TS_HUMAN"
	echo "- Branch: $BRANCH"
	echo "- Head: $HEAD_SHA"
	echo "- Source snapshot: ${SOURCE_FILE#$ROOT_DIR/}"
	echo "- Line budget: $MAX_LINES"
	echo ""
	echo "## Pinned Facts"
	echo "$PINNED_FACTS"
	echo ""
	echo "## Active Objective"
	echo "${OBJECTIVE:-- none}"
	echo ""
	echo "## Work Identity"
	echo "${WORK_IDENTITY:-- none}"
	echo ""
	echo "## Current Repo State"
	echo "${REPO_STATE:-- none}"
	echo ""
	echo "## Changed Files (Top)"
	echo "${CHANGED_FILES:-- none}"
	echo ""
	echo "## Uncommitted"
	echo "${UNCOMMITTED:-- none}"
	echo ""
	echo "## Recent Commits"
	echo "${RECENT_COMMITS:-- none}"
	echo ""
	echo "## Risks / Blockers"
	echo "$WATCH_BLOCKERS"
	echo ""
	echo "## Notes"
	echo "${NOTES:-- none}"
	echo ""
	echo "## Resume Commands"
	echo "${RESUME_COMMANDS:-- none}"
} | awk -v limit="$MAX_LINES" '
	NR <= limit {print}
	NR == limit + 1 {print ""; print "_(truncated by ctx:compact max-lines budget)_"}
' > "$OUT_FILE"

cp "$OUT_FILE" "$BASE_DIR/latest-compact-$BRANCH_SAFE.md"

echo "[ctx:compact] source: ${SOURCE_FILE#$ROOT_DIR/}"
echo "[ctx:compact] output: ${OUT_FILE#$ROOT_DIR/}"
