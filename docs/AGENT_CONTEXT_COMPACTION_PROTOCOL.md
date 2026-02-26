# Agent Context Compaction Protocol

Last updated: 2026-02-26
Scope: `/Users/ej/Downloads/maxidoge-clones/backend`

## 1) Why

Long-running multi-agent sessions increase:

- API token usage/cost
- chance of context drift
- chance of "reset amnesia" after session restart

This protocol standardizes save/compact/restore so agents can hand off safely.

## 2) Runtime Layout (Local Only)

All runtime context files are stored under `.agent-context/` and are gitignored.

- `.agent-context/snapshots/<branch-safe>/*.md`:
  Raw task snapshots.
- `.agent-context/compact/<branch-safe>-latest.md`:
  Latest compact summary for the branch.
- `.agent-context/pinned-facts.md`:
  Durable facts that must survive compaction/reset.
- `.agent-context/index.tsv`:
  Snapshot index for quick lookup.

## 3) Commands

### Save current context

```bash
npm run ctx:save -- --title "task start" --work-id "W-YYYYMMDD-HHMM-<repo>-<agent>" --agent "codex"
```

What it captures:

- branch/head/upstream/ahead-behind
- uncommitted changes
- changed files vs `origin/main`
- recent commits
- watch log tail
- resume command hints

### Pin durable facts

```bash
npm run ctx:pin -- --add "Do not merge without one write-access approval"
```

Use only for durable, high-value facts. Never pin secrets.

### Compact context

```bash
npm run ctx:compact
```

Compaction output includes:

- objective
- work identity
- current repo state
- top changed files
- blockers/errors from watch log
- next commands

### Restore context

```bash
npm run ctx:restore -- --mode context
```

Ambiguity guard:

```bash
npm run ctx:restore -- --mode files
```

`--mode` is mandatory to avoid confusion between conversation restore and file restore.

## 4) Multi-Agent Handoff Standard

1. Agent A before handoff:
   - `ctx:save` with work id
   - `ctx:compact`
2. Agent B at resume:
   - `ctx:restore -- --mode context`
   - confirm branch/worktree
   - continue work with same or new work id

## 5) Minimum Cadence

- At task start: `ctx:save`
- Before push/PR: `ctx:save` + `ctx:compact`
- Any major decision change: `ctx:pin -- --add "..."`
- After session reset: `ctx:restore -- --mode context`

## 6) Safety Rules

- Do not commit `.agent-context/*` artifacts.
- Do not place keys/secrets in snapshots or pinned facts.
- For file recovery, use explicit file recovery flow (`--mode files` guidance) instead of ambiguous restore requests.
