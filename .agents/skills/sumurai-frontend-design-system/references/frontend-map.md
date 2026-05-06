# Frontend Map

Use this map to place frontend design-system changes in the right layer.

## Design Contract

- `DESIGN.md`: design intent, token meaning, design rationale, component guidance, and agent-facing guardrails.
- `docs/design-md-standard.md`: local summary of the `DESIGN.md` standard and validation/export commands.
- `docs/design-token-refactor-design-md-plan.md`: historical context for the current token refactor and remaining debt.

## Frontend Layers

- `frontend/src/ui/tokens`: implementation token surface for colors, typography, radii, spacing, shadows, gradients, motion, semantic finance colors, charts, and recurring component recipes.
- `frontend/src/ui/primitives`: reusable visual primitives such as `Button`, `GlassCard`, `Input`, `Select`, `Modal`, `Badge`, `Alert`, `EmptyState`, `AppTitleBar`, and `GradientShell`.
- `frontend/src/layouts`: reusable page and app layout shells.
- `frontend/src/features`: domain-specific feature components and hooks.
- `frontend/src/components`: shared app components that are not generic primitives.
- `frontend/src/views`: page-level composition, state wiring, and data flow.
- `frontend/tests`: tests for services, hooks, domain logic, components, primitives, and integration behavior.

## Placement Rules

- Put shared visual values in `frontend/src/ui/tokens`.
- Put reusable component chrome and interaction variants in `frontend/src/ui/primitives`.
- Put reusable domain UI in `frontend/src/features` or `frontend/src/components`.
- Keep `frontend/src/views` thin and page-focused.
- Keep tests under `frontend/tests`, not inline with source.

## Known Cleanup Targets

- `frontend/src/components/ui/Card.tsx` and `frontend/src/components/ui/Table.tsx` are legacy shared UI wrappers.
- Some views still contain raw Tailwind visual recipes mixed with token references.
- Tailwind custom values are split between `DESIGN.md`, `frontend/src/ui/tokens/index.ts`, and `frontend/src/ui/tokens/tailwind-bridge.js`.
