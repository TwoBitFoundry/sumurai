export type SemanticTextRole =
  | 'primary'
  | 'body'
  | 'muted'
  | 'subtle'
  | 'label'
  | 'inverse'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info';

export const text = {
  primary: 'text-slate-900 dark:text-slate-100',
  body: 'text-slate-700 dark:text-slate-300',
  muted: 'text-slate-600 dark:text-slate-400',
  subtle: 'text-slate-500 dark:text-slate-500',
  label: 'text-slate-600 dark:text-slate-400',
  inverse: 'text-white dark:text-white',
  accent: 'text-sky-600 dark:text-sky-300',
  danger: 'text-red-600 dark:text-red-300',
  success: 'text-emerald-600 dark:text-emerald-300',
  warning: 'text-amber-600 dark:text-amber-300',
  info: 'text-sky-600 dark:text-sky-300',
} as const satisfies Record<SemanticTextRole, string>;

export const placeholder = {
  muted: 'placeholder:text-slate-400 dark:placeholder:text-slate-500',
} as const;

export const surface = {
  appShell: ['bg-[var(--color-surface-app-shell)]', 'dark:bg-[var(--color-surface-app-shell)]'],
  glassPanel: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_18%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
  ],
  solidPanel: [
    'bg-[var(--color-surface-solid-panel)]',
    'dark:bg-[var(--color-surface-solid-panel)]',
  ],
  elevatedCard: [
    'bg-[var(--color-surface-elevated-card)]',
    'dark:bg-[var(--color-surface-elevated-card)]',
  ],
  card: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card)_55%,transparent)]',
  ],
  hoverRow: ['bg-[var(--color-surface-hover-row)]', 'dark:bg-[var(--color-surface-hover-row)]'],
  mutedChip: ['bg-[var(--color-surface-muted-chip)]', 'dark:bg-[var(--color-surface-muted-chip)]'],
  insetWell: ['bg-[var(--color-surface-inset-well)]', 'dark:bg-[var(--color-surface-inset-well)]'],
  overlay: ['bg-[var(--color-surface-overlay)]', 'dark:bg-[var(--color-surface-overlay)]'],
} as const;

export const border = {
  default: ['border-[var(--color-border-default)]', 'dark:border-[var(--color-border-default)]'],
  subtle: ['border-[var(--color-border-subtle)]', 'dark:border-[var(--color-border-subtle)]'],
  glass: [
    'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
    'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
  ],
  control: ['border-[var(--color-border-control)]', 'dark:border-[var(--color-border-control)]'],
  divider: ['border-[var(--color-border-divider)]', 'dark:border-[var(--color-border-divider)]'],
  hoverAccent: [
    'border-[var(--color-border-hover-accent)]',
    'dark:border-[var(--color-border-hover-accent)]',
  ],
  danger: ['border-[var(--color-border-danger)]', 'dark:border-[var(--color-border-danger)]'],
} as const;

export const effect = {
  glassShadow: [
    'shadow-[0_32px_110px_-60px_var(--color-effect-glass-shadow)]',
    'dark:shadow-[0_36px_120px_-62px_var(--color-effect-glass-shadow)]',
  ],
  accentHover: [
    'hover:shadow-[0_18px_44px_-30px_var(--color-effect-accent-hover)]',
    'dark:hover:shadow-[0_20px_52px_-34px_var(--color-effect-accent-hover)]',
  ],
  successGlow: [
    'shadow-[0_0_12px_var(--color-effect-success-glow)]',
    'dark:shadow-[0_0_12px_var(--color-effect-success-glow)]',
  ],
  dangerGlow: [
    'shadow-[0_0_12px_var(--color-effect-danger-glow)]',
    'dark:shadow-[0_0_12px_var(--color-effect-danger-glow)]',
  ],
  pageShellInsetRing: [
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]',
    'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]',
  ],
} as const;

