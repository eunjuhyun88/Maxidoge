# PR vs Main Commit Reconciliation

- Generated at: 2026-02-26 23:13:43 +0900
- Base branch: origin/main @ 8fda1ef
- Scope: PR #36, #34, #32, #23

## Summary

| PR | PR state | Head | Merge state | Review | Commits in PR | Exact in main | Patch-equivalent in main | Missing in main |
|---|---|---|---|---|---:|---:|---:|---:|
| [#36](https://github.com/eunjuhyun88/Maxidoge/pull/36) | OPEN | codex/frontend-edit-20260226 | DIRTY | REVIEW_REQUIRED | 12 | 0 | 0 | 12 |

## PR #36: refactor(ui): refine spacing and typography hierarchy

- URL: https://github.com/eunjuhyun88/Maxidoge/pull/36
- PR state: OPEN
- Head: origin/codex/frontend-edit-20260226
- Merge state: DIRTY
- Review decision: REVIEW_REQUIRED

| Commit | Headline | Main status |
|---|---|---|
| 843bf9ffaf70 | refactor(ui): refine spacing and typography hierarchy | MISSING_IN_MAIN |
| 6ea6e8d19b42 | style(ui): tone down blur and header glow intensity | MISSING_IN_MAIN |
| 182c5f336135 | refactor(home): consolidate blur and glow tokens | MISSING_IN_MAIN |
| 873faf80a246 | style(home): normalize section heading glow | MISSING_IN_MAIN |
| 02072f88af62 | fix(home): guard gradient text clipping fallback | MISSING_IN_MAIN |
| 1a2af99e6159 | refactor(wallet): unify web3 auth flow and modal UX | MISSING_IN_MAIN |
| f3dc96711c8c | refactor(gtm): collapse wallet tracking to single funnel event | MISSING_IN_MAIN |
| 77a438ce40d3 | tune(home): reduce over-strong squad title blur | MISSING_IN_MAIN |
| 8226365e7c46 | refactor(home): unify top-page tone and soften glow/cta funnel | MISSING_IN_MAIN |
| 2967be303142 | fix(home): remove inner hero scroll and unify pink title pattern | MISSING_IN_MAIN |
| 08ac6fee750b | fix(home): restore right-rail first scroll flow and hide page scrollbar | MISSING_IN_MAIN |
| d912f4be777b | refactor(home): add features rail header and rebalance hero type hier… | MISSING_IN_MAIN |
| [#34](https://github.com/eunjuhyun88/Maxidoge/pull/34) | CLOSED | codex/intel-policy-v3-runtime-clean-20260225 | DIRTY | REVIEW_REQUIRED | 30 | 0 | 27 | 3 |

## PR #34: feat(intel): wire policy v3 runtime to terminal panel

- URL: https://github.com/eunjuhyun88/Maxidoge/pull/34
- PR state: CLOSED
- Head: origin/codex/intel-policy-v3-runtime-clean-20260225
- Merge state: DIRTY
- Review decision: REVIEW_REQUIRED

| Commit | Headline | Main status |
|---|---|---|
| 636df9c7fb65 | feat(intel): wire policy v3 runtime to terminal panel | PATCH_EQ_IN_MAIN |
| 83280cdcee05 | refine intel card scoring heuristics and unify home branding | MISSING_IN_MAIN |
| 4e592360acf6 | docs: update watch log for W-20260225-2200 | PATCH_EQ_IN_MAIN |
| 333d13447caa | add intel shadow agent decision endpoint | PATCH_EQ_IN_MAIN |
| 2e4b7e43d9cb | docs: finalize watch log for shadow agent task | PATCH_EQ_IN_MAIN |
| 5dbaa9a985c3 | feat(intel): wire shadow runtime and guarded execution | PATCH_EQ_IN_MAIN |
| b7929d0b2404 | docs(log): record shadow runtime integration finish | PATCH_EQ_IN_MAIN |
| 1abad471185d | fix(llm): ignore placeholder api keys in provider availability | PATCH_EQ_IN_MAIN |
| 9d287089a915 | docs(log): record groq key activation and llm verification | PATCH_EQ_IN_MAIN |
| c2274b0aa82d | docs(log): record deepseek gemini key activation check | PATCH_EQ_IN_MAIN |
| 28ba0aefd080 | fix(chat): enforce market reply quality contract | PATCH_EQ_IN_MAIN |
| bdd9856ba3c8 | docs(log): finalize chat quality fix run details | PATCH_EQ_IN_MAIN |
| d474151f28c7 | feat(chat): inject multi-timeframe indicator context | PATCH_EQ_IN_MAIN |
| 8be638d70880 | docs(log): finalize W-20260226-0317 backend entry | PATCH_EQ_IN_MAIN |
| ca6dfec52a37 | docs(log): record W-20260226-0327 advisory task | PATCH_EQ_IN_MAIN |
| 05d4c2f940b3 | docs(ml): design ORPO schema and pair pipeline | PATCH_EQ_IN_MAIN |
| 364774c0cf45 | docs(log): finalize W-20260226-0335 metadata | PATCH_EQ_IN_MAIN |
| e7f466468128 | feat(orpo): add v1 pair builder modules and dataset build API | PATCH_EQ_IN_MAIN |
| fb519e33b86b | docs(log): finalize W-20260226-0340 metadata | PATCH_EQ_IN_MAIN |
| 4af363f536bd | docs(log): finalize W-20260226-0353 sync/rebase validation | PATCH_EQ_IN_MAIN |
| 013c2ebb09d8 | docs(log): correct W-20260226-0353 commit/push metadata | PATCH_EQ_IN_MAIN |
| 869103c705eb | docs(log): record blocked merge attempt for PR #34 | PATCH_EQ_IN_MAIN |
| 560f78518119 | docs(log): correct W-20260226-0402 metadata | PATCH_EQ_IN_MAIN |
| b6b85ecc74af | docs(log): record W-20260226-0405 blocked merge attempt | PATCH_EQ_IN_MAIN |
| 759a297c287c | docs(log): correct W-20260226-0405 metadata | PATCH_EQ_IN_MAIN |
| 197deaf78f1e | docs(log): record W-20260226-0408 blocked merge polling | PATCH_EQ_IN_MAIN |
| 5d563afe319f | feat(context): add multi-agent save/compact/restore protocol and tooling | MISSING_IN_MAIN |
| ca03f8ffcba8 | feat(devx): enable automatic context save/compact in hooks and safe f… | MISSING_IN_MAIN |
| 6b84b51ac19f | docs(log): finalize W-20260226-2209 metadata | PATCH_EQ_IN_MAIN |
| fba8300d50ce | docs(collab): add preferred TL/execution model routing note | PATCH_EQ_IN_MAIN |
| [#32](https://github.com/eunjuhyun88/Maxidoge/pull/32) | OPEN | codex/brand-rename-stockclaw-20260225 | DIRTY | REVIEW_REQUIRED | 1 | 0 | 0 | 1 |

## PR #32: feat(brand): rename MAXIDOGE to Stockclaw

- URL: https://github.com/eunjuhyun88/Maxidoge/pull/32
- PR state: OPEN
- Head: origin/codex/brand-rename-stockclaw-20260225
- Merge state: DIRTY
- Review decision: REVIEW_REQUIRED

| Commit | Headline | Main status |
|---|---|---|
| e2a25b9677cd | feat(brand): rename app name to Stockclaw | MISSING_IN_MAIN |
| [#23](https://github.com/eunjuhyun88/Maxidoge/pull/23) | OPEN | codex/git-collab-policy-share | DIRTY | REVIEW_REQUIRED | 3 | 0 | 0 | 3 |

## PR #23: docs: share SSOT git collaboration policy addendum

- URL: https://github.com/eunjuhyun88/Maxidoge/pull/23
- PR state: OPEN
- Head: origin/codex/git-collab-policy-share
- Merge state: DIRTY
- Review decision: REVIEW_REQUIRED

| Commit | Headline | Main status |
|---|---|---|
| 803744c6b6b2 | docs(collab): publish ssot git collaboration policy | MISSING_IN_MAIN |
| f5d4d9d2aced | docs(log): finalize W-20260225-0352 finish entry | MISSING_IN_MAIN |
| fbc564d7db29 | docs(log): update W-20260225-0352 PR status | MISSING_IN_MAIN |

## Suggested Cleanup

- OPEN + Missing=0: close as redundant.
- OPEN + Missing>0: rebase and create clean replacement PR.
- CLOSED + Missing>0: reopen only if those missing commits are still needed.
