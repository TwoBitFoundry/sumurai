---
name: sumurai-frontend-design-system
description: Use when working on Sumurai frontend UI, design-system, DESIGN.md, tokens, primitives, layouts, pages, components, charts, or visual refactors. Authoritative skill for composing with shared primitives, recipes, and tokens instead of one-off styling.
---

# Sumurai Frontend Design System

Use this skill for UI implementation, component refactors, token-aware styling, primitive updates, page layout work, dashboard styling, and design-system audits. For export-only and drift work on generated artifacts, also follow `sumurai-design-token-pipeline`.

## Required First Reads

Before changing frontend visuals, read:

- `DESIGN.md`
- `.agents/skills/sumurai-design-token-pipeline/references/design-md-standard.md`
- `frontend/src/ui/primitives/README.md`
- `frontend/src/ui/recipes.ts`
- `frontend/src/ui/tokens.ts`

Then read the references in this skill directory:

- Repo structure: `references/frontend-map.md`
- Token workflow: `references/token-policy.md`
- Primitive workflow: `references/primitive-policy.md`
- Composition examples: `examples.md`

## Operating Rules

- Treat `DESIGN.md` as the design intent and the visual contract for token roles and rationale.
- Do not add component recipes, gradients, shadows, hover states, or animations to `DESIGN.md`.
- Do not treat `DESIGN.md` as a Tailwind class warehouse.
- Prefer primitives from `@/ui/primitives` before writing custom chrome.
- Use `@/ui/recipes` for shared class atoms when authoring primitives or feature components.
- Use `@/ui/tokens` only for runtime JS values such as chart series, finance colors, category accents, and account-type dots. `frontend/src/ui/tokens.ts` re-exports generated token data from `frontend/src/ui/generated/tokens`; do not hand-copy the same constants into views.
- Do not import or introduce a monolithic `designTokens` object in app code; use named exports from `@/ui/tokens` and recipes.
- Do not hardcode Tailwind palette utility colors when a CSS variable from generated theme output or a shared recipe exists.
- If a new reusable visual role is needed, update `DESIGN.md`, run `bun --cwd=frontend run design:guard`, and expose it through primitives or `recipes.ts` as appropriate.
- Keep page views focused on composition, state wiring, and data flow; move reusable UI into primitives or feature components.
- Keep raw hex values, arbitrary gradients, shadows, radii, and one-off surface chrome out of views unless intentionally local; if you rely on a local exception, say so in the implementation summary.
- Do not read or write `.env` files.
- Do not add comments to source code.
- Do not mention implementation stages in work material except in plan documents.

## Workflow

1. Identify whether the change belongs in `DESIGN.md`, generated tokens, `tokens.ts`, `recipes.ts`, primitives, feature components, layouts, or views.
2. Inspect the nearest existing primitive, recipe, or feature component before adding a new pattern.
3. Prefer the smallest shared surface that covers the change.
4. Add a new primitive variant only when composition would otherwise be repetitive or fragile.
5. Keep component APIs small and variant-driven.
6. Add or update tests when reusable behavior or component contracts change.
7. Use a browser or screenshot check for visible UI changes when practical.

## Validation

Run focused checks based on the change:

- `bun --cwd=frontend run design:lint`
- `bun --cwd=frontend run design:guard` when `DESIGN.md` or token generation is involved
- `bun --cwd=frontend test`
- `bun --cwd=frontend run typecheck`
- `bun --cwd=frontend run build`
