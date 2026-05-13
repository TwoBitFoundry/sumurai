# Primitive Policy

Use this policy when adding or modifying frontend components.

## Primitive Layer

Primitives in `frontend/src/ui/primitives` are the reusable visual and interaction foundation. They should own shared component chrome, sizes, variants, focus behavior, and accessibility defaults.

Good primitive candidates:

- Buttons and icon buttons
- Inputs and selects
- Modals and dialogs
- Badges, pills, alerts, empty states
- Shared shells, title bars, menus, cards, and footers

## Feature Layer

Feature components should compose primitives for a specific domain workflow. Put them under the relevant `frontend/src/features/*/components` folder when they are feature-specific, or `frontend/src/components` when they are shared app components.

Good feature component candidates:

- Budget list rows and budget progress UI
- Transaction filters and transaction tables
- Provider connection cards
- Account rows and bank cards
- Dashboard widgets

## View Layer

Views should orchestrate page layout, state, data loading, and feature composition. Views should not define reusable visual systems.

Keep in views:

- Page-level composition
- Data and hook wiring
- Route/tab-level conditionals
- Page-specific empty or loading placement

Move out of views:

- Repeated card shells
- Repeated status pills
- Repeated toolbar buttons
- Repeated table/list row styling
- Repeated chart chrome

## Variant Rules

- Prefer existing primitive variants before adding `className` overrides.
- Add a primitive variant when the same visual role appears in more than one place.
- Use feature components when variants need domain-specific data or copy.
- Keep primitive APIs small and predictable.
- Avoid passing large class strings from views into primitives.

## Accessibility

- Preserve native semantics where available.
- For complex interactions such as dialogs, menus, popovers, tabs, and selects, prefer proven headless primitives when custom behavior grows.
- Ensure icon-only actions have accessible labels.
- Preserve visible focus styles and keyboard behavior.
