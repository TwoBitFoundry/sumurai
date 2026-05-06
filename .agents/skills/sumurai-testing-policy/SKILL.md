---
name: sumurai-testing-policy
description: Use when adding, updating, reviewing, or debugging Sumurai tests across frontend or backend. Guides agents to keep tests in existing test folders, prefer boundary-focused tests, and run the right validation commands.
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

- Backend: `cargo test --manifest-path backend/Cargo.toml`
- Backend type/build sanity: `cargo check --manifest-path backend/Cargo.toml`
- Frontend tests: `npm --prefix frontend test`
- Frontend typecheck: `npm --prefix frontend run typecheck`
- Frontend build: `npm --prefix frontend run build`
- Full repo validation when needed: `npm run precommit`
