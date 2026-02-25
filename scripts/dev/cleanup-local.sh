#!/usr/bin/env bash
set -euo pipefail

APPLY=0
INCLUDE_MERGED_LOCAL=0
INCLUDE_NODE_MODULES=0

usage() {
	cat <<'EOF'
Usage: bash scripts/dev/cleanup-local.sh [--apply] [--include-merged-local] [--include-node-modules]

Options:
  --apply                 Actually delete safe cleanup candidates.
  --include-merged-local  Also delete merged local-only branches (no upstream).
  --include-node-modules  Also remove node_modules directory if present.
EOF
}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--apply)
			APPLY=1
			;;
		--include-merged-local)
			INCLUDE_MERGED_LOCAL=1
			;;
		--include-node-modules)
			INCLUDE_NODE_MODULES=1
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "[cleanup] unknown option: $1"
			usage
			exit 1
			;;
	esac
	shift
done

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" = "main" ] && [ "$APPLY" -eq 1 ]; then
	echo "[cleanup] on main branch. Switch to a task branch before --apply."
	exit 1
fi

echo "[cleanup] mode: $([ "$APPLY" -eq 1 ] && echo "APPLY" || echo "DRY-RUN")"
echo "[cleanup] repo: $ROOT_DIR"
echo "[cleanup] current branch: $CURRENT_BRANCH"
echo

echo "[cleanup] fetch/prune origin"
git fetch origin --prune

BASE_REF=""
if git rev-parse --verify origin/main >/dev/null 2>&1; then
	BASE_REF="origin/main"
elif git rev-parse --verify main >/dev/null 2>&1; then
	BASE_REF="main"
else
	echo "[cleanup] base ref not found (origin/main or main)"
	exit 1
fi
echo "[cleanup] base ref: $BASE_REF"
echo

declare -a gone_merged=()
declare -a gone_unmerged=()
declare -a merged_local=()

while IFS='|' read -r branch upstream track; do
	[ -z "$branch" ] && continue

	case "$branch" in
		main|master|develop)
			continue
			;;
	esac

	if [ "$branch" = "$CURRENT_BRANCH" ]; then
		continue
	fi

	is_merged=0
	if git merge-base --is-ancestor "$branch" "$BASE_REF"; then
		is_merged=1
	fi

	if [ "$track" = "[gone]" ]; then
		if [ "$is_merged" -eq 1 ]; then
			gone_merged+=("$branch")
		else
			gone_unmerged+=("$branch")
		fi
		continue
	fi

	if [ -z "$upstream" ] && [ "$is_merged" -eq 1 ]; then
		merged_local+=("$branch")
	fi
done < <(git for-each-ref --format='%(refname:short)|%(upstream:short)|%(upstream:track)' refs/heads)

declare -a artifacts=()
artifact_candidates=(.svelte-kit dist .vite coverage)
if [ "$INCLUDE_NODE_MODULES" -eq 1 ]; then
	artifact_candidates+=(node_modules)
fi
for path in "${artifact_candidates[@]}"; do
	if [ -e "$path" ]; then
		artifacts+=("$path")
	fi
done

echo "[cleanup] safe branch candidates (gone + merged into $BASE_REF):"
if [ "${#gone_merged[@]}" -eq 0 ]; then
	echo "  - none"
else
	for branch in "${gone_merged[@]}"; do
		echo "  - $branch"
	done
fi
echo

echo "[cleanup] skipped (gone but NOT merged):"
if [ "${#gone_unmerged[@]}" -eq 0 ]; then
	echo "  - none"
else
	for branch in "${gone_unmerged[@]}"; do
		echo "  - $branch"
	done
fi
echo

echo "[cleanup] optional candidates (merged local-only branches):"
if [ "${#merged_local[@]}" -eq 0 ]; then
	echo "  - none"
else
	for branch in "${merged_local[@]}"; do
		echo "  - $branch"
	done
fi
echo

echo "[cleanup] artifact candidates:"
if [ "${#artifacts[@]}" -eq 0 ]; then
	echo "  - none"
else
	for path in "${artifacts[@]}"; do
		echo "  - $path"
	done
fi
echo

stash_count="$(git stash list | wc -l | tr -d ' ')"
echo "[cleanup] stash entries: $stash_count (manual review only, no auto-drop)"
echo

if [ "$APPLY" -eq 0 ]; then
	echo "[cleanup] dry-run complete. Apply with:"
	echo "  npm run safe:cleanup:apply"
	if [ "${#merged_local[@]}" -gt 0 ]; then
		echo "  npm run safe:cleanup:apply -- --include-merged-local"
	fi
	if [ -d node_modules ]; then
		echo "  npm run safe:cleanup:apply -- --include-node-modules"
	fi
	exit 0
fi

if [ "${#gone_merged[@]}" -gt 0 ]; then
	for branch in "${gone_merged[@]}"; do
		echo "[cleanup] deleting branch: $branch"
		git branch -d "$branch"
	done
fi

if [ "$INCLUDE_MERGED_LOCAL" -eq 1 ]; then
	if [ "${#merged_local[@]}" -gt 0 ]; then
		for branch in "${merged_local[@]}"; do
			echo "[cleanup] deleting merged local branch: $branch"
			git branch -d "$branch"
		done
	fi
fi

if [ "${#artifacts[@]}" -gt 0 ]; then
	for path in "${artifacts[@]}"; do
		echo "[cleanup] removing: $path"
		rm -rf "$path"
	done
fi

echo
echo "[cleanup] apply complete."
