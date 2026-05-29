# DESIGN.md Standard

`DESIGN.md` is the standard published by `google-labs-code/design.md`.

- Official repo: <https://github.com/google-labs-code/design.md>
- Full spec: <https://github.com/google-labs-code/design.md/blob/main/docs/spec.md>
- Global CLI: `designmd`

## File Structure

`DESIGN.md` uses YAML front matter for normative machine-readable tokens and Markdown body text for human-readable rationale.

The front matter should define the token system the implementation consumes. The body should explain how those tokens are used in practice.

## Canonical Section Order

1. Overview
2. Colors
3. Typography
4. Layout
5. Elevation & Depth
6. Shapes
7. Components
8. Do's and Don'ts

## Validation And Export

Use the global CLI directly:

- `designmd lint DESIGN.md`
- `designmd export --format dtcg DESIGN.md`
- `designmd export --format css-tailwind DESIGN.md`
- `designmd diff DESIGN.md DESIGN-v2.md`
- `designmd spec --rules`

## Guidance

Keep the YAML front matter aligned with the implementation token names.
Keep the Markdown body short and explicit.
Do not mix exploratory prose into the token schema.
