#!/usr/bin/env bash
set -euo pipefail

usage() {
	echo "Usage: bash scripts/dev/context-restore.sh --mode <context|files> [--branch <name>] [--list] [--snapshot <file>]"
	echo ""
	echo "Important:"
	echo "  --mode is mandatory to avoid ambiguity between session-context recovery and file recovery."
	echo ""
	echo "Examples:"
	echo "  npm run ctx:restore -- --mode context"
	echo "  npm run ctx:restore -- --mode context --list"
	echo "  npm run ctx:restore -- --mode files"
}

sanitize() {
	printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g'
}

MODE=""
TARGET_BRANCH=""
LIST_ONLY=0
SNAPSHOT_FILE=""

while [ "$#" -gt 0 ]; do
	case "$1" in
		--mode)
			MODE="${2:-}"
			shift 2
			;;
		--branch)
			TARGET_BRANCH="${2:-}"
			shift 2
			;;
		--snapshot)
			SNAPSHOT_FILE="${2:-}"
			shift 2
			;;
		--list)
			LIST_ONLY=1
			shift 1
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

if [ -z "$MODE" ]; then
	echo "[ctx:restore] ambiguous request."
	echo "[ctx:restore] choose explicit mode:"
	echo "  --mode context   (recover conversation/task context)"
	echo "  --mode files     (recover file state guidance)"
	exit 1
fi

if [ "$MODE" != "context" ] && [ "$MODE" != "files" ]; then
	echo "[ctx:restore] invalid mode: $MODE"
	usage
	exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if [ -z "$TARGET_BRANCH" ]; then
	TARGET_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

BRANCH_SAFE="$(sanitize "${TARGET_BRANCH//\//-}")"
BASE_DIR="$ROOT_DIR/.agent-context"
SNAPSHOT_DIR="$BASE_DIR/snapshots/$BRANCH_SAFE"
COMPACT_FILE="$BASE_DIR/compact/$BRANCH_SAFE-latest.md"

if [ "$LIST_ONLY" -eq 1 ]; then
	echo "[ctx:restore] branch=$TARGET_BRANCH"
	echo ""
	echo "compact:"
	if [ -f "$COMPACT_FILE" ]; then
		echo "- ${COMPACT_FILE#$ROOT_DIR/}"
	else
		echo "- (none)"
	fi
	echo ""
	echo "snapshots:"
	if ls -1 "$SNAPSHOT_DIR"/*.md >/dev/null 2>&1; then
		ls -1t "$SNAPSHOT_DIR"/*.md | sed "s#^$ROOT_DIR/##" | sed -n '1,20p' | sed 's/^/- /'
	else
		echo "- (none)"
	fi
	exit 0
fi

if [ "$MODE" = "files" ]; then
	echo "[ctx:restore] file recovery mode selected."
	echo "This command does not modify files automatically."
	echo ""
	echo "Recommended manual flow:"
	echo "1. git status --short --branch"
	echo "2. git log --oneline --decorate -n 20"
	echo "3. git diff <target> -- <file>"
	echo "4. If needed, create a safety branch before any restore operation."
	exit 0
fi

SOURCE_FILE="$COMPACT_FILE"
if [ -n "$SNAPSHOT_FILE" ]; then
	SOURCE_FILE="$SNAPSHOT_FILE"
fi

if [ ! -f "$SOURCE_FILE" ]; then
	LATEST_SNAPSHOT="$(ls -1t "$SNAPSHOT_DIR"/*.md 2>/dev/null | head -n 1 || true)"
	if [ -n "$LATEST_SNAPSHOT" ]; then
		echo "[ctx:restore] compact file missing; regenerating from latest snapshot."
		bash scripts/dev/context-compact.sh --source "$LATEST_SNAPSHOT" >/dev/null
	else
		echo "[ctx:restore] no compact or snapshot found for branch $TARGET_BRANCH."
		echo "[ctx:restore] run: npm run ctx:save -- --title '<task>'"
		exit 1
	fi
fi

echo "[ctx:restore] mode=context"
echo "[ctx:restore] source=${SOURCE_FILE#$ROOT_DIR/}"
echo ""
cat "$SOURCE_FILE"
