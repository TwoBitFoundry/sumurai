# Token Policy

Use this policy when changing Sumurai tokens, theme values, or styling constants.

## Source Roles

- `DESIGN.md` is the design intent and agent-readable contract.
- `frontend/src/ui/tokens/index.ts` is the current TypeScript implementation token surface.
- `frontend/src/ui/tokens/tailwind-bridge.js` exposes a limited Tailwind bridge.
- `frontend/tailwind.config.js` consumes the bridge.
- Future generated artifacts should come from `DESIGN.md` or its exported DTCG shape, not from hand-copying values between files.

## Token Boundaries

- Primitive tokens describe visual roles, not file-specific accidents.
- Semantic finance colors are for meaning, not decoration.
- Category colors are for stable labels, dots, and rings.
- Shell gradients and ambient effects belong in token/effect bundles, not page views.
- Component recipes can use Tailwind classes today, but reusable values should stay centralized.

## Naming Guidance

- Prefer semantic names such as `surface`, `chart`, `finance`, `category`, `action`, `danger`, and `muted`.
- Avoid names that encode a single page unless the visual role is truly page-specific.
- Keep token names aligned with `DESIGN.md` when adding or renaming roles.
- Do not add a new token if an existing token already expresses the same role.

## Anti-Patterns

- Copying hex values from `DESIGN.md` into views.
- Adding arbitrary gradients or shadows in page files.
- Creating a new component-specific token for a repeated primitive role.
- Letting Tailwind class arrays become the only place design meaning exists.
- Updating implementation tokens without checking whether `DESIGN.md` should change too.

## Validation

- Run `npm --prefix frontend run design:lint` after token or design document changes.
- Run focused tests for components that consume changed tokens.
- For broad visual changes, prefer visual/browser verification in both light and dark modes.
