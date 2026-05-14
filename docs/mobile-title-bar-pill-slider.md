# Mobile Title Bar Redesign + Pill Slider Refactor

## Context

The current `AppTitleBar` is desktop-only — it causes horizontal overflow on mobile, has no responsive layout, and uses individual pill buttons per tab (no unified slider effect). The filter and theme toggle clutter the title bar. This plan refactors the navigation into a unified pill slider, adds a two-row mobile layout, moves the filter to a persistent bottom bar with an inline time range picker, and relocates the theme toggle to Settings.

## Design Token Requirement

All new UI must consume tokens from `@/ui/recipes` (the semantic recipe layer generated from `DESIGN.md`). No raw hex values, no hardcoded Tailwind color utilities like `sky-400` or `violet-500`. Specific rules:
- **Backgrounds**: use `surface.*` recipes — e.g. `surface.mutedChip`, `surface.card`, `surface.glassPanel`
- **Borders**: use `border.*` recipes — e.g. `border.subtle`, `border.glass`, `border.divider`
- **Active gradient**: reuse the existing `buttonRecipes.tabActive` class list (defined in `Button.tsx`) — do not write a new gradient string. Extract it to a shared constant if needed.
- **Text colors**: use `text.*` recipes — e.g. `text.muted`, `text.primary`, `text.inverse`
- **Status colors**: use `status.success.*`, `status.warning.*` for online indicator
- **Effects**: use `effect.glassShadow` for backdrop shadows
- **Radius**: use `--radius-pill` (9999px) for pill shapes via `rounded-[length:var(--radius-pill)]` or simply `rounded-full`
- **New recipe constants**: add to `appTitleBarRecipes` in `AppTitleBar.tsx` (for title bar–scoped styles) or to `@/ui/recipes` if shared across components

---

## Final Layout Targets

### Desktop title bar
```
[Logo Sumurai]  [Dashboard  Transactions  Budgets  Accounts]   [● Online]  [⚙]  [Logout]
```

### Mobile title bar (two rows)
```
Row 1: [Logo Sumurai]  ·····  [wifi]  [⚙]  [⏻]
Row 2: [Dashboard  T  B  A]   ← swipe left/right to change tab
```

### Bottom bar (all tabs, both desktop + mobile)
```
All tabs:   [⊟ filter icon]
Dashboard:  [⊟ filter icon]  [1M  2M  3M  6M  1Y  5Y]
```

---

## Phase 1 — Relocate Filter + Theme Toggle

**Goal:** Clean up the title bar by extracting non-nav concerns before touching the nav layout.

### Changes

**`frontend/src/components/HeaderAccountFilter.tsx`**
- Add `triggerStyle?: 'default' | 'icon-only'` prop. When `'icon-only'`, render only the `Building2` icon (no text, no `ChevronDown`), `aria-label="Filter accounts"`
- Flip popover to open **above** the trigger (was below):
  ```
  Was:  top: triggerRect.bottom + POPOVER_GAP_PX,  right: window.innerWidth - triggerRect.right
  Now:  bottom: window.innerHeight - triggerRect.top + POPOVER_GAP_PX,  left: triggerRect.left
  ```

**`frontend/src/features/analytics/components/DateRangePillSlider.tsx`** *(new file)*
- Compact pill slider using Framer Motion `layoutId="time-pill-active"` (same pattern as tab nav)
- Props: `{ dateRange: DateRange; onChange: (r: DateRange) => void }`
- Short labels: `1M | 2M | 3M | 6M | 1Y | 5Y`
- Shell: use `appTitleBarRecipes.pillContainer` (the same constant added in Phase 2) — do not duplicate the class string
- Active indicator: `motion.div layoutId="time-pill-active"` using `buttonRecipes.tabActive` gradient classes (re-export or import from `Button.tsx`), spring transition `{ stiffness: 400, damping: 35 }`
- Text: `font.label` + `text.primary` for inactive, `text.inverse` for active (inherits from gradient bg)
- No icons — labels only

**`frontend/src/layouts/AppLayout.tsx`**
- Add `bottomBarContent?: ReactNode` prop
- Remove `renderAccountFilter` prop
- Add fixed bottom-left bar (always rendered when authenticated):
  ```tsx
  <div className="fixed bottom-5 left-4 z-50 flex items-center gap-2">
    <HeaderAccountFilter triggerStyle="icon-only" />
    {bottomBarContent}
  </div>
  ```

