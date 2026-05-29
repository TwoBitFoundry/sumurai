---
name: sumurai-design-token-pipeline
description: Use when working on Sumurai DESIGN.md, designmd exports, DTCG tokens, Tailwind theme variables, TypeScript design tokens, token drift, or design-token generation. Guides agents to keep design intent and generated implementation artifacts aligned.
---

# Sumurai Design Token Pipeline

Use this skill for token pipeline planning, token generation, `DESIGN.md` changes, designmd validation/export, Tailwind-facing CSS output, and TypeScript token drift cleanup. For how primitives and screens consume tokens, use `sumurai-frontend-design-system`.

## Required Reads

Before token pipeline work, read:

- `DESIGN.md`
- `.agents/skills/sumurai-design-token-pipeline/references/design-md-standard.md`
- `frontend/src/ui/tokens.ts`
- `frontend/src/ui/generated/tokens.ts`
- `frontend/src/ui/generated/theme.css`
- `frontend/tailwind.config.js`
- `references/token-pipeline.md`

## Operating Rules

- Treat `DESIGN.md` as the agent-facing design contract.
- Do not turn `DESIGN.md` into a Tailwind class warehouse.
- Prefer generated token artifacts over manually duplicated values.
- Keep semantic token names stable and meaningful.
- Keep implementation recipes in `frontend/src/ui/recipes.ts` and primitives, not prose-only docs.
- Do not read or write `.env` files.
- Do not add comments to source code.

## Workflow

1. Decide whether the change is design intent, generated artifact, `tokens.ts` wiring, or component recipe.
2. Update `DESIGN.md` only when design meaning or public token roles change.
3. Keep TypeScript tokens, generated TS, and generated CSS aligned with design roles.
4. Prefer adding generation or drift checks before large token rewrites.
5. Validate `DESIGN.md` after token changes.

## Validation

- `npm --prefix frontend run design:lint`
- `npm --prefix frontend run design:export:dtcg`
- `npm --prefix frontend run design:export:tailwind`
- `npm --prefix frontend test -- --runTestsByPath tests/ui/tokens/runtime.test.ts`
- `npm --prefix frontend run typecheck`
