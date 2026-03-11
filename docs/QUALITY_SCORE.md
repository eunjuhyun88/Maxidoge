# QUALITY_SCORE

Purpose:
- Track current quality grades by surface and architectural concern.
- Use this to decide where cleanup or stronger guardrails are needed next.

Scale:
- `A`: strong and legible
- `B`: workable with known debt
- `C`: fragile or partially specified
- `D`: drift risk or authority gaps are high

| Area | Grade | Why | Next upgrade |
| --- | --- | --- | --- |
| Context routing | A | Canonical entry docs plus `docs/CONTEXT_ENGINEERING.md` now form a clearer small-map resume path. | Remove the remaining parent-folder design lookups from ordinary workflows. |
| Context handoff quality | B+ | Checkpoint + brief + handoff flow exists, and `ctx:auto` is no longer coupled to an executable bit on `context-compact.sh`. | Keep `ctx:check -- --strict` enforced and reduce degraded fallback usage. |
| Task stop discipline | B- | Task contract scaffolding/reporting exists, but feature branches are not hard-required to carry a contract yet. | Let autopilot create good provisional contracts and tighten branch-level enforcement once usage is stable. |
| Practical validation evidence | C+ | Telemetry, A/B, and validation reports exist, but the repo still needs more representative measured runs with real edit evidence. | Record at least 3 real tasks per major surface and keep `eval:validate` green. |
| Docs structure | B+ | New hierarchy exists and canonical entry docs are stronger, but older dated docs still dominate some workflows. | Promote more stable rules into canonical docs. |
| Terminal architecture | C+ | Refactor direction exists, but god-shell and large intel surface remain. | Continue route/view-model/presentation split. |
| Arena product clarity | B- | Deep semantics are rich, but split across upstream design and local docs. | Consolidate Arena authority into repo-local specs. |
| Profile/server authority | C | Known client-authority leakage exists in badges/profile-related flows. | Complete authority repair phases. |
| Security documentation | B | Security review and scale docs exist, now routed through canonical entrypoint. | Add CSP and auth boundary updates as canonical policy. |
| Reliability documentation | C+ | Perf/load/security plans exist, but observability and failure loops are not fully codified. | Add route/service SLOs and validation playbooks. |
| Multi-clone drift risk | D | Sibling clones still exist outside canonical target. | Archive or isolate non-canonical workspaces further. |

## Review Rhythm

- Update this file when a major structural refactor lands.
- Promote recurring findings from the watch log into this scorecard.
- Use this as the default "where next?" file for cleanup planning.
