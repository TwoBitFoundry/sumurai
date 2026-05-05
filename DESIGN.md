---
version: alpha
name: Sumurai
description: Dark-first glass financial UI with cyan-violet brand accents and semantic finance colors.
colors:
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
    backgroundColor: "{colors.brand-sky}"
    textColor: "#ffffff"
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

SwiftUI should map component tokens to reusable view modifiers or style helpers, especially for buttons, cards, chips, and title-bar tabs. Keep the same visual roles across platforms instead of duplicating implementation details.

## Do's and Don'ts

Do keep the palette small and intentional.
Do keep semantic finance colors consistent.
Do preserve compact uppercase labels.
Do map the token system directly into SwiftUI.

Don't introduce new brand colors outside the token set.
Don't use semantic colors for decoration.
Don't add noisy shadows or extra surface hues.
Don't remix the cleaned token names into ad hoc component-specific values.
