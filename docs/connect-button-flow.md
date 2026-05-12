# Connect Button Flow

## Overview
Make Plaid and Teller follow the same button-driven connect pattern so the user explicitly chooses when to initialize or retry, with no SDK load/init, token fetch, or retry happening before the first `Connect` click.

## Flow
```mermaid
flowchart TD
  idle[Idle: no SDK loaded] --> click[User clicks first Connect]
  click --> guard{Online?}
  guard -->|No| offline[Show offline message]
  guard -->|Yes| provider[Use selected provider]

  provider --> plaid[Plaid]
  provider --> teller[Teller]

  plaid --> plaidInit[Load/init Plaid + fetch token]
  teller --> tellerInit[Load/init Teller SDK]

  plaidInit --> plaidOpen[Open Plaid popup]
  tellerInit --> tellerOpen[Open Teller popup]

  plaidOpen --> success[Success]
  tellerOpen --> success

  plaidOpen --> fail[Popup blocked or init failed]
  tellerOpen --> fail

  fail --> retry[Button becomes Try again]
  retry --> click
```

## Phases

### Phase 1: Plaid onboarding click ownership
- Refactor [frontend/src/hooks/useOnboardingPlaidFlow.ts](../frontend/src/hooks/useOnboardingPlaidFlow.ts) so the first `Connect` click owns Plaid token fetch and popup open.
- Remove deferred open-on-ready behavior so nothing provider-specific happens before the click.

Acceptance criteria:
- [x] The onboarding screen does not fetch a Plaid token until `Connect` is clicked.
- [x] A failed Plaid popup/init leaves the button in `Try again` state.
- [x] Clicking `Try again` re-runs the same Plaid connect path.
- [x] Offline mode still short-circuits before any token fetch or popup attempt.

**TDD log (Phase 1):** Added hook tests for no link-token fetch on mount and offline short-circuit; replaced `shouldOpenLink` + effect with `waitForPlaidReady` (refs + bounded poll) after token fetch; fixed global `react-plaid-link` test mock in `tests/setup.ts` to use a stable `open` so assertions hit the same double. Commands: `npm test -- --testPathPatterns=useOnboardingPlaidFlow`, `npm run typecheck`, `npx biome check --write` on touched hook/tests.

### Phase 2: Teller onboarding click ownership
- Refactor [frontend/src/hooks/useOnboardingTellerFlow.ts](../frontend/src/hooks/useOnboardingTellerFlow.ts) so the first `Connect` click owns Teller script/init/open.
- Remove deferred open-on-ready behavior so Teller also stays behind the click path.

Acceptance criteria:
- [x] The onboarding screen does not initialize Teller until `Connect` is clicked.
- [x] A failed Teller popup/init leaves the button in `Try again` state.
- [x] Clicking `Try again` re-runs the same Teller connect path.
- [x] Offline mode still short-circuits before any Teller init or popup attempt.

**TDD log (Phase 2):** Added `connectSessionKey` gate so `useTellerConnect` receives an empty `applicationId` until the first connect/retry; replaced `shouldOpenConnect` effect with `waitForTellerReady` + `flushSync` on session bump; `handleError` clears `connectionInProgress`; wait loops use `performance.now()` so global `Date.now` test mocks do not stall timeouts. Tests use a side-effect mock setup module so `jest.mock` runs before hook import; added mount/offline/open/error coverage. Commands: `npm test -- --testPathPatterns='useOnboardingTellerFlow|useOnboardingPlaidFlow'`, Biome on touched paths.

### Phase 3: Accounts page flows
- Refactor [frontend/src/features/plaid/hooks/usePlaidLinkFlow.ts](../frontend/src/features/plaid/hooks/usePlaidLinkFlow.ts) so the accounts-page Plaid flow is click-owned too.
- Refactor [frontend/src/hooks/useTellerLinkFlow.ts](../frontend/src/hooks/useTellerLinkFlow.ts) so the accounts-page Teller flow follows the same pattern.

Acceptance criteria:
- [ ] The accounts page uses the same click-owned connect/retry behavior as onboarding for both providers.
- [ ] No provider popup/init work starts before the user clicks Connect.
- [ ] Retry uses the same button path after a popup/init failure.

### Phase 4: Button/view and tests
- Keep [frontend/src/components/onboarding/ConnectAccountStep.tsx](../frontend/src/components/onboarding/ConnectAccountStep.tsx) as a dumb button/view layer that switches between `Connect` and `Try again`.
- Update tests under [frontend/tests/hooks/](../frontend/tests/hooks/) and [frontend/tests/features/plaid/hooks/](../frontend/tests/features/plaid/hooks/) to assert click-owned connect/retry and offline short-circuiting.

Acceptance criteria:
- [ ] The button component only delegates to the provided handler and does not own provider logic.
- [ ] Tests prove the first click triggers the provider init path and the same button retries after failure.
- [ ] Tests prove offline mode blocks provider init for both providers.

## Assumptions
- The connect button remains the single user entry point for both initial connect and retry.
- Provider SDK setup can still happen inside the component tree as long as the actual init/open work waits for the click.
- Offline mode should short-circuit before any provider-specific init or token fetch starts.

## Risks
- Plaid and Teller may still have SDK lifecycle edge cases if script initialization is cached too aggressively across refreshes.
- Moving all init behind the button may require small state changes to avoid stale retries or double-opens.
- Existing tests may assume deferred-ready behavior and need to be updated together with the hook refactor.

## Next Actions
- Refactor the Plaid onboarding hook first.
- Then refactor the Teller onboarding hook to the same button-owned model.
- Follow with the accounts-page hooks.
- Finish by updating tests to prove first-click init and retry behavior for both providers.
