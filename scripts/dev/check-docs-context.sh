#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

node scripts/dev/refresh-generated-context.mjs --check
node scripts/dev/refresh-context-metrics.mjs --check
node scripts/dev/refresh-task-contract-report.mjs --check

FAIL=0

ok() {
	echo "[docs:check] ok: $1"
}

fail() {
	echo "[docs:check] fail: $1"
	FAIL=1
}

require_max_lines() {
	local path="$1"
	local max_lines="$2"
	local actual_lines
	actual_lines="$(wc -l < "$path" | tr -d ' ')"
	if [ "$actual_lines" -le "$max_lines" ]; then
		ok "line budget ok for $path: ${actual_lines} <= ${max_lines}"
	else
		fail "line budget exceeded for $path: ${actual_lines} > ${max_lines}"
	fi
}

require_file() {
	local path="$1"
	if [ -f "$path" ]; then
		ok "file exists: $path"
	else
		fail "missing file: $path"
	fi
}

require_dir() {
	local path="$1"
	if [ -d "$path" ]; then
		ok "dir exists: $path"
	else
		fail "missing dir: $path"
	fi
}

require_text() {
	local path="$1"
	local needle="$2"
	local label="${3:-$needle}"
	if grep -Fq "$needle" "$path"; then
		ok "text present in $path: $label"
	else
		fail "missing text in $path: $label"
	fi
}

require_absent() {
	local path="$1"
	local needle="$2"
	local label="${3:-$needle}"
	if grep -Fq "$needle" "$path"; then
		fail "unexpected text in $path: $label"
	else
		ok "text absent in $path: $label"
	fi
}

REQUIRED_DIRS=(
	"docs"
	"docs/archive"
	"docs/design-docs"
	"docs/product-specs"
	"docs/page-specs"
	"docs/exec-plans"
	"docs/exec-plans/active"
	"docs/exec-plans/completed"
	"docs/task-contracts"
	"docs/task-contracts/active"
	"docs/task-contracts/completed"
	"docs/generated"
	"docs/references"
)

REQUIRED_FILES=(
	"README.md"
	"AGENTS.md"
	"ARCHITECTURE.md"
	"docs/README.md"
	"docs/CONTEXT_ENGINEERING.md"
	"docs/SYSTEM_INTENT.md"
	"docs/DESIGN.md"
	"docs/FRONTEND.md"
	"docs/PLANS.md"
	"docs/PRODUCT_SENSE.md"
	"docs/QUALITY_SCORE.md"
	"docs/RELIABILITY.md"
	"docs/SECURITY.md"
	"docs/TASK_CONTRACTS.md"
	"docs/AUTOPILOT.md"
	"docs/CONTEXT_VALIDATION.md"
	"docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md"
	"docs/design-docs/index.md"
	"docs/design-docs/core-beliefs.md"
	"docs/design-docs/arena-domain-model.md"
	"docs/design-docs/learning-loop.md"
	"docs/product-specs/index.md"
	"docs/product-specs/home.md"
	"docs/product-specs/arena.md"
	"docs/product-specs/terminal.md"
	"docs/product-specs/signals.md"
	"docs/product-specs/passport.md"
	"docs/product-specs/agents.md"
	"docs/page-specs/index.md"
	"docs/page-specs/home-onboarding.md"
	"docs/page-specs/terminal-page.md"
	"docs/page-specs/arena-page.md"
	"docs/page-specs/signals-page.md"
	"docs/page-specs/signals-detail-page.md"
	"docs/page-specs/creator-page.md"
	"docs/page-specs/passport-page.md"
	"docs/page-specs/agents-page.md"
	"docs/page-specs/oracle-page.md"
	"docs/page-specs/settings-page.md"
	"docs/page-specs/arena-war-page.md"
	"docs/page-specs/arena-v2-page.md"
	"docs/exec-plans/index.md"
	"docs/exec-plans/active/README.md"
	"docs/exec-plans/active/context-system-rollout-2026-03-06.md"
	"docs/exec-plans/completed/README.md"
	"docs/exec-plans/tech-debt-tracker.md"
	"docs/task-contracts/active/README.md"
	"docs/task-contracts/completed/README.md"
	"docs/generated/README.md"
	"docs/generated/db-schema.md"
	"docs/generated/game-record-schema.md"
	"docs/generated/route-map.md"
	"docs/generated/store-authority-map.md"
	"docs/generated/api-group-map.md"
	"docs/generated/context-efficiency-report.md"
	"docs/generated/context-efficiency-report.json"
	"docs/generated/task-contract-report.md"
	"docs/references/index.md"
	"scripts/dev/context-checkpoint.sh"
	"scripts/dev/check-context-quality.sh"
	"scripts/dev/scaffold-task-contract.mjs"
	"scripts/dev/check-task-contracts.mjs"
	"scripts/dev/refresh-task-contract-report.mjs"
	"scripts/dev/context-autopilot.mjs"
	"scripts/dev/refresh-context-validation-report.mjs"
)

for dir in "${REQUIRED_DIRS[@]}"; do
	require_dir "$dir"
done

for file in "${REQUIRED_FILES[@]}"; do
	require_file "$file"
done

