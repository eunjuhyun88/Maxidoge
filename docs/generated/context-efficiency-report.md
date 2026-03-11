# Context Efficiency Report

This report estimates how much context the routing system saves before the agent reaches implementation files.

## Core Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| small map | 6 | 1196 | 12587 | 41.7% | 92.0% |
| canonical | 26 | 2296 | 21580 | 0.0% | 86.4% |
| all docs | 93 | 21810 | 158295 | -633.5% | 0.0% |

## Estimated Savings

- Small map saves approximately `8993` tokens vs the canonical bundle.
- Small map saves approximately `145708` tokens vs the all-doc bundle.
- Surface `terminal` saves approximately `142006` tokens vs the all-doc bundle.
- Surface `arena` saves approximately `141873` tokens vs the all-doc bundle.
- Surface `community` saves approximately `142230` tokens vs the all-doc bundle.
- Surface `api` saves approximately `142230` tokens vs the all-doc bundle.

## Surface Bundles

| Bundle | Files | Lines | Approx Tokens | Reduction vs canonical | Reduction vs all docs |
| --- | --- | --- | --- | --- | --- |
| terminal | 10 | 1520 | 16289 | 24.5% | 89.7% |
| arena | 10 | 1539 | 16422 | 23.9% | 89.6% |
| community | 9 | 1490 | 16065 | 25.6% | 89.9% |
| api | 9 | 1490 | 16065 | 25.6% | 89.9% |

## Structural Scorecard

| Check | Actual | Target | Result |
| --- | --- | --- | --- |
| Small-map reduction vs canonical | 41.7% | >= 40% | PASS |
| Small-map reduction vs all docs | 92.0% | >= 55% | PASS |
| Worst surface reduction vs all docs | 89.6% | >= 50% | PASS |
| Small-map approx tokens | 12587 | <= 14000 | PASS |
| Small-map file count | 6 | <= 6 | PASS |
| Canonical approx tokens | 21580 | <= 32000 | PASS |

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

