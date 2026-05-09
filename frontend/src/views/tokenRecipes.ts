import { designTokens } from '@/ui/tokens';

const semanticSurfaces = {
  card: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card-dark)_55%,transparent)]',
  ],
  hoverRow: [
    'bg-[var(--color-surface-hover-row)]',
    'dark:bg-[var(--color-surface-hover-row-dark)]',
  ],
  mutedChip: [
    'bg-[var(--color-surface-muted-chip)]',
    'dark:bg-[var(--color-surface-muted-chip-dark)]',
  ],
} as const;

const semanticBorders = {
  default: [
    'border-[var(--color-border-default)]',
    'dark:border-[var(--color-border-default-dark)]',
  ],
  subtle: ['border-[var(--color-border-subtle)]', 'dark:border-[var(--color-border-subtle-dark)]'],
  glass: [
    'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
    'dark:border-[color:color-mix(in_srgb,var(--color-border-glass-dark)_12%,transparent)]',
  ],
} as const;

const semanticEffects = {
  glassShadow: [
    'shadow-[0_18px_48px_-36px_var(--color-effect-glass-shadow)]',
    'dark:shadow-[0_20px_56px_-40px_var(--color-effect-glass-shadow-dark)]',
  ],
  accentHover: [
    'hover:shadow-[0_18px_44px_-30px_var(--color-effect-accent-hover)]',
    'dark:hover:shadow-[0_20px_52px_-34px_var(--color-effect-accent-hover-dark)]',
  ],
} as const;

export const dashboardTokenRecipes = {
  cardShell: [
    'rounded-lg border transition-all duration-300',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
  ],
  cardShellActive: [
    'rounded-lg border transition-all duration-300 -translate-y-[2px]',
    ...semanticBorders.default,
    ...semanticSurfaces.hoverRow,
    ...semanticEffects.glassShadow,
  ],
  loadingCard: [
    'min-h-[220px] rounded-xl border animate-pulse',
    ...semanticBorders.subtle,
    ...semanticSurfaces.mutedChip,
  ],
  merchantRow: [
    'flex items-center justify-between rounded-lg border p-3 transition-all duration-300 hover:-translate-y-[2px]',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.accentHover,
  ],
  summaryShell: [
    'rounded-xl border p-4 transition-all duration-300',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
  ],
  summaryShellLoading: [
    'h-16 rounded-xl border',
    ...semanticBorders.subtle,
    ...semanticSurfaces.mutedChip,
  ],
  hoverInfoShell: [
    'flex flex-wrap items-center gap-3 rounded-lg border p-3',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
  ],
  toolbarShell: ['border-b px-6 pb-4 pt-6', ...semanticBorders.subtle],
  floatingRangeShell: [
    'flex gap-2 rounded-2xl border px-3 py-2',
    ...semanticBorders.glass,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
    'backdrop-blur-md',
    'backdrop-saturate-[150%]',
  ],
  tableHeader: [
    ...semanticSurfaces.mutedChip,
    designTokens.text.body,
    'transition-colors duration-500',
  ],
  tableFooter: [
    'border-t px-4 py-4 transition-colors duration-500',
    ...semanticBorders.glass,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
    'backdrop-blur-md',
    'backdrop-saturate-[150%]',
  ],
} as const;
