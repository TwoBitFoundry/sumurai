---
version: alpha
name: Sumurai
description: Dark-first glass financial UI with cyan-violet brand accents and semantic finance colors.
colors:
  primary: "#0369a1"
  on-primary: "#ffffff"
  brand-sky: "#0ea5e9"
  brand-sky-dark: "#38bdf8"
  brand-emerald: "#10b981"
  brand-emerald-dark: "#34d399"
  brand-amber: "#f59e0b"
  brand-amber-dark: "#fbbf24"
  brand-rose: "#ef4444"
  brand-rose-dark: "#f87171"
  brand-violet: "#8b5cf6"
  brand-violet-dark: "#a78bfa"
  brand-cyan: "#06b6d4"
  brand-cyan-dark: "#22d3ee"
  chart-light-1: "#0ea5e9"
  chart-light-2: "#10b981"
  chart-light-3: "#f59e0b"
  chart-light-4: "#ef4444"
  chart-light-5: "#8b5cf6"
  chart-light-6: "#059669"
  chart-light-grid: "#e2e8f0"
  chart-light-axis: "#64748b"
  chart-light-tooltip-bg: "#ffffff"
  chart-light-tooltip-border: "#e2e8f0"
  chart-light-tooltip-text: "#0f172a"
  chart-light-dot-fill: "#ffffff"
  chart-dark-1: "#38bdf8"
  chart-dark-2: "#34d399"
  chart-dark-3: "#fbbf24"
  chart-dark-4: "#f87171"
  chart-dark-5: "#a78bfa"
  chart-dark-6: "#10b981"
  chart-dark-grid: "#334155"
  chart-dark-axis: "#94a3b8"
  chart-dark-tooltip-bg: "#1e293b"
  chart-dark-tooltip-border: "#475569"
  chart-dark-tooltip-text: "#f8fafc"
  chart-dark-dot-fill: "#0b1220"
  semantic-light-cash: "#10b981"
  semantic-light-investments: "#06b6d4"
  semantic-light-credit: "#fb7185"
  semantic-light-loan: "#f59e0b"
  semantic-light-net-worth: "#8b5cf6"
  semantic-dark-cash: "#34d399"
  semantic-dark-investments: "#22d3ee"
  semantic-dark-credit: "#fb7185"
  semantic-dark-loan: "#fbbf24"
  semantic-dark-net-worth: "#a78bfa"
  category-sky: "#38bdf8"
  category-emerald: "#34d399"
  category-cyan: "#22d3ee"
  category-violet: "#a78bfa"
  category-amber: "#fbbf24"
  category-rose: "#fb7185"
  category-indigo: "#818cf8"
  category-fuchsia: "#e879f9"
  category-teal: "#2dd4bf"
  category-lime: "#a3e635"
typography:
  brand:
    fontFamily: "'Cal Sans', system-ui, sans-serif"
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0
  sans:
    fontFamily: "'Mr Eaves XL Mod', system-ui, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  subheading:
    fontFamily: "'Mr Eaves XL Mod', system-ui, sans-serif"
    fontSize: 0.95rem
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0
  label:
    fontFamily: "'Mr Eaves XL Mod', system-ui, sans-serif"
    fontSize: 0.65rem
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.24em
  pill:
    fontFamily: "'Mr Eaves XL Mod', system-ui, sans-serif"
    fontSize: 0.6rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.18em
  badge:
    fontFamily: "'Mr Eaves XL Mod', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.32em
  budget-progress-caption:
    fontFamily: "'Mr Eaves XL Mod', system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  budget-progress-caption-strong:
    fontFamily: "'Mr Eaves XL Mod', system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
rounded:
  panel: 2.25rem
  card: 1rem
  large: 1.5rem
  pill: 9999px
  medium: 0.75rem
  small: 0.5rem
