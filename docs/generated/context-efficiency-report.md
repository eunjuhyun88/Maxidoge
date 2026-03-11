# Context Efficiency Report

This report estimates how much context the routing system saves before the agent reaches implementation files.

## Core Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| small map | 6 | 1196 | 12587 | 57.6% | 97.1% |
| canonical | 36 | 3314 | 29681 | 0.0% | 93.0% |
| all docs | 155 | 46455 | 426804 | -1338.0% | 0.0% |

## Estimated Savings

- Small map saves approximately `17094` tokens vs the canonical bundle.
- Small map saves approximately `414217` tokens vs the all-doc bundle.
- Surface `terminal` saves approximately `409883` tokens vs the all-doc bundle.
- Surface `arena` saves approximately `409750` tokens vs the all-doc bundle.
- Surface `community` saves approximately `409873` tokens vs the all-doc bundle.
- Surface `api` saves approximately `409587` tokens vs the all-doc bundle.

## Surface Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| terminal | 10 | 1544 | 16921 | 43.0% | 96.0% |
| arena | 10 | 1563 | 17054 | 42.5% | 96.0% |
| community | 10 | 1557 | 16931 | 43.0% | 96.0% |
| api | 10 | 1586 | 17217 | 42.0% | 96.0% |

## Structural Scorecard

| Check | Actual | Target | Result |
| --- | --- | --- | --- |
| Small-map reduction vs canonical | 57.6% | >= 40% | PASS |
| Small-map reduction vs all docs | 97.1% | >= 55% | PASS |
| Worst surface reduction vs all docs | 96.0% | >= 50% | PASS |
| Small-map approx tokens | 12587 | <= 14000 | PASS |
| Small-map file count | 6 | <= 6 | PASS |
| Canonical approx tokens | 29681 | <= 32000 | PASS |

## Structural Readiness

- PASS: structural routing gate

## Budget Checks

- PASS: Small map approx tokens <= 14000
- PASS: Small map files <= 6
- PASS: Canonical approx tokens <= 32000

## Small Map Files

- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `ARCHITECTURE.md`
- `docs/SYSTEM_INTENT.md`
- `docs/CONTEXT_ENGINEERING.md`

## Notes

- Small-map results tell you whether the canonical entry path is compact enough to be practical.
- Surface bundles tell you whether route/store/API discovery can be done without broad document scans.
- Run `npm run eval:validate` to pair structural evidence with real task evidence.
- Run `npm run harness:benchmark -- --base-url http://localhost:4173` for repeated runtime/noise validation.

