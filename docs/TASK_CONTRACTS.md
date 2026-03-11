# Task Contracts

## Purpose

Task contracts define when a task is allowed to stop.

Plans explain the sequence. Task contracts define the finish line.

Use them to keep agents from ending a session after a partial implementation, a stub, or an unverified first attempt.

## Core Rules

1. Keep one active task contract per active task slice.
2. Prefer one focused session per contract instead of one long session holding many unrelated goals.
3. Separate research from implementation.
4. Treat the contract as the stop condition for the task.
5. Re-read the active contract, active plan, and directly relevant files after compaction or resume before editing code again.

## Research Then Implement

Do not pollute implementation context with broad option-search when it is avoidable.

Use this split:

1. Research task
   - compare implementation options
   - record the chosen direction in an exec plan or decision note
   - end when the implementation choice is explicit
2. Implementation task contract
   - encode the selected approach
   - define finish checks, evidence, and non-goals
   - implement in a fresh or freshly rehydrated session

## Contract Directories

- Active contracts: `docs/task-contracts/active/`
- Completed contracts: `docs/task-contracts/completed/`
- Generated status report: `docs/generated/task-contract-report.md`

## Minimum Contract Shape

```markdown
# Task Contract: terminal-chart-overlay

- Branch: `codex/terminal-chart-overlay`
- Surface: `terminal`
- Type: `implementation`
- Status: `active`

## Goal

One sentence describing the outcome.

## Scope

- paths or modules in scope
- the chosen implementation direction

## Finish Line

- [ ] deterministic code/build/test condition
- [ ] user-visible behavior condition
- [ ] evidence captured in docs/watch log/report

## Evidence

- commands to run
- files to inspect
- screenshots or harness output if relevant

## Non-Goals

- what this contract explicitly does not include
```

## Stop Discipline

If a branch has an active contract and the finish line is incomplete, the task should not be treated as complete.

Current frontend automation does not block terminal stop directly, but it should still block semantic task closure and push/merge decisions.

Temporary override for intentional early stop:

- `CTX_ALLOW_INCOMPLETE_CONTRACT=1`

## Compaction Discipline

After compaction or resume:

1. re-read `README.md`
2. re-read `AGENTS.md`
3. re-read `docs/README.md`
4. re-read the active task contract
5. re-read the active exec plan
6. re-read only the directly relevant source files

## Mechanical Enforcement

- `npm run contract:new`
- `npm run contract:report`
- `npm run contract:check`
- `docs/generated/task-contract-report.md`
- `ctx:auto` + `context-autopilot.mjs` may create a provisional branch contract

## What Contracts Are Not

Contracts are not:

- a replacement for canonical docs
- a place for long research dumps
- a substitute for tests or harness evidence
- a reason to keep huge sessions alive forever
