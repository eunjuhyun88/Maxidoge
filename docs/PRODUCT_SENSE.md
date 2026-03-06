# PRODUCT_SENSE

Purpose:
- Product-facing constraints that should shape implementation decisions.
- Intended for agents making UI, flow, or feature-scope choices.

## Core Product Heuristics

1. Fast legibility beats density.
   - Users should understand what the product is telling them within seconds.

2. Same data, different interpretation.
   - Human-vs-agent value comes from reasoning quality, not hidden information asymmetry.

3. Gameplay and learning are coupled.
   - Arena actions should create understandable outcomes and reusable learning signals.

4. Action surfaces must feel trustworthy.
   - If a feature touches money, profile, or ranking, server authority and validation win over convenience.

5. Each surface should have a primary job.
   - Terminal: see and act quickly.
   - Arena: think, compare, decide.
   - Signals: monitor and convert.
   - Passport: inspect identity, history, and progression.

## Acceptance Questions

Before shipping a surface change, answer:
- Does this make the primary job clearer or noisier?
- Is the state ownership obvious?
- Does the user understand what is transient vs durable?
- If an agent reads the repo later, can it reconstruct the intended behavior?

## Source Docs

- `docs/SYSTEM_INTENT.md`
- `docs/product-specs/index.md`
- `docs/design-docs/learning-loop.md`
