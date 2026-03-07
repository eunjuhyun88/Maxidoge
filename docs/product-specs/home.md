# Home Product Spec

Purpose:
- Short product spec for the landing, onboarding, and first-action path.

## Primary User Job

Help the user understand what STOCKCLAW is and reach a real surface quickly.

## Current Route Shape

- `/` currently behaves as a hero-led landing route, not a signup/demo wizard.
- The hero supports feature exploration:
  - desktop swaps hero detail content inline
  - mobile opens a feature bottom sheet
- Primary CTA routes into `/terminal`.
- Secondary CTA is wallet-gated:
  - connected users can enter `/arena`
  - disconnected users get wallet connect
- Funnel events are part of the route contract today.
- Use `docs/page-specs/home-onboarding.md` for the detailed route contract.

## Core Flows

1. Land on the home route and understand the product promise.
2. Explore one feature path without leaving the hero context.
3. Choose the next action:
   - enter Terminal
   - connect wallet
   - enter Arena when already connected

## Product Constraints

- The first valuable path should remain available without forced wallet connection.
- The page should explain the product through the hero, not through a long setup checklist.
- Desktop and mobile feature exploration should remain semantically aligned.
- Landing analytics should reflect the real current CTA paths.

## Supporting Docs

- `docs/page-specs/home-onboarding.md`
- `docs/PRODUCT_SENSE.md`
- `docs/generated/route-map.md`
