# Sumurai Frontend Styling Guide

This guide establishes the styling architecture for Sumurai's frontend, ensuring consistent glassmorphism design across light and dark modes while maintaining code quality and maintainability.

## Table of Contents

- [Philosophy](#philosophy)
- [Decision Tree](#decision-tree)
- [Primitive Usage](#primitive-usage)
- [When to Create New Primitives](#when-to-create-new-primitives)
- [Inline Styling Guidelines](#inline-styling-guidelines)
- [Theme Mode Considerations](#theme-mode-considerations)
- [Common Patterns](#common-patterns)

---

## Philosophy

**Primitive-First Architecture**

Sumurai follows a primitive-first styling approach:

1. **Primitives are the foundation** - Pre-built components with CVA variants handle 90% of styling needs
2. **Inline classes for layout** - Use Tailwind utilities for positioning, spacing, and layout-specific adjustments
3. **No long className strings** - If you need >5 utility classes, you should be using or creating a primitive
4. **Consistency over customization** - Reuse existing variants before creating new ones

**Design System Alignment**

All primitives align with [docs/sumurai-ui-guidelines.md](../../docs/sumurai-ui-guidelines.md):
- Glassmorphism with backdrop blur
- Consistent color palette (light/dark modes)
- Purposeful animations and interactions
- Accessibility-first approach

---

## Decision Tree

Use this tree when implementing a new UI element:

```
Does a primitive already exist for this element?
│
├─ YES → Use the primitive
│   │
│   └─ Does it have the variant I need?
│       │
│       ├─ YES → Use that variant
│       │   └─ Add layout/spacing utilities via className prop if needed
│       │
│       └─ NO → Can I compose existing variants?
│           │
│           ├─ YES → Compose them
│           │
│           └─ NO → Add new variant to primitive
│               └─ Update primitive documentation
│
└─ NO → Is this a one-off element or reusable component?
    │
    ├─ ONE-OFF → Use inline Tailwind (max 5 utilities)
    │   └─ If >5 utilities needed, reconsider if it's truly one-off
    │
    └─ REUSABLE → Create new primitive
        └─ Follow primitive creation guidelines below
```

---

## Primitive Usage

### Available Primitives

Located in `src/ui/primitives/`:

| Primitive | Purpose | Key Variants |
|-----------|---------|--------------|
| `GradientShell` | Full-page backgrounds with aura effects | `app`, `auth`, `landing` |
| `GlassCard` | Container with glassmorphism effect | `default`, `auth`, `accent` |
| `Button` | Interactive buttons | `primary`, `secondary`, `ghost`, `icon`, `danger`, `success`, `connect` |
| `Input` | Form inputs | `default`, `error`, `success` |
| `Badge` | Status indicators | `default`, `success`, `warning`, `error`, `info` |
| `MenuDropdown` | Dropdown menus | `default` |

See [src/ui/primitives/README.md](../src/ui/primitives/README.md) for detailed variant documentation.

### Basic Usage

```tsx
import { Button, GlassCard } from '@/ui/primitives'

function MyComponent() {
  return (
    <GlassCard variant="default" padding="lg">
      <h2>My Content</h2>
      <Button variant="primary" size="lg">
        Click Me
      </Button>
    </GlassCard>
  )
}
```

### Extending with className

Primitives accept a `className` prop for layout-specific adjustments:

```tsx
<Button
  variant="primary"
  size="md"
  className="mt-4 w-full"
>
  Submit
</Button>
```

**Guidelines for className prop:**
- **DO:** Add spacing (`mt-4`, `mb-6`), sizing (`w-full`, `h-12`), positioning (`absolute`, `top-0`)
- **DO:** Add layout utilities (`flex`, `grid`, `items-center`)
- **DON'T:** Override colors, borders, shadows (use variants instead)
- **DON'T:** Add >5 utilities (create a new variant instead)

### Composing Primitives

Build complex UIs by composing primitives:

```tsx
function UserCard({ user }: { user: User }) {
  return (
    <GlassCard variant="accent" padding="md" className="flex items-center gap-4">
      <img src={user.avatar} className="h-12 w-12 rounded-full" />
      <div className="flex-1">
        <h3 className="font-semibold">{user.name}</h3>
        <Badge variant={user.status === 'active' ? 'success' : 'error'}>
          {user.status}
        </Badge>
      </div>
      <Button variant="secondary" size="sm">
        View Profile
      </Button>
    </GlassCard>
  )
}
```

---

## When to Create New Primitives

Create a new primitive when:

1. **High Reusability** - Component will be used in 3+ places
2. **Complex Variants** - Element needs multiple style variations (e.g., success/error states)
3. **Design System Component** - Matches a common UI pattern (modals, tooltips, etc.)
4. **Theme-Dependent** - Requires light/dark mode styling
5. **Accessibility Requirements** - Needs specific ARIA attributes or keyboard interactions

**Don't create a primitive for:**
- Page-specific layouts (use composition instead)
- One-off visual elements
- Simple utility wrappers (use Tailwind directly)

### Primitive Creation Checklist

When creating a new primitive:

- [ ] Use `class-variance-authority` for variant management
- [ ] Define clear variant names (descriptive, not presentational)
- [ ] Support both light and dark modes
- [ ] Export TypeScript types for props
- [ ] Add JSDoc comments with usage examples
- [ ] Create snapshot tests for all variants
- [ ] Document in primitives README
- [ ] Add to primitives index export

**Template:**

```tsx
import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'

const myPrimitiveVariants = cva(
  'base-classes-here',
  {
    variants: {
      variant: {
        default: 'default-variant-classes',
        alternate: 'alternate-variant-classes',
      },
      size: {
        sm: 'size-small-classes',
        md: 'size-medium-classes',
        lg: 'size-large-classes',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface MyPrimitiveProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myPrimitiveVariants> {
  children: React.ReactNode
}

export function MyPrimitive({
  variant,
  size,
  className,
  children,
  ...props
}: MyPrimitiveProps) {
  return (
    <div
      className={cn(myPrimitiveVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </div>
  )
}
```

---

## Inline Styling Guidelines

When primitives don't fit, use inline Tailwind with these rules:

### Maximum Utility Count

**Hard limit: 5 utilities per className string**

```tsx
// ✅ GOOD - Layout utilities only
<div className="flex items-center gap-4 px-6 py-4">

// ⚠️ BORDERLINE - Consider extracting if reused
<div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">

// ❌ BAD - Too many utilities, create a primitive
<div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white/70 p-4 shadow-[0_14px_38px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm hover:border-sky-300/50">
```

### Utility Categories

**Allowed inline (layout):**
- Flexbox/Grid: `flex`, `grid`, `items-center`, `justify-between`
- Spacing: `p-4`, `mx-auto`, `gap-2`, `space-y-4`
- Sizing: `w-full`, `h-screen`, `max-w-4xl`
- Positioning: `absolute`, `relative`, `top-0`, `z-10`
- Display: `hidden`, `block`, `md:flex`

**Discouraged inline (visual):**
- Colors: `bg-white`, `text-slate-900`, `border-sky-500`
- Shadows: `shadow-lg`, `shadow-[custom]`
- Borders: `border`, `rounded-xl`, `ring-2`
- Effects: `backdrop-blur-sm`, `opacity-50`

If you need visual utilities, use a primitive or create one.

### ESLint Enforcement

ESLint will warn if `className` exceeds 5 utilities:

```tsx
// ESLint: Warning - className has 8 utilities, consider using a primitive
<div className="flex items-center gap-4 rounded-xl border border-white/35 bg-white/20 p-6 shadow-lg backdrop-blur-md">
```

To bypass (rarely needed):

```tsx
// eslint-disable-next-line tailwindcss/no-custom-classname
<div className="very-long-one-off-className">
```

---

## Theme Mode Considerations

All styling must support both light and dark modes.

### Dark Mode Utilities

Tailwind's `dark:` variant applies when `<html class="dark">`:

```tsx
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
```

### Primitives Handle Themes

Primitives already include dark mode variants:

```tsx
// ✅ GOOD - Primitive handles theme
<Button variant="primary">Submit</Button>

// ❌ BAD - Manual theme handling
<button className="bg-sky-500 dark:bg-sky-600">Submit</button>
```

### Testing Both Modes

When creating new primitives or components:
1. Test in light mode
2. Toggle theme to dark mode
3. Verify colors, contrast, shadows remain readable
4. Check glassmorphism effects render correctly

---

## Common Patterns

### Form Groups

```tsx
<div className="space-y-4">
  <div>
    <label className="mb-1 block text-sm font-medium">Email</label>
    <Input type="email" placeholder="you@example.com" />
  </div>
  <div>
    <label className="mb-1 block text-sm font-medium">Password</label>
    <Input type="password" placeholder="••••••••" />
  </div>
  <Button variant="primary" size="lg" className="w-full">
    Sign In
  </Button>
</div>
```

### Card Grids

```tsx
<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => (
    <GlassCard key={item.id} variant="default" padding="md">
      <h3 className="text-lg font-semibold">{item.title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {item.description}
      </p>
    </GlassCard>
  ))}
</div>
```

### Loading States

```tsx
<Button variant="primary" size="lg" loading disabled>
  <span className="opacity-0">Submit</span>
  <span className="absolute inset-0 flex items-center justify-center">
    <Spinner />
  </span>
</Button>
```

### Conditional Variants

```tsx
<Badge variant={status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'error'}>
  {status}
</Badge>
```

---

## Related Documentation

- [Sumurai UI Guidelines](../../docs/sumurai-ui-guidelines.md) - Design system fundamentals
- [Primitives README](../src/ui/primitives/README.md) - Detailed primitive documentation
- [Contributing Guide](CONTRIBUTING.md) - Code contribution workflow

---

## Questions?

If this guide doesn't answer your question:
1. Check existing primitive implementations for patterns
2. Review merged PRs for similar components
3. Ask in team chat or create a GitHub discussion
