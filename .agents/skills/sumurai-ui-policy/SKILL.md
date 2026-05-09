---
name: sumurai-ui-policy
description: Use when working on Sumurai frontend UI, design-system, DESIGN.md, tokens, primitives, layouts, pages, components, charts, or visual refactors. Guides agents to keep UI work inside the shared primitive and recipe surface instead of inventing one-off styling.
---

# Sumurai UI Policy

Use this skill for Sumurai frontend UI work. It tells you where to look first and how to compose new UI without rebuilding a registry of ad hoc styles.

## Required First Reads

Before changing frontend visuals, read:

- `DESIGN.md`
- `frontend/src/ui/primitives/README.md`
- `frontend/src/ui/recipes.ts`
- `frontend/src/ui/tokens.ts`

Then read `examples.md` in this skill directory when you want a concrete composition example.

## Operating Rules

- Treat `DESIGN.md` as the visual contract.
- Do not add component recipes, gradients, shadows, hover states, or animations to `DESIGN.md`.
- Prefer primitives from `@/ui/primitives` before writing custom chrome.
- Use `@/ui/recipes` for shared class atoms when authoring primitives or feature components.
- Use `@/ui/tokens` only for runtime JS values such as chart series, finance colors, category accents, and account-type dots.
- Keep reusable styling in primitives or feature components; keep screens focused on composition, state, and data flow.
- Do not import a `designTokens` object.
- Do not hardcode Tailwind palette colors when a CSS variable or shared recipe exists.
- If a new reusable visual role is needed, edit `DESIGN.md`, run `npm --prefix frontend run design:guard`, regenerate tokens, and expose it through a primitive.
- Do not read or write `.env` files.

## Workflow

1. Inspect the nearest existing primitive or feature component.
2. Prefer the smallest shared surface that covers the change.
3. Add a new primitive variant only when composition would otherwise be repetitive or fragile.
4. Keep component APIs small and variant-driven.
5. Add or update tests when behavior changes.
6. Use a browser or screenshot check for visible UI changes when practical.

## References

- `examples.md` - good and bad compositions
