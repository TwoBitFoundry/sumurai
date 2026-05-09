import { primitiveTypographyRecipes } from '@/ui/primitives/tokenRecipes';

const semanticSurfaces = {
  card: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card-dark)_55%,transparent)]',
  ],
  mutedChip: [
    'bg-[var(--color-surface-muted-chip)]',
    'dark:bg-[var(--color-surface-muted-chip-dark)]',
  ],
  hoverRow: [
    'bg-[var(--color-surface-hover-row)]',
    'dark:bg-[var(--color-surface-hover-row-dark)]',
  ],
} as const;

const semanticBorders = {
  subtle: ['border-[var(--color-border-subtle)]', 'dark:border-[var(--color-border-subtle-dark)]'],
  glass: [
    'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
    'dark:border-[color:color-mix(in_srgb,var(--color-border-glass-dark)_12%,transparent)]',
  ],
  control: [
    'border-[var(--color-border-control)]',
    'dark:border-[var(--color-border-control-dark)]',
  ],
  danger: ['border-[var(--color-border-danger)]', 'dark:border-[var(--color-border-danger-dark)]'],
} as const;

const semanticStatus = {
  success: {
    surface: [
      'bg-[var(--color-status-success-surface)]',
      'dark:bg-[var(--color-status-success-surface-dark)]',
    ],
    text: [
      'text-[var(--color-status-success-text)]',
      'dark:text-[var(--color-status-success-text-dark)]',
    ],
  },
  danger: {
    surface: [
      'bg-[var(--color-status-danger-surface)]',
      'dark:bg-[var(--color-status-danger-surface-dark)]',
    ],
    border: [
      'border-[var(--color-status-danger-border)]',
      'dark:border-[var(--color-status-danger-border-dark)]',
    ],
    text: [
      'text-[var(--color-status-danger-text)]',
      'dark:text-[var(--color-status-danger-text-dark)]',
    ],
  },
} as const;

const semanticEffects = {
  glassShadow: [
    'shadow-[0_32px_80px_-58px_var(--color-effect-glass-shadow)]',
    'dark:shadow-[0_32px_90px_-60px_var(--color-effect-glass-shadow-dark)]',
  ],
  successGlow: [
    'shadow-[0_0_12px_var(--color-effect-success-glow)]',
    'dark:shadow-[0_0_12px_var(--color-effect-success-glow-dark)]',
  ],
  dangerGlow: [
    'shadow-[0_0_12px_var(--color-effect-danger-glow)]',
    'dark:shadow-[0_0_12px_var(--color-effect-danger-glow-dark)]',
  ],
  accentHover: [
    'hover:shadow-[0_18px_44px_-30px_var(--color-effect-accent-hover)]',
    'dark:hover:shadow-[0_20px_52px_-34px_var(--color-effect-accent-hover-dark)]',
  ],
} as const;

export const budgetTokenRecipes = {
  budgetCard: {
    shell: [
      'group relative overflow-hidden rounded-[1.75rem] p-6',
      ...semanticBorders.subtle,
      ...semanticSurfaces.card,
      ...semanticEffects.glassShadow,
      'transition-all duration-300 hover:-translate-y-1',
      ...semanticEffects.accentHover,
    ],
  },
  budgetProgress: {
    track: [
      'relative',
      'h-2.5',
      'overflow-hidden',
      'rounded-full',
      ...semanticSurfaces.mutedChip,
      'shadow-[inset_0_1px_2px_var(--color-effect-glass-shadow)]',
      'transition-colors',
      'duration-300',
      'dark:shadow-[inset_0_1px_2px_var(--color-effect-glass-shadow-dark)]',
    ],
    fill: {
      base: ['absolute', 'inset-y-0', 'left-0', 'rounded-full', 'transition-all', 'duration-500'],
      within: [
        'bg-gradient-to-r',
        'from-[var(--color-brand-sky)]',
        'via-[var(--color-brand-cyan)]',
        'to-[var(--color-brand-violet)]',
        ...semanticEffects.successGlow,
      ],
      over: [
        'bg-gradient-to-r',
        'from-[var(--color-brand-rose-dark)]',
        'via-[var(--color-brand-rose)]',
        'to-[var(--color-text-danger)]',
        ...semanticEffects.dangerGlow,
      ],
    },
    caption: {
      row: [
        'flex',
        'items-center',
        'justify-between',
        'text-[0.75rem]',
        'text-slate-500',
        'transition-colors',
        'duration-300',
        'dark:text-slate-400',
      ],
      percent: ['font-medium', 'tracking-wide'],
      summaryWithin: ['font-semibold', 'text-slate-600', 'dark:text-slate-300'],
      summaryOver: ['font-semibold', ...semanticStatus.danger.text],
    },
  },
  actions: {
    budgetIconGhost: [
      'inline-flex items-center justify-center rounded-full p-2',
      ...semanticBorders.glass,
      ...semanticSurfaces.card,
      'text-slate-600 dark:text-slate-200',
      ...semanticEffects.glassShadow,
      'transition-transform duration-200 hover:-translate-y-[2px] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row-dark)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]',
    ],
    budgetSaveIcon: [
      'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-brand-emerald)] via-[var(--color-brand-emerald-dark)] to-[var(--color-brand-sky-dark)] p-2 text-white',
      ...semanticEffects.successGlow,
      'transition-transform duration-200 hover:-translate-y-[2px]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      'dark:focus-visible:ring-offset-[#0f172a]',
    ],
    budgetDeleteIcon: [
      'inline-flex items-center justify-center rounded-full border p-2',
      ...semanticStatus.danger.border,
      ...semanticStatus.danger.surface,
      ...semanticStatus.danger.text,
      'shadow-sm',
      'transition-transform duration-200 hover:-translate-y-[2px] hover:bg-[var(--color-status-danger-strong-surface)] dark:hover:bg-[var(--color-status-danger-strong-surface-dark)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-[var(--color-border-danger-dark)] dark:focus-visible:ring-offset-[#0f172a]',
    ],
    paginationRound: [
      'inline-flex h-9 w-9 items-center justify-center rounded-full',
      ...semanticBorders.glass,
      ...semanticSurfaces.card,
      'text-slate-600 dark:text-slate-200',
      ...semanticEffects.glassShadow,
      'transition-all duration-200 hover:-translate-y-[2px] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row-dark)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]',
      'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
    ],
    accountsToolbar: [
      'inline-flex items-center gap-2 rounded-full px-5 py-2',
      ...semanticBorders.control,
      ...semanticSurfaces.card,
      primitiveTypographyRecipes.bodyStrong,
      'text-[var(--color-text-primary)]',
      ...semanticEffects.glassShadow,
      'transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--color-border-hover-accent)] hover:text-[var(--color-text-primary)]',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none',
      'dark:text-[#cbd5e1] dark:hover:border-[var(--color-border-hover-accent-dark)] dark:hover:text-white dark:focus-visible:ring-offset-slate-900',
    ],
  },
} as const;
