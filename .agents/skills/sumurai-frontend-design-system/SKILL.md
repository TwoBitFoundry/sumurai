---
name: sumurai-frontend-design-system
description: Use when working on Sumurai frontend UI, design-system, DESIGN.md, tokens, primitives, layouts, dashboards, pages, components, charts, or visual refactors. Guides agents to preserve the repo's token and primitive architecture instead of adding one-off styling.
---

# Sumurai Frontend Design System

Use this skill for frontend visual work in Sumurai. It applies to UI implementation, component refactors, token changes, primitive updates, page layout work, dashboard styling, and design-system audits.

## Required First Reads

Before changing frontend visuals, read:

- `DESIGN.md`
- `docs/design-md-standard.md`
- `frontend/src/ui/primitives/README.md`

Then read the relevant reference here:

- Repo structure: `references/frontend-map.md`
- Token workflow: `references/token-policy.md`
- Primitive workflow: `references/primitive-policy.md`

## Operating Rules

- Treat `DESIGN.md` as the design intent and agent-facing contract.
- Do not treat `DESIGN.md` as a Tailwind class warehouse.
- Prefer `frontend/src/ui/tokens` for shared visual values.
- Prefer `frontend/src/ui/primitives` before creating custom visual chrome.
- Keep page views focused on page composition, state wiring, and data flow.
- Move reusable UI into primitives or feature components.
- Keep raw hex values, arbitrary gradients, shadows, radii, and one-off surface chrome out of views unless intentionally local.
- If a local visual exception is necessary, call it out in the final implementation summary.
- Do not read or write `.env` files.
- Do not add comments to source code.
- Do not mention implementation stages in work material except plan documents.

## Workflow

1. Identify whether the change belongs in tokens, primitives, feature components, layouts, or views.
2. Inspect the nearest existing pattern before adding a new one.
3. Extend the smallest shared surface that avoids duplication.
4. Keep token names semantic and aligned with `DESIGN.md`.
5. Keep component APIs small and variant-driven.
6. Add or update tests when changing reusable behavior or component contracts.

## Validation

Run focused checks based on the change:

- `npm --prefix frontend run design:lint`
- `npm --prefix frontend test`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

For visible UI changes, also use a browser or screenshot workflow when practical.
