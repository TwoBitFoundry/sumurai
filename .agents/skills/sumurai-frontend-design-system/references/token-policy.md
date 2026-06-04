# Token Policy

Use this policy when changing Sumurai tokens, theme values, or styling constants.

## Source Roles

- `DESIGN.md` is the design intent and agent-readable contract for token roles.
- `frontend/src/ui/tokens.ts` is the TypeScript surface for runtime consumers (charts, finance colors, categories, accents).
- `frontend/src/ui/generated/tokens.ts` and `frontend/src/ui/generated/theme.css` are produced by the design export pipeline; keep them aligned with `DESIGN.md` through `design:guard` and related scripts rather than duplicating values by hand.
- `frontend/tailwind.config.js` scopes Tailwind to app sources; visual tokens for CSS typically flow through generated theme output referenced by the app styles.
- Reusable class composition belongs in `frontend/src/ui/recipes.ts` and primitives, not copied ad hoc across views.

## Token Boundaries

- Primitive tokens describe visual roles, not file-specific accidents.
- Semantic finance colors are for meaning, not decoration.
- Category colors are for stable labels, dots, and rings.
- Shell gradients and ambient effects belong in token or effect bundles shared via recipes and primitives, not scattered in page views.
- Component recipes can use Tailwind classes today, but reusable values should stay centralized.

## Naming Guidance

- Prefer semantic names such as `surface`, `chart`, `finance`, `category`, `action`, `danger`, and `muted`.
- Avoid names that encode a single page unless the visual role is truly page-specific.
- Keep token names aligned with `DESIGN.md` when adding or renaming roles.
- Do not add a new token if an existing token already expresses the same role.

## Anti-Patterns

- Copying hex values from `DESIGN.md` into views instead of using generated CSS variables or `@/ui/tokens`.
- Adding arbitrary gradients or shadows in page files.
- Creating a new component-specific token for a repeated primitive role.
- Letting Tailwind class arrays become the only place design meaning exists.
- Updating implementation tokens without checking whether `DESIGN.md` should change too.

## Validation

- Run `bun --cwd=frontend run design:lint` after token or design document changes.
- Run `bun --cwd=frontend run design:guard` when changing `DESIGN.md` or the generation pipeline.
- Run focused tests under `frontend/tests/ui/tokens/` when token contracts change.
- For broad visual changes, prefer visual or browser verification in both light and dark modes.