**`frontend/src/components/AuthenticatedApp.tsx`**
- Add `dateRange` state: `useState<DateRange>('current-month')` (lifted from DashboardPage)
- Compute and pass `bottomBarContent`:
  ```tsx
  const bottomBarContent = tab === 'dashboard'
    ? <DateRangePillSlider dateRange={dateRange} onChange={setDateRange} />
    : null;
  ```
- Pass `dateRange`/`setDateRange` as props to `DashboardPage`
- Remove `renderAccountFilter` callsite; remove `onThemeToggle`/`themeMode` from `AppTitleBar` call

**`frontend/src/views/DashboardPage.tsx`**
- Accept `dateRange: DateRange` and `setDateRange: (r: DateRange) => void` as props (remove internal `useState`)
- Remove `DashboardFloatingDateRangeSelector` component entirely
- Remove `spendingOverviewRef` ref and `IntersectionObserver` effect

**`frontend/src/views/SettingsPage.tsx`**
- Add **Appearance** section at top (before password section), using `useTheme()` directly:
  ```tsx
  <GlassCard>
    <h2 className={uiTypographyRecipes.sectionTitle}>Appearance</h2>
    <div className="flex items-center justify-between">
      <div>
        <p className={uiTypographyRecipes.body}>Theme</p>
        <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
          Switch between light and dark mode
        </p>
      </div>
      <Button onClick={toggle} variant="secondary" size="xs" aria-label="Toggle theme">
        {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        <span>{mode === 'dark' ? 'Dark' : 'Light'}</span>
      </Button>
    </div>
  </GlassCard>
  ```
- Import `useTheme` from `@/context/ThemeContext`, `Moon`/`Sun` from `lucide-react`

**`frontend/src/ui/primitives/AppTitleBar.tsx`**
- Remove `themeMode`, `onThemeToggle`, `accountFilterNode` props from `AppTitleBarProps`
- Remove the theme toggle `<Button>` and `{accountFilterNode}` block from JSX
- Remove `Moon`/`Sun` imports

### Acceptance Criteria — Phase 1
- [x] Filter icon renders fixed at `bottom-5 left-4`, visible on all tabs (desktop and mobile)
- [x] Clicking filter icon opens the account filter popover **above** the trigger button
- [x] Dashboard bottom bar shows `[filter] [1M] [2M] [3M] [6M] [1Y] [5Y]`; non-dashboard tabs show filter icon only
- [x] Clicking a time range pill updates dashboard charts correctly (same behavior as before)
- [x] Active time range pill has animated sky→violet background
- [x] Settings tab → Appearance section renders with theme toggle button
- [x] Clicking theme toggle in Settings switches light/dark correctly
- [x] Sun/Moon button is **gone** from the title bar on desktop
- [x] Filter button is **gone** from the title bar on desktop
- [x] No TypeScript errors: removed props are cleaned up at all callsites

### TDD log

- Added failing component tests for the filter trigger mode and popover placement, the new date-range pill slider, the authenticated bottom bar wiring, the settings appearance control, and the title bar theme-toggle removal.
- Implemented the new bottom bar, lifted dashboard date-range state into `AuthenticatedApp`, moved theme toggling into Settings, and removed title-bar filter/theme props.
- Verification: `npm --prefix frontend test -- --runTestsByPath frontend/tests/components/HeaderAccountFilter.test.tsx frontend/tests/ui/primitives/AppTitleBar.test.tsx frontend/tests/features/analytics/components/DateRangePillSlider.test.tsx frontend/tests/components/AuthenticatedApp.test.tsx frontend/tests/views/DashboardPage.test.tsx frontend/tests/views/SettingsPage.test.tsx`, `npm --prefix frontend run typecheck`

---

## Phase 2 — Desktop Pill Nav Slider

**Goal:** Replace the individual tab buttons with a single pill container where a Framer Motion background pill slides between tabs.

### Changes

**`frontend/src/ui/primitives/AppTitleBar.tsx`**
- Add icon imports: `LayoutDashboard, ArrowLeftRight, Target, Building2, Wifi, WifiOff, LogOut`
- Update `TABS` config to include icons:
  ```ts
  const TABS = [
    { key: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
    { key: 'transactions', label: 'Transactions', icon: ArrowLeftRight  },
    { key: 'budgets',      label: 'Budgets',      icon: Target          },
    { key: 'accounts',     label: 'Accounts',     icon: Building2       },
  ];
  ```
