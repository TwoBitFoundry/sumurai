# Sumurai UI Primitives

This directory contains the reusable UI primitives that implement Sumurai's glassmorphism design system with support for light and dark modes.

Start here when editing UI:
- `.agents/skills/sumurai-frontend-design-system/SKILL.md` for the UI policy.
- `.agents/skills/sumurai-frontend-design-system/examples.md` for good and bad composition patterns.
- `.agents/skills/sumurai-design-token-pipeline/references/design-md-standard.md` for `DESIGN.md` format and designmd commands.
- `frontend/src/ui/recipes.ts` for shared class atoms.
- `frontend/src/ui/tokens.ts` for runtime JS values.

## Overview

All primitives use:
- **class-variance-authority (CVA)** for type-safe variant management
- **Tailwind CSS** for styling utilities
- **clsx** for conditional class composition
- Consistent theme mode support via `dark:` variants

## Control Scale

The shared control scale lives in [`frontend/src/ui/recipes.ts`](../recipes.ts) as `control`.

| Size | Height | Glyph | Padding | Label |
|------|--------|-------|---------|-------|
| `sm` | 36px mobile, 32px tablet, 28px desktop | 16px mobile/tablet, 14px desktop | 12px mobile, 10px tablet/desktop | `font.captionStrong` |
| `md` | 44px mobile, 36px tablet, 32px desktop | 20px mobile, 18px tablet, 16px desktop | 16px mobile, 14px tablet, 12px desktop | `font.bodyStrong` |
| `lg` | 52px mobile, 44px tablet, 40px desktop | 24px mobile, 22px tablet, 20px desktop | 20px mobile, 18px tablet, 16px desktop | `font.bodyStrong` |

### Chrome bar (sole exception)

Floating pill chrome (title bar tabs, bottom contextual sliders, account filter icon trigger) uses `chromeBar` in [`frontend/src/ui/recipes.ts`](../recipes.ts): fixed `h-12` shell and `h-6 w-6` glyphs. It does not follow the responsive `control` scale.

Rules:
1. Always pick a control `size` (`sm`, `md`, or `lg`) for buttons, inputs, selects, and icon buttons. Never hand-style heights, glyph sizes, or label typography.
2. Pair label and glyph automatically by setting `size` on the primitive; do not override `text-*` or icon `h-*` classes downstream. Inside `chromeBar` pills only, use `chromeBar.glyph` and `chromeBar.glyphWell`.
3. Default to `md`. Use `sm` only for dense toolbars and tables. Use `lg` for prominent footer fields and hero CTAs.

The `md` control size is anchored to the iOS 44pt minimum touch target, which drives the 44px mobile height.

## Available Primitives

### GradientShell

Full-page background container with animated aura effects. Uses a unified, rich visual design with blue-toned gradients and an animated rotating aura.

**Use Cases:**
- App shell backgrounds
- Authentication page backgrounds
- Onboarding wizard backgrounds
- Landing page hero sections

**Props:**
```typescript
interface GradientShellProps {
  children: React.ReactNode
  className?: string
  centered?: boolean  // If true, centers content vertically and horizontally (default: false)
}
```

**Examples:**

Centered layout (auth pages, onboarding):
```tsx
import { GradientShell } from '@/ui/primitives'

function LoginPage() {
  return (
    <GradientShell centered>
      <LoginForm />
    </GradientShell>
  )
}
```

Full-screen layout (main application):
```tsx
function AppShell() {
  return (
    <GradientShell>
      <AppLayout />
    </GradientShell>
  )
}
```

**Visual Characteristics:**
- Radial gradient base layer with blue-toned colors
- Animated rotating aura (95s cycles, 0.28 opacity)
- Multiple layered overlay gradients for visual depth
- Consistent light and dark mode support via Tailwind `dark:` variants

---

### GlassCard

Container with glassmorphism effect (backdrop blur, semi-transparency, subtle borders).

**Use Cases:**
- Content cards
- Modal containers
- Form containers
- Feature highlights

**Variants:**

| Variant | Description | Background Opacity | Use Case |
|---------|-------------|-------------------|----------|
| `default` | Standard glass effect | 18% light, 55% dark | General content cards |
| `auth` | Enhanced glass for auth | 20% light, 55% dark | Login/register forms |
| `accent` | More opaque, less blur | 85% light, 75% dark | Emphasized content |

