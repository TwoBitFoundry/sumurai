# Token Pipeline

Use this reference when aligning `DESIGN.md`, frontend tokens, and generated artifacts.

## Current State

- `DESIGN.md` contains YAML front matter with design tokens and Markdown rationale.
- `.agents/skills/sumurai-design-token-pipeline/references/design-md-standard.md` documents the local standard and designmd commands.
- `frontend/src/ui/tokens.ts` is the hand-maintained TypeScript API that imports generated token data from `frontend/src/ui/generated/tokens`.
- `frontend/src/ui/generated/theme.css` and related exports carry CSS variables and Tailwind-oriented output from the designmd export chain.
- `frontend/tailwind.config.js` configures Tailwind content paths; the app consumes generated theme CSS through the normal stylesheet graph.
- Tests under `frontend/tests/ui/tokens/` protect token and recipe contracts.

## Desired Direction

The clean pipeline is:

`DESIGN.md` -> designmd export -> DTCG token shape -> generated CSS and TypeScript artifacts -> `tokens.ts`, recipes, and primitives.

`DESIGN.md` should explain intent and machine-readable token roles. Generated files should carry implementation constants. Primitives should translate tokens into component behavior and variants.

## Token Roles

- Colors: brand, chart, semantic finance, category, surface, text, border, and state roles.
- Typography: brand, body, label, pill, badge, and compact data roles.
- Spacing and radii: page framing, shell spacing, component gaps, panels, cards, controls, and pills.
- Elevation and effects: glass shadows, inset highlights, ambient shell effects, and focused component shadows.
- Component tokens: stable reusable roles, not page-specific one-offs.

## Guardrails

- Do not hand-copy the same hex across `DESIGN.md`, TypeScript, Tailwind usage, and views.
- Do not add arbitrary visual utilities in views when a token or primitive role exists.
- Do not rename exported token roles casually; this breaks agents and implementation consumers.
- Do not hand-edit generated files except through the documented generation scripts.

## Validation

- Run designmd lint for every `DESIGN.md` change.
- Run DTCG and Tailwind exports when token shape changes.
- Run token tests after changing `frontend/src/ui/tokens.ts`, generated outputs, or related recipes.
- Run focused visual checks for broad palette, radius, typography, or elevation changes.