- Replace `<nav>` with a unified pill container for desktop:
  - Container: define `appTitleBarRecipes.pillContainer` using `[...surface.mutedChip, ...border.subtle]` spread + `rounded-full p-1` — **no hardcoded hex, no raw Tailwind color utilities**
  - Each tab: define `appTitleBarRecipes.pillTab` = `'relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full'` — layout only, no color
  - Active indicator inside the active tab: `motion.div layoutId="pill-active"` using `buttonRecipes.tabActive` gradient class list (already defined in `Button.tsx`, no duplication), spring `{ stiffness: 400, damping: 35 }`
  - Icon + label both `relative z-10`; label always visible on desktop
  - Inactive tab text: `text.muted` recipe; active tab text: `text.inverse` (inherits from gradient layer)
- Add `appTitleBarRecipes.pillContainer` and `appTitleBarRecipes.pillTab` recipe constants

**`frontend/src/ui/primitives/AppTitleBar.stories.tsx`**
- Update `AuthenticatedDashboard` story's `play` test: tab buttons now have `aria-label={label}` — update query to `getByRole('button', { name: 'Transactions' })` (still works if `aria-label` is set)
- Remove `accountFilterNode` from story args

### Acceptance Criteria — Phase 2
- [ ] Desktop nav renders as a single pill container (not individual disconnected pills)
- [ ] Active pill background slides smoothly with spring animation when switching tabs
- [ ] Tab icons visible left of label text on desktop
- [ ] Inactive tabs have no background, active tab has sky→violet gradient
- [ ] Keyboard navigation and focus rings still work (accessible)
- [ ] Storybook play test passes (`AuthenticatedDashboard`)
- [ ] No regression: tab switching still routes to correct page content

---

## Phase 3 — Mobile Title Bar Layout

**Goal:** Two-row mobile header that fits within 375px viewport with no horizontal overflow.

### Changes

**`frontend/src/ui/primitives/AppTitleBar.tsx`**

Header height/layout:
- Desktop: `h-16` (unchanged)
- Mobile: `h-auto` with padding (`pb-2`) to accommodate second row
- Inner div changes from `flex items-center justify-between h-full` to a flex-col on mobile, flex-row on desktop

Row 1 (always, both desktop and mobile):
```tsx
<div className="flex items-center justify-between h-12">
  {/* Left: logo + desktop nav */}
  <div className="flex items-center gap-6">
    [Logo]
    [Desktop pill nav — hidden on mobile: hidden md:flex]
  </div>
  {/* Right: actions */}
  <div className="flex items-center gap-2">
    {/* Online: full pill desktop, Wifi icon mobile */}
    <span className="hidden md:inline-flex">[OnlinePill]</span>
    <span className="md:hidden">
      {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff ... />}
    </span>
    {/* Settings: icon-only, both */}
    [SettingsButton]
    {/* Logout: text desktop, icon mobile */}
    <span className="hidden md:inline-flex">[LogoutTextButton]</span>
    <span className="md:hidden">[LogoutIconButton aria-label="Logout"]</span>
  </div>
</div>
```

Row 2 (mobile only, authenticated):
```tsx
{state === 'authenticated' && (
  <div className="md:hidden pb-2">
    [Mobile pill nav — same pill container, icon + active-label pattern]
  </div>
)}
```

Mobile pill tab label behavior:
- All tabs: icon always visible
- Active tab label: `overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300`, active = `max-w-[5rem] opacity-100`, inactive = `max-w-0 opacity-0`

Online status icon colors (mobile): use `status.success.icon` and `status.warning.icon` recipes from `@/ui/recipes`

**`frontend/src/ui/primitives/AppTitleBar.stories.tsx`**
- Add `AuthenticatedMobile` story with `parameters: { viewport: { defaultViewport: 'mobile1' } }` and `state: 'authenticated'`, `currentTab: 'dashboard'`