**Rounding Options:**

| Rounded | Border Radius | Use Case |
|---------|---------------|----------|
| `default` | 2.25rem | Most cards |
| `lg` | 1rem | Compact cards |
| `xl` | 1.5rem | Large feature cards |

**Padding Options:**

| Padding | Value | Use Case |
|---------|-------|----------|
| `none` | 0 | Custom padding needed |
| `sm` | 1rem | Compact content |
| `md` | 1.5rem | Standard cards |
| `lg` | 2rem | Spacious layouts |

**Props:**
```typescript
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'default' | 'auth' | 'accent'
  rounded?: 'default' | 'lg' | 'xl'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  withInnerEffects?: boolean  // Enable inner ring and gradient (default: true)
  containerClassName?: string // Applied to outer container
  className?: string          // Applied to inner content wrapper
}
```

**Example:**
```tsx
import { GlassCard } from '@/ui/primitives'
import { font as uiTypographyRecipes, text as uiTextRecipes } from '@/ui/recipes'

function ProfileCard() {
  return (
    <GlassCard variant="accent" padding="lg" rounded="xl">
      <h2 className={uiTypographyRecipes.cardTitle + ' ' + uiTextRecipes.primary}>
        User Profile
      </h2>
      <p className={uiTypographyRecipes.body + ' mt-2 ' + uiTextRecipes.body}>
        Profile details here...
      </p>
    </GlassCard>
  )
}
```

**Visual Characteristics:**
- Backdrop blur (2xl saturation)
- Inset ring with subtle shadow
- Gradient overlay from top to bottom
- Border with theme-aware opacity

---

### Modal

Accessible overlay container with backdrop handling.

**Use Cases:**
- Confirmation dialogs
- Session timeout prompts
- Connection status messaging

**Variants:**

| Prop | Options | Description |
|------|---------|-------------|
| `size` | `sm` \| `md` \| `lg` | Sets max width for the dialog content |
| `presentation` | `centered` \| `drawer` | `centered` blurs the backdrop; `drawer` anchors to the bottom without backdrop blur |

**Props:**
```typescript
interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean
  onClose?: () => void
  labelledBy?: string
  description?: string
  presentation?: 'centered' | 'drawer'
  preventCloseOnBackdrop?: boolean
  backdropClassName?: string
  containerClassName?: string
  size?: 'sm' | 'md' | 'lg'
}
```

**Example:**
```tsx
import { Modal, GlassCard, Button } from '@/ui/primitives'
import { font as uiTypographyRecipes, text as uiTextRecipes } from '@/ui/recipes'

function ConfirmDisconnect({ open, onClose, onConfirm }: Props) {
  return (
    <Modal isOpen={open} onClose={onClose} size="md">
      <GlassCard variant="accent" rounded="xl" padding="lg">
        <h2 className={uiTypographyRecipes.cardTitle + ' ' + uiTextRecipes.primary}>
          Disconnect bank?
        </h2>
        <p className={uiTypographyRecipes.body + ' mt-2 ' + uiTextRecipes.body}>
          This will remove all related accounts.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Disconnect</Button>
        </div>
      </GlassCard>
    </Modal>
  )
}
```

**Visual Characteristics:**
- Backdrop blur with semi-transparent slate overlay
- Scale and fade transitions for dialog content
- Focusable backdrop button for accessibility

---

### Button

Interactive button with multiple visual styles.

**Use Cases:**
- Form submissions
- Navigation actions
- Icon-only actions
- Tabbed navigation

**Variants:**

| Variant | Visual Style | Use Case |
|---------|--------------|----------|
| `primary` | Sky-violet gradient with shadow | Primary CTAs, submit buttons |
| `secondary` | White/slate with border | Secondary actions, cancel buttons |
| `ghost` | Subtle glassmorphism | Tertiary actions, less emphasis |
| `tab` | Tab navigation inactive state | Tab bars |
| `tabActive` | Tab navigation active state | Selected tab |
| `danger` | Red tones for destructive actions | Delete, disconnect actions |
| `success` | Emerald-sky gradient | Success confirmations |
| `connect` | Branded gradient for connections | Bank connection CTAs |

