# Token Pipeline

Use this reference when aligning `DESIGN.md`, frontend tokens, and generated artifacts.

## Current State

- `DESIGN.md` contains YAML front matter with design tokens and Markdown rationale.
- `docs/design-md-standard.md` documents the local standard and designmd commands.
- `frontend/src/ui/tokens/index.ts` is the current TypeScript token API.
- `frontend/src/ui/tokens/tailwind-bridge.js` provides a limited Tailwind bridge.
- `frontend/tailwind.config.js` consumes the bridge.
- `frontend/tests/ui/tokens/designTokens.test.ts` protects selected token contracts.

## Desired Direction

The clean pipeline is:

`DESIGN.md` -> designmd export -> DTCG token shape -> generated CSS/Tailwind/TypeScript artifacts -> primitives and feature components.

`DESIGN.md` should explain intent and machine-readable token roles. Generated files should carry implementation constants. Primitives should translate tokens into component behavior and variants.

## Token Roles

- Colors: brand, chart, semantic finance, category, surface, text, border, and state roles.
- Typography: brand, body, label, pill, badge, and compact data roles.
- Spacing and radii: page framing, shell spacing, component gaps, panels, cards, controls, and pills.
- Elevation and effects: glass shadows, inset highlights, ambient shell effects, and focused component shadows.
- Component tokens: stable reusable roles, not page-specific one-offs.

## Guardrails

- Do not hand-copy the same hex across `DESIGN.md`, TypeScript, Tailwind config, and views.
- Do not add arbitrary visual utilities in views when a token or primitive role exists.
- Do not rename exported token roles casually; this breaks agents and implementation consumers.
- When adding generated artifacts later, mark them clearly and do not hand-edit them.

## Validation

- Run designmd lint for every `DESIGN.md` change.
- Run DTCG and Tailwind exports when token shape changes.
- Run token tests after changing `frontend/src/ui/tokens`.
- Run focused visual checks for broad palette, radius, typography, or elevation changes.
