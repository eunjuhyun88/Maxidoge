# Terminal Product Spec

Purpose:
- Short product spec for Terminal, Intel, Scan, and fast action work.

## Primary User Job

Let the user understand market context quickly and decide whether to act.

## Current Route Shape

- `/terminal` currently ships as three route shells: mobile, tablet, and desktop.
- The route runtime is already split into layout, action, chat, and community-share concerns.
- Live ticker loading, density mode, background alert scanning, copy-trade bootstrap, and share modal all live inside the route now.
- Use `docs/page-specs/terminal-page.md` for the actual route contract; keep this file focused on surface intent.

## Core Flows

1. Fetch scan/intel context.
2. See agent reasoning, events, and flow signals.
3. Compare competing interpretations.
4. Convert into trade, track, or dismiss actions.

## Product Constraints

- Terminal should privilege scan legibility over decorative density.
- Layout logic, orchestration, and presentation should not collapse into one god-shell.
- Users should understand what is live, cached, or simulated.
- Data and action flows should remain inspectable by future agents.
- The current route already includes trade/share conversion affordances inside the shell, not as separate follow-up surfaces.

## Supporting Docs

- `docs/terminal-refactor-master-plan-2026-03-06.md`
- `docs/terminal-uiux-refactor-design-v3-2026-03-06.md`
- `docs/TERMINAL_SCAN_E2E_SPEC.md`
- `docs/INTERACTION_CALL_MAP.md`