spacing:
  page-x: 16px
  page-y: 16px
  shell-x: 16px
  shell-y: 48px
  compact-gap: 8px
  section-gap: 20px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: 12px
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "#475569"
    rounded: "{rounded.medium}"
    padding: 10px
  button-icon:
    backgroundColor: "#ffffff"
    textColor: "#475569"
    rounded: "{rounded.medium}"
    padding: 10px
  glass-card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.large}"
    padding: 24px
  page-shell:
    backgroundColor: "#ffffff"
    rounded: "{rounded.panel}"
    padding: 32px
  pill:
    backgroundColor: "#e2e8f0"
    textColor: "#0f172a"
    rounded: "{rounded.pill}"
    padding: 8px
  hero-stat-card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.card}"
    padding: 16px
  budget-progress-track:
    backgroundColor: "{colors.chart-light-grid}"
    rounded: "{rounded.pill}"
    height: "10px"
  budget-progress-track-dark:
    backgroundColor: "{colors.chart-dark-grid}"
    rounded: "{rounded.pill}"
    height: "10px"
  budget-progress-fill-within:
    backgroundColor: "linear-gradient(90deg, {colors.brand-sky-dark}, {colors.brand-cyan-dark}, {colors.brand-violet})"
    rounded: "{rounded.pill}"
    height: "10px"
  budget-progress-fill-over:
    backgroundColor: "linear-gradient(90deg, {colors.category-rose}, #f43f5e, #e11d48)"
    rounded: "{rounded.pill}"
    height: "10px"
  budget-progress-caption-row:
    typography: "{typography.budget-progress-caption}"
    textColor: "{colors.chart-light-axis}"
  budget-progress-caption-summary:
    typography: "{typography.budget-progress-caption-strong}"
    textColor: "{colors.chart-light-axis}"
  budget-progress-caption-danger:
    typography: "{typography.budget-progress-caption-strong}"
    textColor: "#dc2626"
  surface-panel-glass-dark:
    backgroundColor: "#0f172a"
    rounded: "{rounded.large}"
  surface-layered-panel-dark:
    backgroundColor: "#111a2f"
    rounded: "{rounded.large}"
  surface-data-row-dark:
    backgroundColor: "#1e293b"
    rounded: "{rounded.medium}"
  surface-secondary-text:
    typography: "{typography.budget-progress-caption}"
    textColor: "{colors.chart-light-axis}"
  surface-secondary-text-dark:
    typography: "{typography.budget-progress-caption}"
    textColor: "#cbd5e1"
  budget-card-shell:
    backgroundColor: "#ffffff"
    rounded: "{rounded.large}"
    padding: 24px
  budget-card-shell-dark:
    backgroundColor: "#111a2f"
    rounded: "{rounded.large}"
    padding: 24px
  pagination-round-button:
    backgroundColor: "#ffffff"
    textColor: "{colors.chart-light-axis}"
    rounded: "{rounded.pill}"
    size: 36px
  pagination-round-button-dark:
    backgroundColor: "#1e293b"
    textColor: "#cbd5e1"
    rounded: "{rounded.pill}"
    size: 36px
  accounts-toolbar-button:
    backgroundColor: "#ffffff"
    textColor: "#0f172a"
    rounded: "{rounded.pill}"
    padding: 10px
  accounts-toolbar-button-dark:
    backgroundColor: "#1e293b"
    textColor: "#cbd5e1"
    rounded: "{rounded.pill}"
    padding: 10px
  provider-connect-plaid-eyebrow:
    backgroundColor: "rgba(52, 211, 153, 0.2)"
    textColor: "{colors.semantic-light-cash}"
  provider-connect-teller-eyebrow:
    backgroundColor: "rgba(56, 189, 248, 0.2)"
    textColor: "{colors.brand-sky}"
  onboarding-step-card:
    backgroundColor: "#ffffff"
    textColor: "#0f172a"
    rounded: "{rounded.medium}"
    padding: 16px
  onboarding-step-card-dark:
    backgroundColor: "#0f172a"
    textColor: "#ffffff"
    rounded: "{rounded.medium}"
    padding: 16px
  onboarding-provider-row:
    backgroundColor: "#ffffff"
    rounded: "{rounded.large}"
    padding: 16px
  onboarding-provider-row-dark:
    backgroundColor: "#0f172a"
    rounded: "{rounded.large}"
    padding: 16px
  onboarding-preview-frame:
    backgroundColor: "#0f172a"
    rounded: "{rounded.large}"
  onboarding-body-muted:
    typography: "{typography.budget-progress-caption}"
    textColor: "{colors.chart-light-axis}"
  onboarding-body-muted-dark:
    typography: "{typography.budget-progress-caption}"
    textColor: "#cbd5e1"
  brand-accent-sky:
    backgroundColor: "{colors.brand-sky}"
    textColor: "{colors.chart-light-tooltip-text}"
  brand-accent-sky-dark:
    backgroundColor: "{colors.brand-sky-dark}"
    textColor: "{colors.chart-dark-dot-fill}"
  brand-accent-emerald:
    backgroundColor: "{colors.brand-emerald}"
    textColor: "{colors.chart-light-tooltip-text}"
  brand-accent-emerald-dark:
    backgroundColor: "{colors.brand-emerald-dark}"
    textColor: "{colors.chart-dark-dot-fill}"
  brand-accent-amber:
    backgroundColor: "{colors.brand-amber}"
    textColor: "{colors.chart-light-tooltip-text}"
  brand-accent-amber-dark:
    backgroundColor: "{colors.brand-amber-dark}"
    textColor: "{colors.chart-dark-dot-fill}"
  brand-accent-rose:
    backgroundColor: "{colors.brand-rose}"
    textColor: "{colors.chart-light-tooltip-text}"
  brand-accent-rose-dark:
    backgroundColor: "{colors.brand-rose-dark}"
    textColor: "{colors.chart-dark-dot-fill}"
  brand-accent-violet:
    backgroundColor: "{colors.brand-violet}"
  brand-accent-violet-dark:
    backgroundColor: "{colors.brand-violet-dark}"
    textColor: "{colors.chart-dark-dot-fill}"
  brand-accent-cyan:
    backgroundColor: "{colors.brand-cyan}"
    textColor: "{colors.chart-light-tooltip-text}"
  brand-accent-cyan-dark:
    backgroundColor: "{colors.brand-cyan-dark}"
    textColor: "{colors.chart-dark-dot-fill}"
  chart-series-light-1:
    backgroundColor: "{colors.chart-light-1}"
  chart-series-light-2:
    backgroundColor: "{colors.chart-light-2}"
  chart-series-light-3:
    backgroundColor: "{colors.chart-light-3}"
  chart-series-light-4:
    backgroundColor: "{colors.chart-light-4}"
  chart-series-light-5:
    backgroundColor: "{colors.chart-light-5}"
  chart-series-light-6:
    backgroundColor: "{colors.chart-light-6}"
  chart-series-dark-1:
    backgroundColor: "{colors.chart-dark-1}"
  chart-series-dark-2:
    backgroundColor: "{colors.chart-dark-2}"
  chart-series-dark-3:
    backgroundColor: "{colors.chart-dark-3}"
  chart-series-dark-4:
    backgroundColor: "{colors.chart-dark-4}"
  chart-series-dark-5:
    backgroundColor: "{colors.chart-dark-5}"
  chart-series-dark-6:
    backgroundColor: "{colors.chart-dark-6}"
  chart-tooltip-light:
    backgroundColor: "{colors.chart-light-tooltip-bg}"
    textColor: "{colors.chart-light-tooltip-text}"
  chart-tooltip-dark:
    backgroundColor: "{colors.chart-dark-tooltip-bg}"
    textColor: "{colors.chart-dark-tooltip-text}"
  chart-tooltip-border-light:
    backgroundColor: "{colors.chart-light-tooltip-border}"
  chart-tooltip-border-dark:
    backgroundColor: "{colors.chart-dark-tooltip-border}"
  chart-axis-dark:
    textColor: "{colors.chart-dark-axis}"
  chart-dot-light:
    backgroundColor: "{colors.chart-light-dot-fill}"
  chart-dot-dark:
    backgroundColor: "{colors.chart-dark-dot-fill}"
  finance-cash-light:
    textColor: "{colors.semantic-light-cash}"
  finance-investments-light:
    textColor: "{colors.semantic-light-investments}"
  finance-credit-light:
    textColor: "{colors.semantic-light-credit}"
  finance-loan-light:
    textColor: "{colors.semantic-light-loan}"
  finance-net-worth-light:
    textColor: "{colors.semantic-light-net-worth}"
  finance-cash-dark:
    textColor: "{colors.semantic-dark-cash}"
  finance-investments-dark:
    textColor: "{colors.semantic-dark-investments}"
  finance-credit-dark:
    textColor: "{colors.semantic-dark-credit}"
  finance-loan-dark:
    textColor: "{colors.semantic-dark-loan}"
  finance-net-worth-dark:
    textColor: "{colors.semantic-dark-net-worth}"
  category-pill-sky:
    backgroundColor: "{colors.category-sky}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-emerald:
    backgroundColor: "{colors.category-emerald}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-cyan:
    backgroundColor: "{colors.category-cyan}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-violet:
    backgroundColor: "{colors.category-violet}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-amber:
    backgroundColor: "{colors.category-amber}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-rose:
    backgroundColor: "{colors.category-rose}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-indigo:
    backgroundColor: "{colors.category-indigo}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-fuchsia:
    backgroundColor: "{colors.category-fuchsia}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-teal:
    backgroundColor: "{colors.category-teal}"
    textColor: "{colors.chart-dark-dot-fill}"
  category-pill-lime:
    backgroundColor: "{colors.category-lime}"
    textColor: "{colors.chart-dark-dot-fill}"