**Sizes:**

| Size | Height | Glyph | Padding | Label | Use Case |
|------|--------|-------|---------|-------|----------|
| `sm` | 36px mobile, 32px tablet, 28px desktop | 16px mobile, 16px tablet, 14px desktop | 12px mobile, 10px tablet/desktop | captionStrong | Dense controls |
| `md` | 44px mobile, 36px tablet, 32px desktop | 20px mobile, 18px tablet, 16px desktop | 16px mobile, 14px tablet, 12px desktop | bodyStrong | Standard buttons |
| `lg` | 52px mobile, 44px tablet, 40px desktop | 24px mobile, 22px tablet, 20px desktop | 20px mobile, 18px tablet, 16px desktop | bodyStrong | Prominent CTAs |

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'tab' | 'tabActive' | 'danger' | 'success' | 'connect'
  size?: 'sm' | 'md' | 'lg' | 'titleBarExpanded'
  shape?: 'default' | 'square'
  loading?: boolean  // Shows loading state (disables interaction)
  children?: React.ReactNode
}
```

**Example:**
```tsx
import { Button } from '@/ui/primitives'

function SubmitForm() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="flex gap-2">
      <Button variant="primary" size="lg" loading={loading}>
        Submit
      </Button>
      <Button variant="secondary" size="lg">
        Cancel
      </Button>
    </div>
  )
}
```

**Visual Characteristics:**
- Gradient backgrounds on primary/success/connect variants
- Hover lift effect (-translate-y)
- Active scale effect (0.98)
- Focus ring with sky-400 color
- Disabled state with reduced opacity

---

### Input

Form input field with focus states and validation variants.

**Use Cases:**
- Text inputs
- Email/password fields
- Search inputs
- Number inputs

**Variants:**

| Variant | Border Color | Focus Ring | Use Case |
|---------|--------------|------------|----------|
| `default` | Black/white subtle | Sky-400 | Standard inputs |
| `invalid` | Red-300/600 | Red-400 | Validation errors |
| `glass` | White/transparent | Sky-400 | Overlay forms |

**Sizes:**

| Size | Padding | Text Size | Border Radius |
|------|---------|-----------|---------------|
| `sm` | 1.5 | xs | lg |
| `md` | 2.5 | sm | xl |
| `lg` | 3 | base | xl |

**Props:**
```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: 'default' | 'invalid' | 'glass'
  inputSize?: 'sm' | 'md' | 'lg'
}
```

**Example:**
```tsx
import { Input } from '@/ui/primitives'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false)

  return (
    <div>
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        variant={error ? 'invalid' : 'default'}
        inputSize="lg"
      />
    </div>
  )
}
```

**Visual Characteristics:**
- Full width by default
- Focus ring with offset
- Disabled state with cursor-not-allowed
- Theme-aware backgrounds and text colors

---

### Select

Form select field that shares the same visual control system as `Input` but keeps native select semantics explicit.

**Use Cases:**
- Category selection
- Filter controls
- Dropdowns that should match the shared form-control shell

**Variants:**

| Variant | Border Color | Focus Ring | Use Case |
|---------|--------------|------------|----------|
| `default` | Black/white subtle | Sky-400 | Standard dropdowns |
| `invalid` | Red-300/600 | Red-400 | Validation errors |
| `glass` | White/transparent | Sky-400 | Overlay forms |

**Sizes:**

| Size | Padding | Text Size | Border Radius |
|------|---------|-----------|---------------|
| `sm` | 1.5 | xs | lg |
| `md` | 2.5 | sm | xl |
| `lg` | 3 | base | xl |

**Props:**
```typescript
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  variant?: 'default' | 'invalid' | 'glass'
  selectSize?: 'sm' | 'md' | 'lg'
}
```

**Example:**
```tsx
import { Select } from '@/ui/primitives'