### Acceptance Criteria — Phase 3
- [ ] Mobile (375px): header fits within viewport, zero horizontal overflow
- [ ] Mobile: two rows render — logo+actions row, then tab pill row
- [ ] Mobile: active tab shows icon + label; all inactive tabs show icon only
- [ ] Mobile: active label collapses/expands smoothly when switching tabs
- [ ] Mobile: right actions show only Wifi icon (no text), Settings icon, Logout icon
- [ ] Desktop: single-row layout unchanged from Phase 2
- [ ] `AuthenticatedMobile` Storybook story renders correctly

---

## Phase 4 — Swipe Gestures + Directional Page Transitions

**Goal:** Swiping left/right on the mobile tab row changes tabs; page content slides in the correct direction.

### Changes

**`frontend/src/components/AuthenticatedApp.tsx`**
- Add `direction` state: `const [direction, setDirection] = useState(1)`
- Replace `setTab` with `handleTabChange`:
  ```tsx
  const TAB_ORDER = ['dashboard', 'transactions', 'budgets', 'accounts'] as const;
  const handleTabChange = (next: TabKey) => {
    const from = TAB_ORDER.indexOf(tab as any);
    const to   = TAB_ORDER.indexOf(next as any);
    setDirection(to >= from || from === -1 ? 1 : -1);
    setTab(next);
  };
  ```
- Replace vertical fade with directional horizontal slide:
  ```tsx
  const pageVariants = {
    enter:  (dir: number) => ({ x: `${dir * 60}px`, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir: number) => ({ x: `${dir * -60}px`, opacity: 0 }),
  };
  <motion.section
    key={tab}
    custom={direction}
    variants={pageVariants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
  >
  ```
- Pass `handleTabChange` to `AppLayout`

**`frontend/src/ui/primitives/AppTitleBar.tsx`**
- Wrap mobile Row 2 pill nav in `motion.div` with `onPanEnd`:
  ```tsx
  <motion.div
    onPanEnd={(_, info) => {
      const idx = TABS.findIndex(t => t.key === currentTab);
      if (info.offset.x < -50 && idx < TABS.length - 1) onTabChange?.(TABS[idx + 1].key);
      if (info.offset.x >  50 && idx > 0)               onTabChange?.(TABS[idx - 1].key);
    }}
  >
  ```
  Threshold: 50px. Clamped at first/last tab.

### Acceptance Criteria — Phase 4
- [ ] Swiping left on mobile tab row advances to the next tab (clamped at Accounts)
- [ ] Swiping right on mobile tab row goes to the previous tab (clamped at Dashboard)
- [ ] Page content slides left when advancing (next tab enters from right, current exits left)
- [ ] Page content slides right when going back (prev tab enters from left, current exits right)
- [ ] Tapping a tab (no swipe) still animates in the correct direction based on tab order
- [ ] Swipe on desktop does nothing (gesture only wired to mobile row)
- [ ] No janky layout shift during animation (`overflow: hidden` on `<main>` if needed)

---

## Files Modified

| File | Phase |
|------|-------|
| `frontend/src/components/HeaderAccountFilter.tsx` | 1 |
| `frontend/src/features/analytics/components/DateRangePillSlider.tsx` *(new)* | 1 |
| `frontend/src/layouts/AppLayout.tsx` | 1 |
| `frontend/src/components/AuthenticatedApp.tsx` | 1, 4 |
| `frontend/src/views/DashboardPage.tsx` | 1 |
| `frontend/src/views/SettingsPage.tsx` | 1 |
| `frontend/src/ui/primitives/AppTitleBar.tsx` | 1, 2, 3, 4 |
| `frontend/src/ui/primitives/AppTitleBar.stories.tsx` | 2, 3 |

## Reuse Existing (no duplication)

- `buttonRecipes.tabActive` — active pill gradient (import from `Button.tsx`, do not rewrite)
- `status.success.icon` / `status.warning.icon` — online indicator icon colors
- `surface.mutedChip`, `border.subtle` — pill container shell
- `effect.glassShadow` — bottom bar backdrop shadow
- `text.muted`, `text.inverse`, `font.label` — tab label typography
- `appTitleBarRecipes.settingsIdle` — settings button styling
- Framer Motion v12.23.24 (already installed)
- `DateRangeKey` from `frontend/src/utils/dateRanges.ts`

## Design Token Validation (run after each phase)

```
npm --prefix frontend run design:lint
npm --prefix frontend run typecheck
```
