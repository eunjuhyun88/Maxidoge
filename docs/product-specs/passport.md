# Passport Product Spec

Purpose:
- Short product spec for profile, progression, and learning history.

## Primary User Job

Show the user who they are in the system: stats, progression, achievements, and learning traces.

## Current Route Shape

- `/passport` currently operates as a four-tab route: `wallet`, `positions`, `profile`, and `arena`.
- The route already treats holdings sync, open/closed positions, avatar/name edits, and learning actions as first-class features.
- Live holdings can fall back to demo holdings when sync is unavailable.
- Use `docs/page-specs/passport-page.md` for the actual route contract; keep this file focused on Passport's surface intent.

## Core Flows

1. Load profile and progression.
2. Show badges, tiers, and history.
3. Reflect durable actions and outcomes from other surfaces.
4. Surface learning or performance artifacts without letting the client author them.

## Product Constraints

- Profile and badge state are server-derived or server-validated.
- The UI should not imply earned state that the server cannot justify.
- Passport should unify identity and history rather than becoming another ad hoc dashboard.
- Badge and mission surfaces should be compatible with the system's data-coverage goals.
- Contribution, calibration, and weak-spot feedback should remain explainable from durable records.
- Current route-level wallet and positions affordances should stay consistent with those durable records even when holdings fall back to demo data.

## Supporting Docs

- `docs/design-docs/learning-loop.md`
- `docs/PASSPORT_BACKEND_ARCHITECTURE_v1_2026-02-25.md`
- `docs/PASSPORT_ML_ORPO_LEARNING_ARCHITECTURE_v2_2026-02-25.md`
- `docs/API_CONTRACT.md`
