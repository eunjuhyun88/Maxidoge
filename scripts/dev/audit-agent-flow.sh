#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"

declare -a REPOS
if [ "$#" -gt 0 ]; then
	REPOS=("$@")
elif [ -n "${AGENT_AUDIT_REPOS:-}" ]; then
	IFS=',' read -r -a REPOS <<<"$AGENT_AUDIT_REPOS"
else
	REPOS=(
		"$ROOT_DIR"
		"/Users/ej/Downloads/maxidoge-clones/integration"
		"/Users/ej/Downloads/maxidoge-clones/backend"
		"/Users/ej/Downloads/maxidoge-clones/frontend"
		"/Users/ej/Downloads/maxidoge-clones/frontend-passport"
		"/Users/ej/Downloads/maxi-doge-unified"
	)
fi

targets_tmp="$(mktemp)"
hash_tmp="$(mktemp)"
trap 'rm -f "$targets_tmp" "$hash_tmp"' EXIT

for repo in "${REPOS[@]}"; do
	[ -z "${repo// }" ] && continue
	if git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		echo "$repo" >>"$targets_tmp"
	fi
done

if [ ! -s "$targets_tmp" ]; then
	echo "[audit] no git repositories found"
	exit 1
fi

sort -u "$targets_tmp" -o "$targets_tmp"
target_count="$(wc -l <"$targets_tmp" | tr -d ' ')"

echo "[audit] repositories: $target_count"
echo

warnings=0

while IFS= read -r repo; do
	branch="$(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
	status_line="$(git -C "$repo" status --short --branch | head -n 1)"
	dirty=0
	if [ -n "$(git -C "$repo" status --porcelain)" ]; then
		dirty=1
	fi

	ahead="?"
	behind="?"
	if git -C "$repo" rev-parse --verify origin/main >/dev/null 2>&1; then
		read -r ahead behind < <(git -C "$repo" rev-list --left-right --count HEAD...origin/main)
	fi

	hook_path="$(git -C "$repo" config --get core.hooksPath || echo "(default)")"

	agents_hash="NO_AGENTS"
	if [ -f "$repo/AGENTS.md" ]; then
		agents_hash="$(shasum -a 256 "$repo/AGENTS.md" | awk '{print $1}')"
		printf '%s|%s\n' "$agents_hash" "$repo" >>"$hash_tmp"
	fi

	echo "[$repo]"
	echo "  branch: $branch"
	echo "  status: $status_line"
	echo "  dirty: $dirty"
	echo "  vs origin/main: ahead=$ahead behind=$behind"
	echo "  hooksPath: $hook_path"
	echo "  AGENTS hash: $agents_hash"

	if [[ "$repo" == *"/maxidoge-clones/integration" ]] && [ "$branch" != "main" ]; then
		echo "  warning: integration clone should stay on main."
		warnings=$((warnings + 1))
	fi
	if [[ "$repo" != *"/maxidoge-clones/integration" ]] && [ "$branch" = "main" ] && [ "$dirty" -eq 1 ]; then
		echo "  warning: dirty main detected outside integration clone."
		warnings=$((warnings + 1))
	fi
	echo
done <"$targets_tmp"

hash_unique_count=0
if [ -s "$hash_tmp" ]; then
	hash_unique_count="$(cut -d'|' -f1 "$hash_tmp" | sort | uniq | wc -l | tr -d ' ')"
fi

if [ "$hash_unique_count" -gt 1 ]; then
	echo "[audit] warning: AGENTS.md hashes are not uniform across repositories."
	while IFS= read -r hash; do
		count="$(awk -F'|' -v h="$hash" '$1==h {c++} END {print c+0}' "$hash_tmp")"
		echo "- $hash ($count repos)"
		awk -F'|' -v h="$hash" '$1==h {print "  - "$2}' "$hash_tmp"
	done < <(cut -d'|' -f1 "$hash_tmp" | sort | uniq)
	warnings=$((warnings + 1))
elif [ "$hash_unique_count" -eq 1 ]; then
	echo "[audit] AGENTS.md hash is consistent across detected repositories."
else
	echo "[audit] no AGENTS.md files found in detected repositories."
fi

if [ "$warnings" -gt 0 ]; then
	echo "[audit] completed with warnings: $warnings"
else
	echo "[audit] completed with no warnings."
fi