require_text "AGENTS.md" "docs/README.md" "task-level docs router"
require_text "AGENTS.md" "ARCHITECTURE.md" "architecture map"
require_text "AGENTS.md" "ctx:checkpoint" "semantic checkpoint command"
require_text "AGENTS.md" "ctx:check -- --strict" "strict context quality command"
require_text "AGENTS.md" "docs/TASK_CONTRACTS.md" "task contract doc"
require_text "README.md" "## 1.1) Context Routing" "context routing section"
require_text "README.md" "ctx:checkpoint" "checkpoint command in readme"
require_text "README.md" "contract:new" "contract scaffold command"
require_text "README.md" "Context Artifact Model" "context artifact model section"
require_text "ARCHITECTURE.md" "## Canonical Doc Entry Points" "canonical doc entry section"
require_text "ARCHITECTURE.md" "docs/CONTEXT_ENGINEERING.md" "context engineering entry point"
require_text "docs/README.md" "## Canonical Entry Docs" "canonical entry docs"
require_text "docs/README.md" "## Structured Knowledge Base" "structured knowledge base"
require_text "docs/README.md" "docs/TASK_CONTRACTS.md" "task contract router"
require_text "docs/README.md" "docs/CONTEXT_ENGINEERING.md" "context engineering router"
require_text "docs/README.md" "docs/page-specs/" "page specs router"
require_text "docs/CONTEXT_ENGINEERING.md" "## Context Layers" "context layers section"
require_text "docs/CONTEXT_ENGINEERING.md" "## Retrieval Order" "retrieval order section"
require_text "docs/CONTEXT_ENGINEERING.md" "## Anti-Patterns" "anti-patterns section"
require_text "docs/CONTEXT_ENGINEERING.md" "## Mechanical Enforcement" "mechanical enforcement section"
require_text "docs/SYSTEM_INTENT.md" "## Non-Negotiable Invariants" "system invariants"
require_text "docs/DESIGN.md" "## Design Authority Stack" "design authority stack"
require_text "docs/design-docs/arena-domain-model.md" "## Canonical Record: GameRecord" "arena domain GameRecord section"
require_text "docs/design-docs/learning-loop.md" "## ORPO Learning" "learning loop ORPO section"
require_text "docs/FRONTEND.md" "## State Authority" "state authority section"
require_text "docs/PLANS.md" "## Current Active Planning Surface" "active planning section"
require_text "docs/PRODUCT_SENSE.md" "## Core Product Heuristics" "product heuristics"
require_text "docs/QUALITY_SCORE.md" "Scale:" "quality scale"
require_text "docs/QUALITY_SCORE.md" "Context handoff quality" "context handoff quality row"
require_text "docs/QUALITY_SCORE.md" "Task stop discipline" "task stop discipline row"
require_text "docs/RELIABILITY.md" "## Reliability Rules" "reliability rules"
require_text "docs/SECURITY.md" "## Security Non-Negotiables" "security non-negotiables"
require_text "docs/TASK_CONTRACTS.md" "## Purpose" "task contracts purpose"
require_text "docs/AUTOPILOT.md" "## Automatic Stages" "autopilot automatic stages"
require_text "docs/CONTEXT_VALIDATION.md" "## Validation Report" "context validation report section"
require_text "docs/design-docs/core-beliefs.md" "## Beliefs" "beliefs section"
require_text "docs/product-specs/index.md" "## Surface Specs" "surface specs section"
require_text "docs/product-specs/index.md" "## Page Specs" "page specs section"
require_text "docs/page-specs/index.md" "## Page Specs" "page specs index"
require_text "docs/generated/game-record-schema.md" "## Primary Structure" "game record schema structure"
require_text "docs/generated/route-map.md" "## App Routes" "route map section"
require_text "docs/generated/store-authority-map.md" "## Stores" "store authority section"
require_text "docs/generated/api-group-map.md" "## API Group Overview" "api group overview"
require_text "docs/generated/context-efficiency-report.md" "## Structural Scorecard" "context efficiency scorecard"
require_text "docs/generated/task-contract-report.md" "## Active Contracts" "task contract report active section"
require_text "docs/exec-plans/index.md" "## Active" "active plans section"
require_text "docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md" 'Scope: `/Users/ej/Downloads/maxidoge-clones/frontend`' "frontend scope"
require_text "docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md" "## 2) Context Architecture" "context architecture section"
require_text "docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md" "ctx:checkpoint" "checkpoint command in protocol"
require_text "docs/AGENT_CONTEXT_COMPACTION_PROTOCOL.md" "brief" "brief mode in protocol"
require_absent "docs/DESIGN.md" "../STOCKCLAW_UNIFIED_DESIGN.md" "external arena design ref in design entry doc"
require_absent "docs/product-specs/index.md" "../STOCKCLAW_UNIFIED_DESIGN.md" "external arena design ref in product spec index"
require_absent "docs/product-specs/arena.md" "../STOCKCLAW_UNIFIED_DESIGN.md" "external arena design ref in arena spec"
require_absent "docs/PRODUCT_SENSE.md" "../STOCKCLAW_UNIFIED_DESIGN.md" "external arena design ref in product sense"
require_absent "AGENTS.md" "/Users/ej/Downloads/maxi-doge-unified/README.md" "broken external ssot readme path in agents"
require_max_lines "AGENTS.md" 130
require_max_lines "ARCHITECTURE.md" 90
require_max_lines "docs/README.md" 140
require_max_lines "docs/DESIGN.md" 90

if [ "$FAIL" -ne 0 ]; then
	echo "[docs:check] failed."
	exit 1
fi

echo "[docs:check] all context-system checks passed."
