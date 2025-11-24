# Next.js Migration Progress

## Plan (TDD-minded)
- Inventory/mirror: map legacy routes/components/providers/tests to App Router layout without changing architecture.
- Bootstrap: Next 16 + TS + Tailwind v4 + Jest/RTL lint stack (done).
- Foundations: migrate utils/services/context/hooks with DI boundaries; ensure SSR/client guards.
- Routing/UI: wire App Router layouts/pages, navigation, and data fetching; keep client components where needed.
- Styling/assets: port globals, primitives, and theming wrappers.
- Tests: adapt Vitest->Jest setup; fix compatibility without rewriting assertions.
- Refactor/verify: green test run, lint clean, trim console noise, and keep React Compiler toggleable if issues surface.

## Status
- Baseline: Next 16 (Node runtime) scaffolded with App Router; lint (ESLint flat) and Jest harness configured; Tailwind v4 wired; React Compiler enabled behind config.
- Code migrated: services, utils, types, contexts, hooks, components/layouts/pages copied from legacy `frontend` with client entry at `src/app/page.tsx`.
- Tests: Jest single-run setup with RTL; converted Vitest globals via shim; key suites passing (ApiClient, TokenRefresh, Telemetry, AuthService integration, App component, SettingsService).
- Lint: `npm run lint` clean; custom Tailwind utility-count rule ported; `no-img-element` temporarily disabled to mirror legacy usage.
- Outstanding: finish routing/app structure wiring for Next app; adapt remaining components to App Router patterns; run full Jest suite; verify env vars (`NEXT_PUBLIC_*`) and consider React Compiler opt-out toggle if issues arise.