function CategorySelect() {
  return (
    <Select variant="glass" selectSize="md" value={category} onChange={handleChange}>
      <option value="groceries">Groceries</option>
    </Select>
  )
}
```

**Visual Characteristics:**
- Shares the same control shell as `Input`
- Preserves native select semantics
- Stays aligned with the shared token system

---

### Badge

Small status indicator with semantic colors.

**Use Cases:**
- Status pills
- Feature tags
- Category labels
- Version indicators

**Variants:**

| Variant | Colors | Use Case |
|---------|--------|----------|
| `default` | White/slate | Neutral badges |
| `primary` | Sky blue background | Primary status |
| `feature` | Minimal ring | Feature highlights |

**Sizes:**

| Size | Padding | Text Size | Letter Spacing | Border Radius |
|------|---------|-----------|----------------|---------------|
| `xs` | 2/0.5 | 10px | 0.2em | md |
| `sm` | 2.5/1 | 11px | 0.24em | lg |
| `md` | 3/1 | xs | 0.24em | full |
| `lg` | 3.5/1.5 | xs | 0.3em | full |

**Props:**
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'feature'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  children: React.ReactNode
}
```

**Example:**
```tsx
import { Badge } from '@/ui/primitives'

function StatusIndicator({ status }: { status: string }) {
  return (
    <Badge variant="primary" size="sm">
      {status}
    </Badge>
  )
}
```

**Visual Characteristics:**
- Uppercase text with increased letter spacing
- Subtle shadows for depth
- Smooth transitions on state changes

---

### MenuDropdown + MenuItem

Dropdown menu with animated open/close transitions.

**Use Cases:**
- User account menus
- Action menus
- Settings dropdowns
- Context menus

**Props:**

```typescript
interface MenuDropdownProps {
  trigger: React.ReactNode       // Element that opens menu when clicked
  children: React.ReactNode      // Menu items (usually MenuItem components)
  className?: string             // Applied to container
  contentClassName?: string      // Applied to dropdown content
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  children: React.ReactNode
}
```

**Example:**
```tsx
import { MenuDropdown, MenuItem } from '@/ui/primitives'
import { UserIcon, SettingsIcon, LogoutIcon } from 'lucide-react'

function UserMenu() {
  return (
    <MenuDropdown
      trigger={
        <button className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
        </button>
      }
    >
      <MenuItem icon={<UserIcon className="h-4 w-4" />}>
        Profile
      </MenuItem>
      <MenuItem icon={<SettingsIcon className="h-4 w-4" />}>
        Settings
      </MenuItem>
      <MenuItem icon={<LogoutIcon className="h-4 w-4" />}>
        Logout
      </MenuItem>
    </MenuDropdown>
  )
}
```

**Visual Characteristics:**
- Animated fade-in/out with y-axis motion
- Glassmorphism backdrop
- Right-aligned dropdown
- Items have hover states
- Auto-closes on item click

---

## Shared Utilities

Located in `utils.ts`:

### `cn(...inputs: ClassValue[])`

Utility for merging Tailwind classes with conditional logic.

```tsx
import { cn } from './utils'

<div className={cn(
  'base-class',
  isActive && 'active-class',
  className
)} />
```

### Shared Class Constants

Reusable class strings for consistency:

| Constant | Classes | Use Case |
|----------|---------|----------|
| `focusRingClasses` | `focus-visible:outline-none focus-visible:ring-2 ...` | Focus states |
| `disabledClasses` | `disabled:cursor-not-allowed disabled:opacity-60` | Disabled states |
| `transitionClasses` | `transition-all duration-200 ease-out` | Smooth transitions |
| `glassBackdropClasses` | `backdrop-blur-2xl backdrop-saturate-[150%]` | Glass effects |

**Example:**
```tsx
import { focusRingClasses, cn } from './utils'

<button className={cn('base-button', focusRingClasses)}>
  Click Me
</button>
```

---

## Extending Primitives

### Adding New Variants

1. Update the CVA configuration:
```tsx
const buttonVariants = cva(
  [...baseClasses],
  {
    variants: {
      variant: {
        primary: [...],
        newVariant: [
          'bg-custom-color',
          'text-white',
          'hover:bg-custom-color-dark'
        ],
      },
    },
  }
)
```

2. Update TypeScript types (automatically inferred from CVA)
3. Document the new variant in this README
4. Create snapshot tests for the new variant

### Composing Multiple Primitives

