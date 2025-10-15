# Contributing to Sumaura Frontend

Thank you for your interest in contributing to Sumaura! This document provides guidelines for contributing to the frontend codebase.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Styling Guidelines](#styling-guidelines)
- [Testing Requirements](#testing-requirements)
- [Code Quality Standards](#code-quality-standards)
- [Pull Request Process](#pull-request-process)

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker (for full-stack development)
- Familiarity with React 19, TypeScript, and Tailwind CSS

### Setup

```bash
# Install dependencies
cd frontend
npm install

# Run development server (proxies to backend)
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

Visit [http://localhost:8080](http://localhost:8080) for full-stack testing (requires backend running via Docker Compose).

---

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <description>

[optional body]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no functional changes)
- `style`: Formatting, styling changes
- `test`: Adding or updating tests
- `docs`: Documentation updates
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add password reset flow
fix(transactions): correct date filtering logic
refactor(primitives): extract Button variants to CVA
test(primitives): add snapshot tests for GlassCard
```

---

## Styling Guidelines

**Sumaura follows a primitive-first styling architecture.** This is the most important guideline for contributors.

### Primitive-First Approach

1. **ALWAYS check for existing primitives first** before writing custom styles
2. **Use primitives from `@/ui/primitives`** for all visual components
3. **Inline Tailwind classes** should be limited to layout (flex, grid, spacing, sizing)
4. **Maximum 5 utility classes** in any `className` prop

### Decision Tree

```
Need to style something?
│
├─ Does a primitive exist? → YES → Use it
│   └─ Need layout adjustments? → Add max 5 utilities via className
│
└─ No primitive exists → Is it reusable (3+ uses)?
    ├─ YES → Create new primitive
    └─ NO → Use max 5 inline utilities
```

### Available Primitives

Located in `src/ui/primitives/`:

- **GradientShell** - Full-page backgrounds with aura effects
- **GlassCard** - Glassmorphism containers
- **Button** - Interactive buttons (9 variants)
- **Input** - Form inputs
- **Badge** - Status indicators
- **MenuDropdown** - Dropdown menus

See [src/ui/primitives/README.md](../src/ui/primitives/README.md) for detailed documentation.

### Examples

**✅ GOOD:**
```tsx
import { Button, GlassCard } from '@/ui/primitives'

function MyComponent() {
  return (
    <GlassCard variant="default" padding="lg" className="mt-4">
      <h2 className="text-lg font-semibold">Title</h2>
      <Button variant="primary" className="w-full mt-2">
        Submit
      </Button>
    </GlassCard>
  )
}
```

**❌ BAD:**
```tsx
// Too many utilities, should use primitive
function MyComponent() {
  return (
    <div className="border border-white/35 bg-white/18 shadow-lg rounded-3xl p-6 backdrop-blur-2xl">
      <button className="bg-gradient-to-r from-sky-500 to-violet-500 text-white px-4 py-2 rounded-full">
        Submit
      </button>
    </div>
  )
}
```

### Creating New Primitives

If you need to create a new primitive:

1. Use `class-variance-authority` for variants
2. Support light and dark modes
3. Export TypeScript types
4. Add JSDoc comments with examples
5. Create snapshot tests
6. Document in primitives README
7. Add to index exports

See [docs/STYLING_GUIDE.md](STYLING_GUIDE.md) for detailed primitive creation guidelines.

---

## Testing Requirements

### All Contributions Must Include Tests

- **New features** → Unit tests + integration tests
- **Bug fixes** → Regression tests
- **New primitives** → Snapshot tests for all variants
- **Refactors** → Ensure existing tests still pass

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- Button.test.tsx

# Run tests with UI
npm run test:ui
```

### Test Structure

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

describe('ComponentName', () => {
  it('renders correctly with default props', () => {
    const { getByText } = render(<ComponentName />)
    expect(getByText('Expected Text')).toBeTruthy()
  })

  it('handles user interactions', () => {
    const handleClick = vi.fn()
    const { getByRole } = render(<ComponentName onClick={handleClick} />)
    getByRole('button').click()
    expect(handleClick).toHaveBeenCalled()
  })
})
```

### Snapshot Tests for Primitives

All primitive variants must have snapshot tests:

```tsx
import { render } from '@testing-library/react'

it('renders primary variant correctly', () => {
  const { container } = render(<Button variant="primary">Click</Button>)
  const button = container.querySelector('button')
  expect(button?.className).toMatchSnapshot()
})
```

---

## Code Quality Standards

### TypeScript

- **No `any` types** unless absolutely necessary (will warn in ESLint)
- **Use interfaces** for component props
- **Export types** from primitives
- **Leverage type inference** where possible

### ESLint

ESLint will automatically check your code for:

- Long Tailwind className strings (>5 utilities)
- Unused variables
- Explicit `any` types

Run linting before committing:

```bash
npm run lint        # Check for errors
npm run lint:fix    # Auto-fix errors
```

### File Organization

```
src/
├── components/       # Feature components
├── pages/           # Page components
├── services/        # API services
├── hooks/           # Custom React hooks
├── ui/
│   └── primitives/  # Reusable UI primitives
├── layouts/         # Layout components
├── utils/           # Utility functions
└── types/           # TypeScript type definitions
```

### Separation of Concerns

- **Models** → `src/types/`
- **Business logic** → `src/services/`
- **Tests** → `tests/` (not inline with source)
- **UI primitives** → `src/ui/primitives/`

---

## Pull Request Process

### Pre-commit Hooks

Pre-commit hooks are configured to automatically run on staged files:
- **ESLint** checks Tailwind utility count and code quality
- **TypeScript** type checking ensures no type errors

Hooks run automatically when you commit. To bypass (rarely needed):
```bash
git commit --no-verify -m "message"
```

### Before Submitting

1. **Run tests**: `npm test` - All must pass
2. **Run linting**: `npm run lint` - No errors (pre-commit handles staged files)
3. **Type check**: `tsc -b` - No type errors (pre-commit handles staged files)
4. **Test E2E**: Verify at `http://localhost:8080` (with backend running)
5. **Review your changes**: Ensure no debug code, console.logs, or commented code

### PR Checklist

- [ ] All tests pass
- [ ] No ESLint warnings or errors
- [ ] New code has tests
- [ ] Uses existing primitives (or documents why new primitive needed)
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow conventional commits
- [ ] PR description explains what/why/how

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation

## Styling
- [ ] Uses existing primitives
- [ ] Created new primitive (documented in primitives README)
- [ ] No Tailwind strings >5 utilities (or documented exceptions)

## Testing
- [ ] Unit tests added/updated
- [ ] All tests pass
- [ ] Tested at http://localhost:8080

## Screenshots (if UI changes)
[Add screenshots here]
```

### Review Process

1. Automated checks run (linting, tests, type checking)
2. Code review by maintainer
3. Address feedback
4. Approval → Squash and merge

---

## Common Patterns

### Forms

```tsx
import { Input, Button } from '@/ui/primitives'

function LoginForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <Input type="email" placeholder="you@example.com" />
      </div>
      <Button variant="primary" size="lg" className="w-full">
        Sign In
      </Button>
    </form>
  )
}
```

### Card Grids

```tsx
import { GlassCard } from '@/ui/primitives'

function CardGrid({ items }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map(item => (
        <GlassCard key={item.id} variant="default" padding="md">
          {/* Card content */}
        </GlassCard>
      ))}
    </div>
  )
}
```

### Conditional Variants

```tsx
import { Badge } from '@/ui/primitives'

function StatusBadge({ status }) {
  const variant = status === 'active' ? 'primary' : 'default'
  return <Badge variant={variant}>{status}</Badge>
}
```

---

## Resources

- [STYLING_GUIDE.md](STYLING_GUIDE.md) - Detailed styling architecture
- [Primitives README](../src/ui/primitives/README.md) - Primitive documentation
- [Sumaura UI Guidelines](../../docs/sumaura-ui-guidelines.md) - Design system
- [CLAUDE.md](../../CLAUDE.md) - Project overview for Claude Code

---

## Questions?

- Check existing issues on GitHub
- Review merged PRs for similar patterns
- Ask in team discussions

**Thank you for contributing to Sumaura!**