---

## Overview

Sumurai should read as a restrained financial workspace: dark by default, bright enough for legibility, and layered with glass depth instead of heavy borders. The visual identity comes from a cyan-violet brand gradient, cool neutral surfaces, and semantic finance colors that separate cash, investments, credit, loan, and net worth without introducing extra hues.

The internal token names are the source of truth. SwiftUI should map the same semantics into asset catalog colors, text styles, corner radii, spacing constants, and shared component styles instead of reinterpreting the system.

## Colors

Use `colors.brand` for accent and navigation chrome. Use `colors.theme.light` and `colors.theme.dark` for charts, tooltips, axis text, and semantic finance values. Use `colors.categoryAccents` only for stable category labeling, dots, and rings.

The app shell should keep its ambient blue aura and violet overlay, but surfaces must stay neutral. Semantic colors should stay reserved for meaning, not decoration.

## Typography

Use `typography.brand` for the product mark and `typography.sans` or `typography.subheading` for the interface. Labels, pills, and badges should stay compact, uppercase, and tightly tracked so controls scan cleanly in dense dashboards.

SwiftUI should treat these as a small font family set with distinct roles rather than many one-off text styles.

## Layout

Use `spacing.pageX`, `spacing.pageY`, `spacing.shellX`, and `spacing.shellY` to keep page framing consistent. Prefer compact gaps for controls and moderate section gaps for dashboard blocks. Layout should stay wide, calm, and easy to scan.

