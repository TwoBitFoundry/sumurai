---
name: sumurai-testing-policy
description: Use when adding, updating, reviewing, or debugging Sumurai tests across frontend or backend, including Bun test, Storybook Vitest, and Playwright Storybook smoke runs. Guides agents to keep tests in existing test folders, prefer boundary-focused tests, and run the right validation commands.
---

# Sumurai Testing Policy

Use this skill for test creation, test refactors, failing test investigation, and implementation work that changes behavior.

## Required Reads

Read the relevant reference before changing tests:

- Test layout and commands: `references/test-map.md`
- Testing rules and boundaries: `references/testing-rules.md`

## Operating Rules

- Keep tests in existing test folders.
- Do not add tests inline with source code.
- Prefer boundary-focused tests over testing private implementation details.
- Test observable behavior, contracts, edge cases, and integration boundaries.
- Keep mocks and fixtures declarative and deterministic.
- Use existing test utilities before adding new ones.
- Use Storybook Vitest for browser-rendered UI behavior (interactions, loading and error states, validation display, callbacks) when Bun test alone is not the right boundary; keep Playwright Storybook runtime for static build and iframe smoke, not fine-grained behavior specs.
- Do not read or write `.env` files.
- Do not add comments to source code.

## Workflow

1. Identify the changed behavior and its boundary.
2. Find the nearest existing test file and utility pattern.
3. Add the smallest test coverage that would fail for the bug or missing behavior.
4. Keep fixtures close to existing fixture conventions.
5. Run focused tests first, then broader checks when shared behavior changed.

## Validation

Use the commands that match the touched area:

- Backend: `cargo test -p sumurai-backend --locked` (from repository root; or `bun run backend:ci`)
- Backend type/build sanity: `cargo check --workspace --locked --all-targets`
- Frontend tests: `bun --cwd=frontend test`
- Storybook browser tests (Vitest project): `bun --cwd=frontend run test:storybook`
- Storybook static build + Playwright iframe smoke: `bun --cwd=frontend run test:storybook-runtime` (needs Playwright Chromium; use `bun run frontend:playwright-install` or `bun --cwd=frontend run playwright:install-ci` to match CI)
- Frontend typecheck: `bun --cwd=frontend run typecheck`
- Frontend build: `bun --cwd=frontend run build`
- Full repo validation (default Husky hook): `bun run precommit`
- Full CI parity for backend + frontend install job: `bun run backend:ci && bun run frontend:ci`
