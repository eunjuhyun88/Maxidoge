#!/usr/bin/env bash
set -euo pipefail

RUN_GATE=0
if [ "${1:-}" = "--gate" ]; then
	RUN_GATE=1
elif [ "${1:-}" = "" ]; then
	:
else
	echo "Usage: bash scripts/dev/sync-branch.sh [--gate]"
	exit 1
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "Working tree has uncommitted changes. Commit or stash first."
	git status --short --branch
	exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "[safe-sync] fetching origin"
git fetch origin --prune

if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
	echo "[safe-sync] origin/main not found. Check remote configuration."
	exit 1
fi

if [ "$CURRENT_BRANCH" = "main" ]; then
	echo "[safe-sync] main branch: pull --ff-only"
	git pull --ff-only origin main
else
	if git merge-base --is-ancestor origin/main HEAD; then
		echo "[safe-sync] $CURRENT_BRANCH already includes origin/main"
	else
		echo "[safe-sync] rebasing $CURRENT_BRANCH onto origin/main"
		git rebase origin/main
	fi
fi

if [ "$RUN_GATE" -eq 1 ]; then
	echo "[safe-sync] running npm run gate"
	npm run gate
else
	echo "[safe-sync] running npm run check"
	npm run check
fi

echo "[safe-sync] done"
