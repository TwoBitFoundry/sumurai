# UI composition examples

Use with `SKILL.md` in this directory.

If a screen already has a layout frame like `PageLayout`, keep it and build the visual treatment with primitives inside it. The goal is to compose with the shared surface, border, text, and font recipes instead of inventing new chrome in the screen.

## Good

This is the shape we want for a small budgets-style screen: a shell, a couple of glass cards, and shared recipes for typography and status color.

```tsx
import { ArrowUpRightIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import {
  Button,
  FinanceValue,
  GlassCard,
  GradientShell,
  IconButton,
  Pill,
} from '@/ui/primitives';
import { border, cn, font, surface, text } from '@/ui/recipes';

export function BudgetSnapshotExample() {
  return (
    <GradientShell>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className={cn(font.label, text.accent)}>Budgets</p>
            <h1 className={cn(font.pageTitle, text.primary)}>Monthly spending</h1>
            <p className={cn(font.body, text.body)}>
              Keep the screen structure in primitives and the meaning in shared recipes.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary">Export</Button>
            <Button variant="primary">Add budget</Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <GlassCard variant="default" padding="lg" rounded="xl">
            <div className={cn('flex items-center justify-between border-b pb-4', border.subtle)}>
              <div className="space-y-1">
                <p className={cn(font.cardTitle, text.primary)}>Groceries</p>
                <p className={cn(font.caption, text.muted)}>Forecast 12 days left</p>
              </div>

              <div className="flex items-center gap-2">
                <Pill variant="status" tone="warning">
                  watch
                </Pill>
                <IconButton variant="ghost" aria-label="More options">
                  <EllipsisHorizontalIcon className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className={cn('h-2 rounded-full', surface.inset)}>
                <div className="h-full w-[68%] rounded-full bg-[var(--color-brand-cyan)]" />
              </div>

              <div className="flex items-center justify-between">
                <span className={cn(font.caption, text.muted)}>Spent</span>
                <FinanceValue tone="cash" value={836} />
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="accent" padding="lg" rounded="xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className={cn(font.cardTitle, text.primary)}>Summary</p>
                  <p className={cn(font.caption, text.muted)}>Keep the copy terse and the numbers readable.</p>
                </div>

                <ArrowUpRightIcon className={cn('h-5 w-5', text.accent)} />
              </div>

              <div className={cn('rounded-2xl p-4', surface.row, border.subtle)}>
                <p className={cn(font.label, text.muted)}>Remaining</p>
                <FinanceValue tone="netWorth" value={4120} className={cn(font.sectionTitle, 'mt-1')} />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </GradientShell>
  );
}
```

## Bad

This is what to avoid: hand-built gradients, raw palette classes, and style decisions that should live in primitives or recipes.

```tsx
export function BadBudgetCard() {
  return (
    <div className="rounded-[28px] bg-gradient-to-r from-sky-500 via-violet-500 to-cyan-500 p-6 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Monthly spending</h2>
          <p className="text-slate-200">A reusable visual role should not live here.</p>
        </div>
        <button className="rounded-full bg-slate-950 px-4 py-2 text-white">Add budget</button>
      </div>

      <div className="mt-4 text-emerald-300">$836 spent</div>
    </div>
  );
}
```

Why this is bad:

- It duplicates shell styling that already exists in `GradientShell` and `GlassCard`.
- It hardcodes palette choices instead of using `recipes.text`, `recipes.surface`, and `recipes.border`.
- It bakes a visual role into one screen instead of making it reusable through a primitive.

## How to add a new visual role

1. Decide whether an existing primitive variant covers it. If yes, add the variant there.
2. If not, add the reusable role to `DESIGN.md` and run `bun --cwd=frontend run design:guard`.
3. Add the shared class recipe to `frontend/src/ui/recipes.ts`, or keep it local to the primitive if it is component-specific.
4. Add or update a Storybook story for the primitive or feature component.
5. Update tests only if behavior changed, not just because the styling was refactored.