Main surfaces should float inside a glass shell, with enough inset to separate content from the app edge and enough breathing room to keep the interface from feeling crowded.

## Elevation & Depth

Depth comes from blur, inset highlights, soft shadows, and faint gradients. Use the glass and panel shadows for cards and shells, and keep the strongest depth for auth and hero surfaces.

Do not flatten the UI into pure borders. The depth system should imply hierarchy without creating noisy contrast.

## Shapes

Use `rounded-[2.25rem]` only for large shells and page containers. Use `rounded-3xl`, `rounded-2xl`, and `rounded-xl` for cards and inputs. Use `rounded-full` for pills and chips.

The shape language should stay smooth and modern, with compact controls retaining clarity in dense layouts.

## Components

Buttons should carry the brand gradient in primary and connect actions, with restrained variants for secondary and icon-only actions. Cards should favor translucent glass surfaces. Charts should use the light and dark theme color sets without drifting from the semantic finance palette.

Budget progress bars use `designTokens.components.budgetProgress`: a neutral inset track, a sky-to-cyan-to-violet fill while within budget, and a rose gradient fill when over budget, with caption rows using compact slate axis colors and danger tones for overspend summaries. In `DESIGN.md`, `budget-progress-track` / `budget-progress-track-dark`, `budget-progress-fill-within`, `budget-progress-fill-over`, and the `budget-progress-caption-*` entries mirror those roles with design.md component property tokens; implementation keeps full Tailwind class lists in the token module.

Dense feature screens share `designTokens.surfaces` for dark glass panels (`#0f172a`, `#111a2f`), control rows (`#1e293b`), focus ring offsets, and muted caption typography. Budget workflow cards use `designTokens.components.budgetCard.shell`; accounts month/toolbar pills use `accountsToolbarButton`; transaction pagination uses `paginationRoundButton`; provider picker eyebrows use `providerConnect`; onboarding steps use `components.onboarding` (`stepCard`, `providerRow`, `previewFrame`, typography bundles). YAML entries `surface-*`, `budget-card-shell*`, `pagination-round-button*`, `accounts-toolbar-button*`, `provider-connect-*-eyebrow`, and `onboarding-*` summarize those roles for export while Tailwind class arrays remain authoritative in the token module.

SwiftUI should map component tokens to reusable view modifiers or style helpers, especially for buttons, cards, chips, title-bar tabs, linear budget-fill overlays, dark dashboard shells, and onboarding marketing cards. Keep the same visual roles across platforms instead of duplicating implementation details.

## Do's and Don'ts

Do keep the palette small and intentional.
Do keep semantic finance colors consistent.
Do preserve compact uppercase labels.
Do map the token system directly into SwiftUI.

Don't introduce new brand colors outside the token set.
Don't use semantic colors for decoration.
Don't add noisy shadows or extra surface hues.
Don't remix the cleaned token names into ad hoc component-specific values.
