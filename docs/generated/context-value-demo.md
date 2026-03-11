# Context Value Demo

This generated report is the fastest way to explain why the context system is useful in practice.

## Why It Feels Different

- You start from about `6653` tokens instead of `223391` across the broader docs set.
- You can discover `4` surfaces, `3` reusable agents, and `3` reusable tools without replaying chat history.
- Ambiguous tasks can fall back to retrieval over `306` indexed chunks.
- Measured runtime evidence currently shows `11.8` minutes of estimated time saved.
- Routed-vs-baseline evidence currently has `1` wins across `1` recorded comparisons.

## Felt Value Scorecard

| Check | Result | Evidence |
| --- | --- | --- |
| Small start bundle | PASS | 6653 tokens vs 223391 tokens across all docs (97% smaller) |
| Discovery works without chat memory | PASS | 4 surfaces, 3 agents, 3 tools |
| Ambiguity has a retrieval escape hatch | PASS | 306 retrieval chunks across 36 sources |
| Time-saved evidence exists | PASS | 3 finished runs, 11.8 minutes estimated saved |
| Routed mode beat baseline at least once | PASS | 1/1 routed wins |

## Latest Measured Run

- Run: `R-20260311154844-planner`
- Agent: `planner`
- Docs before first edit: `2`
- Actual minutes: `1.9`
- Baseline minutes: `5`
- Estimated time saved: `3.1`

## Fast Demo Commands

```bash
npm run docs:check
npm run registry:query -- --kind tool --q retrieve
npm run registry:describe -- --kind tool --id context-retrieve
npm run retrieve:query -- --q "routing rules"
npm run agent:start -- --agent planner --surface terminal
npm run agent:event -- --type doc_open --path docs/PLANS.md
npm run agent:finish -- --status success --baseline-minutes 30
npm run agent:report
npm run value:demo
```

## Interpretation

- If the small-map reduction is weak, the routing layer is still too fat.
- If discovery counts are zero, outsiders will not feel the system yet.
- If retrieval has no chunks, ambiguous work will still fall back to broad scanning.
- If time-saved evidence is missing, users will read this as process overhead rather than leverage.
- If there are no routed wins, the system may be tidy but still not feel faster.

