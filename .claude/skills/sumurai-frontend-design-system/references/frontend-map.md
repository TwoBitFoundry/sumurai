# Frontend Map

Use this map to place frontend design-system changes in the right layer.

## Design Contract

- `DESIGN.md`: design intent, token meaning, design rationale, component guidance, and agent-facing guardrails.
- `.agents/skills/sumurai-design-token-pipeline/references/design-md-standard.md`: local summary of the `DESIGN.md` standard and validation/export commands.
- `docs/design-token-refactor-design-md-plan.md`: historical context for the current token refactor and remaining debt.

## Frontend Layers

- `frontend/src/ui/tokens.ts`: TypeScript token API for charts, finance semantics, categories, hero accents, and other runtime values; imports generated data from `frontend/src/ui/generated/tokens`.
- `frontend/src/ui/generated/`: machine-generated artifacts from the design pipeline (`tokens.ts`, `tokens.dtcg.json`, `theme.css`); treat as generated unless a script explicitly edits them.
- `frontend/src/ui/recipes.ts`: shared Tailwind class atoms composed by primitives and features.
- `frontend/src/ui/primitives`: reusable visual primitives such as `Button`, `GlassCard`, `Input`, `Select`, `Modal`, `Badge`, `Alert`, `EmptyState`, `AppTitleBar`, and `GradientShell`.
- `frontend/src/layouts`: reusable page and app layout shells.
- `frontend/src/features`: domain-specific feature components and hooks.
- `frontend/src/components`: shared app components that are not generic primitives.
- `frontend/src/views`: page-level composition, state wiring, and data flow.
- `frontend/tests`: tests for services, hooks, domain logic, components, primitives, and integration behavior.
- `frontend/tailwind.config.js`: Tailwind content paths and framework options; theme variables come from generated CSS consumed by the app, not from a separate bridge file in this repo.

## Placement Rules

- Put shared visual constants and runtime theme helpers in `frontend/src/ui/tokens.ts` and generated outputs, aligned with `DESIGN.md`.
- Put reusable Tailwind composition in `frontend/src/ui/recipes.ts` or primitive internals.
- Put reusable component chrome and interaction variants in `frontend/src/ui/primitives`.
- Put reusable domain UI in `frontend/src/features` or `frontend/src/components`.
- Keep `frontend/src/views` thin and page-focused.
- Keep tests under `frontend/tests`, not inline with source.

## Known Cleanup Targets

- `frontend/src/components/ui/Card.tsx` and `frontend/src/components/ui/Table.tsx` are legacy shared UI wrappers.
- Some views still contain raw Tailwind visual recipes mixed with token references.