```tsx
import { GlassCard, Button, Badge } from '@/ui/primitives'

function ComplexCard() {
  return (
    <GlassCard variant="accent" padding="lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Title</h3>
          <Badge variant="primary" size="sm">NEW</Badge>
        </div>
        <Button variant="secondary" size="sm">
          View
        </Button>
      </div>
    </GlassCard>
  )
}
```

---

## Best Practices

1. **Use primitives for visual styling, inline classes for layout**
   ```tsx
   // ✅ Good
   <Button variant="primary" className="w-full mt-4" />

   // ❌ Bad
   <button className="bg-gradient-to-r from-sky-500 to-violet-500 text-white px-4 py-2 rounded-full" />
   ```

2. **Don't override primitive styles via className**
   ```tsx
   // ✅ Good - Use variant or create new variant
   <Button variant="danger" />

   // ❌ Bad - Overriding primitive styles
   <Button variant="primary" className="bg-red-500" />
   ```

3. **Prefer composition over customization**
   ```tsx
   // ✅ Good
   <GlassCard>
     <div className="flex gap-4">
       <Button variant="primary" />
       <Button variant="secondary" />
     </div>
   </GlassCard>

   // ❌ Bad
   <CustomCardWithButtons variant="weird-combo" />
   ```

4. **Use TypeScript for type safety**
   ```tsx
   // ✅ Good - TypeScript will catch invalid variants
   <Button variant="primary" size="lg" />

   // ❌ Bad - Runtime error
   <Button variant="invalid" size="huge" />
   ```

---

### Alert

Inline feedback banner for success, warning, info, or error states.

**Use Cases:**
- Authentication error messaging
- Form level feedback
- Inline status updates

**Variants:**

| Variant | Description |
|---------|-------------|
| `info` | Neutral informational banner |
| `success` | Positive feedback |
| `warning` | Cautionary notice |
| `error` | Blocking error state |

**Props:**
```typescript
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error'
  tone?: 'solid' | 'subtle'
  title?: string
  icon?: React.ReactNode
  children: React.ReactNode
}
```

**Example:**
```tsx
import { Alert } from '@/ui/primitives'

function ErrorBanner({ message }: { message: string }) {
  return (
    <Alert variant="error" title="Authentication error">
      {message}
    </Alert>
  )
}
```

---

### FormLabel

Consistent typography and spacing for form labels.

**Use Cases:**
- Login and registration forms
- Settings panels
- Input group headings

**Variants:**

| Variant | Description |
|---------|-------------|
| `default` | High contrast label |
| `subtle` | Lower contrast secondary label |

**Example:**
```tsx
import { FormLabel, Input } from '@/ui/primitives'

function EmailField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <FormLabel htmlFor="email">Email</FormLabel>
      <Input id="email" type="email" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
```

---

### RequirementPill

Status pill to indicate whether a checklist item has been satisfied.

**Use Cases:**
- Password strength checklists
- Onboarding requirement trackers
- Multi-step validation summaries

**Variants:**

| Variant | Description |
|---------|-------------|
| `pending` | Neutral background for unmet requirement |
| `met` | Highlighted background for satisfied requirement |

**Example:**
```tsx
import { RequirementPill } from '@/ui/primitives'

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <RequirementPill status={met ? 'met' : 'pending'}>
      {label}
    </RequirementPill>
  )
}
```

---

## Testing

All primitives should have:
- Snapshot tests for each variant
- Light and dark mode rendering tests
- Accessibility tests (ARIA attributes, keyboard navigation)

See `__tests__/` directory for examples.

---

## Related Documentation

- [DESIGN.md](../../../../DESIGN.md) - Design system fundamentals
- [DESIGN.md standard](../../../../.agents/skills/sumurai-design-token-pipeline/references/design-md-standard.md) - upstream format, section order, and designmd CLI
- [UI skill](../../../../.agents/skills/sumurai-frontend-design-system/SKILL.md) - the authoritative UI policy and examples
- [AGENTS.md](../../../../AGENTS.md) - repository-wide guidance

---

## Questions?

If you need a variant that doesn't exist:
1. Check if you can compose existing primitives
2. Consider if it's truly reusable (3+ uses)
3. Create a new variant following CVA patterns
4. Update this README with the new variant
5. Add snapshot tests