export const status = {
  info: {
    surface: [
      'bg-[var(--color-status-info-surface)]',
      'dark:bg-[var(--color-status-info-surface)]',
    ],
    border: [
      'border-[var(--color-status-info-border)]',
      'dark:border-[var(--color-status-info-border)]',
    ],
    text: ['text-[var(--color-status-info-text)]', 'dark:text-[var(--color-status-info-text)]'],
    strongSurface: [
      'bg-[var(--color-status-info-strong-surface)]',
      'dark:bg-[var(--color-status-info-strong-surface)]',
    ],
    icon: ['text-[var(--color-status-info-icon)]', 'dark:text-[var(--color-status-info-icon)]'],
  },
  success: {
    surface: [
      'bg-[var(--color-status-success-surface)]',
      'dark:bg-[var(--color-status-success-surface)]',
    ],
    border: [
      'border-[var(--color-status-success-border)]',
      'dark:border-[var(--color-status-success-border)]',
    ],
    text: [
      'text-[var(--color-status-success-text)]',
      'dark:text-[var(--color-status-success-text)]',
    ],
    strongSurface: [
      'bg-[var(--color-status-success-strong-surface)]',
      'dark:bg-[var(--color-status-success-strong-surface)]',
    ],
    icon: [
      'text-[var(--color-status-success-icon)]',
      'dark:text-[var(--color-status-success-icon)]',
    ],
  },
  warning: {
    surface: [
      'bg-[var(--color-status-warning-surface)]',
      'dark:bg-[var(--color-status-warning-surface)]',
    ],
    border: [
      'border-[var(--color-status-warning-border)]',
      'dark:border-[var(--color-status-warning-border)]',
    ],
    text: [
      'text-[var(--color-status-warning-text)]',
      'dark:text-[var(--color-status-warning-text)]',
    ],
    strongSurface: [
      'bg-[var(--color-status-warning-strong-surface)]',
      'dark:bg-[var(--color-status-warning-strong-surface)]',
    ],
    icon: [
      'text-[var(--color-status-warning-icon)]',
      'dark:text-[var(--color-status-warning-icon)]',
    ],
  },
  danger: {
    surface: [
      'bg-[color:color-mix(in_srgb,var(--color-status-danger-surface)_82%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-status-danger-surface)_28%,transparent)]',
    ],
    border: [
      'border-[var(--color-status-danger-border)]',
      'dark:border-[var(--color-status-danger-border)]',
    ],
    text: ['text-[var(--color-status-danger-text)]', 'dark:text-[var(--color-status-danger-text)]'],
    strongSurface: [
      'bg-[var(--color-status-danger-strong-surface)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-status-danger-strong-surface)_46%,transparent)]',
    ],
    icon: ['text-[var(--color-status-danger-icon)]', 'dark:text-[var(--color-status-danger-icon)]'],
  },
} as const;

export const focus = {
  visible:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900',
  danger:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-red-400/75 dark:focus-visible:ring-offset-slate-900',
  darkOffset: 'dark:focus:ring-offset-[var(--color-surface-glass-panel)]',
  visibleDarkOffset: 'dark:focus-visible:ring-offset-[var(--color-surface-glass-panel)]',
  ringOffsetLightOnDark: [
    'ring-offset-white',
    'dark:ring-offset-[var(--color-surface-glass-panel)]',
  ],
} as const;

export const font = {
  display: 'font-display text-[clamp(2.25rem,3vw,3rem)] font-bold leading-[1.1] tracking-normal',
  pageTitle: 'font-page-title text-[2rem] font-bold leading-[1.1] tracking-normal',
  sectionTitle: 'font-section-title text-[1.5rem] font-semibold leading-[1.25] tracking-normal',
  cardTitle: 'font-card-title text-[1.25rem] font-semibold leading-[1.25] tracking-normal',
  body: 'font-body text-[1rem] font-normal leading-[1.5] tracking-normal',
  bodyStrong: 'font-body-strong text-[1rem] font-semibold leading-[1.5] tracking-normal',
  caption: 'font-caption text-[0.875rem] font-normal leading-[1.5] tracking-normal',
  captionStrong: 'font-caption text-[0.875rem] font-semibold leading-[1.5] tracking-normal',
  label: 'font-label text-[0.75rem] font-semibold uppercase leading-none tracking-[0.14em]',
  badge: 'font-label text-[0.75rem] font-bold uppercase leading-none tracking-[0.14em]',
} as const;

export const radius = {
  standard: 'rounded-[length:var(--radius-standard)]',
} as const;

export const chrome = {
  xs: `px-[length:var(--spacing-button-chrome-inset-sm-x)] py-[length:var(--spacing-button-chrome-inset-sm-y)] ${radius.standard}`,
  sm: `px-[length:var(--spacing-button-chrome-inset-sm-x)] py-[length:var(--spacing-button-chrome-inset-sm-y)] ${radius.standard}`,
} as const;

export const semanticTextRecipes = text;
export const semanticPlaceholderTextRecipes = placeholder;
