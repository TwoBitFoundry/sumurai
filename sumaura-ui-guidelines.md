# Sumaura UI Guidelines

## Objective

Define reusable rules for creating consistent glassmorphism-inspired UI
across light and dark modes for Sumaura. Includes color palettes,
structural rules, and interactivity/animation guidelines.

------------------------------------------------------------------------

## 1. Color Palette

### Light Mode

-   **Base surfaces:** `#ffffff`, `#f8fafc`, `#f1f5f9`
-   **Text (primary):** `#0f172a` (slate-900)
-   **Text (secondary):** `#475569` (slate-600)
-   **Borders:** `#0000000d` (light subtle)
-   **Aura ring accents (low saturation):**
    -   Sky Blue: `#93c5fd`
    -   Emerald: `#34d399`
    -   Amber: `#fbbf24`
    -   Violet: `#a78bfa`

### Dark Mode

-   **Base surfaces:** `#0f172a`, `#1e293b`
-   **Text (primary):** `#ffffff`
-   **Text (secondary):** `#cbd5e1` (slate-300)
-   **Borders:** `#ffffff14` (white at \~8%)
-   **Aura ring accents (vivid):**
    -   Sky Blue: `#38bdf8`
    -   Emerald: `#34d399`
    -   Amber: `#fbbf24`
    -   Violet: `#a78bfa`
    -   Red: `#f87171`

### Shared Brand Colors

-   CTA Gradient: Sky Blue `#0ea5e9` → Violet `#a78bfa`
-   Success: `#10b981`
-   Warning: `#fbbf24`
-   Error: `#f87171`

------------------------------------------------------------------------

## 2. Structural Guidelines

### General

-   Only **one true glass layer** at a time (hero container, modal,
    etc.).
-   Subcomponents (cards, tiles, tables) are **solid panels** with
    subtle borders and shadows.

### Hero Sections

-   Glass hero container (rounded, blurred, semi-transparent).
-   Background aura visible behind glass.
-   Headline large/bold, eyebrow text in accent color.
-   If split: left for text/features, right for preview/media.

### Card Modules

-   Solid surfaces only.
-   Rounded corners, subtle borders, faint shadows.
-   Accent color in titles (sky, emerald, amber, violet).

### Multi-Column Layouts

-   Separate with solid cards or one large glass container.
-   Columns stack on mobile, display side-by-side on desktop.

### Tables

-   Solid backgrounds only.
-   Headers in brand accent or slate.
-   Alternating row colors:
    -   Light mode → `#f8fafc` vs `#ffffff`\
    -   Dark mode → `#1e293b` vs `#0f172a`
-   Borders: `#e2e8f0` (light), `#334155` (dark).

### List Views

-   Contained in solid panel.
-   Items separated by dividers (`#e2e8f0` light, `#334155` dark).
-   Leading icons/accents use aura colors.
-   Hover state: subtle background tint using aura accent.

### CTAs & Buttons

-   Pill-shaped, gradient-filled (Sky → Violet).
-   White text, subtle shadow.

### Overlays

-   Toggles, modals → semi-solid with blur (not full hero glass).
-   Backdrop dim:
    -   Dark mode → `#0f172acc`\
    -   Light mode → `#ffffffcc`

------------------------------------------------------------------------

## 3. Backgrounds

### Light Mode

-   Radial gradient base: `#f8fafc` → `#f1f5f9` → `#ffffff`
-   Aura ring (low opacity): sky, emerald, amber, violet
-   Overlay: top linear gradient → `#ffffff99` → `#ffffff66` →
    transparent

### Dark Mode

-   Radial gradient base: `#0f172a` → `#0a0f1b` → `#05070d`
-   Aura ring (medium opacity): sky, emerald, violet, amber, red
-   Overlay: top linear gradient → `#0f172ab3` → `#0f172a66` →
    transparent

------------------------------------------------------------------------

## 4. Interactivity & Animation

### Principles

-   Motion must feel **calm and purposeful**.
-   Easing: `ease-out` or `cubic-bezier(0.4, 0, 0.2, 1)`.
-   Durations:
    -   Micro interactions: 150--250ms\
    -   Large transitions: 300--500ms

### Hover & Focus

-   **Buttons:** slight scale up (1.03x), glow with gradient.
-   **Cards:** lift with shadow + border highlight.
-   **Rows:** subtle aura tint on hover.
-   **Inputs:** border + glow in sky blue.

### Theme Toggle

-   Crossfade backgrounds (400--500ms).
-   Aura ring fades smoothly.
-   Glass opacity transitions gradually.
-   Toggle icon rotates 180° while fading.

### Page/Section Transitions

-   Heroes: fade/slide up with stagger.
-   Cards: staggered fade-up (50ms offset).
-   Charts: fade-in + scale (95% → 100%).

### Micro Interactions

-   CTA press: subtle darken + soft spring back.
-   Success: green flash `#10b981` highlight.
-   Error: quick shake + red `#f87171` pulse.
-   Loading: gradient circular spinner (sky → violet).

### Aura Animations

-   Aura rings rotate very slowly (60--120s per cycle).
-   On hover: increase aura opacity slightly.
-   On active (modal open): aura saturation increases subtly.

------------------------------------------------------------------------

## Rule of Thumb

-   **Background = Aura**\
-   **Glass = Lens**\
-   **Content = Solid & Readable**
