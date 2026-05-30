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
  floatingChromePanel: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_26%,transparent)]',
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
  overlay: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-overlay)_20%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-overlay)_36%,transparent)]',
  ],
} as const;

export const border = {
  default: ['border-[var(--color-border-default)]', 'dark:border-[var(--color-border-default)]'],
  subtle: ['border-[var(--color-border-subtle)]', 'dark:border-[var(--color-border-subtle)]'],
  glass: [
    'border-[color:color-mix(in_srgb,var(--color-border-glass)_35%,transparent)]',
    'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
  ],
  floatingChrome: [
    'border-[var(--color-border-control)]',
    'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
  ],
  elevatedGlass: [
    'border-[var(--color-border-subtle)]',
    'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
  ],
  control: ['border-[var(--color-border-control)]', 'dark:border-[var(--color-border-control)]'],
  divider: ['border-[var(--color-border-divider)]', 'dark:border-[var(--color-border-divider)]'],
  hoverAccent: [
    'border-[var(--color-border-hover-accent)]',
    'dark:border-[var(--color-border-hover-accent)]',
  ],
  focusActive: [
    'border-[var(--color-border-focus-active)]',
    'dark:border-[var(--color-border-focus-active)]',
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

export const buttonCta = {
  gradient: [
    'bg-gradient-to-r',
    'from-[var(--color-brand-sky)]',
    'via-[var(--color-brand-cyan)]',
    'to-[var(--color-brand-violet)]',
  ],
  shadow: [
    'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.78)]',
    'dark:shadow-[0_22px_60px_-32px_rgba(56,189,248,0.65)]',
  ],
  hover: [
    'hover:-translate-y-0.5',
    'hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.85)]',
    'disabled:hover:translate-y-0',
  ],
} as const;

export const successCta = {
  gradient: [
    'bg-gradient-to-r',
    'from-[var(--color-brand-emerald)]',
    'via-[var(--color-brand-emerald)]',
    'to-[var(--color-brand-sky)]',
  ],
  hover: ['hover:-translate-y-[2px]', 'active:scale-[0.98]', 'disabled:active:scale-100'],
  focus: [
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-[var(--color-border-focus-active)]',
    'focus-visible:ring-offset-2',
    'focus-visible:ring-offset-white',
    'dark:focus-visible:ring-offset-[#0f172a]',
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

export const budgetProgress = {
  track: [
    'relative',
    'h-2.5',
    'w-full',
    'overflow-hidden',
    'rounded-full',
    'border',
    'border-[var(--color-border-subtle)]',
    'bg-[var(--color-surface-inset-well)]',
    'dark:bg-[var(--color-surface-inset-well)]',
  ],
  fillBase: [
    'absolute',
    'inset-y-0',
    'left-0',
    'h-full',
    'rounded-full',
    'transition-all',
    'duration-500',
    'ease-out',
  ],
  fillWithin: [
    'bg-gradient-to-r',
    'from-[var(--color-brand-sky)]',
    'via-[var(--color-brand-cyan)]',
    'to-[var(--color-brand-violet)]',
    'shadow-[0_0_12px_var(--color-effect-success-glow)]',
    'dark:shadow-[0_0_12px_var(--color-effect-success-glow)]',
  ],
  fillOver: [
    'bg-gradient-to-r',
    'from-[var(--color-brand-rose)]',
    'via-[var(--color-brand-rose)]',
    'to-[var(--color-text-danger)]',
    'shadow-[0_0_12px_var(--color-effect-danger-glow)]',
    'dark:shadow-[0_0_12px_var(--color-effect-danger-glow)]',
  ],
  captionRow: [
    'flex',
    'items-center',
    'justify-between',
    'text-[0.75rem]',
    'text-slate-600',
    'dark:text-slate-400',
    'transition-colors',
    'duration-300',
  ],
  captionPercent: ['font-medium', 'tracking-wide'],
  captionWithin: ['font-semibold', 'text-slate-700', 'dark:text-slate-300'],
  captionOver: ['font-semibold', 'text-red-600', 'dark:text-red-300'],
} as const;

export const radius = {
  standard: 'rounded-[length:var(--radius-standard)]',
} as const;

export const dashboardCategoryCard = {
  shell: [
    `${radius.standard} border transition-all duration-300 text-left`,
    ...border.subtle,
    ...surface.card,
    ...effect.glassShadow,
  ],
  shellActive: [
    `${radius.standard} border transition-all duration-300`,
    ...surface.card,
    ...effect.glassShadow,
    '!border-[var(--dashboard-category-card-hover-border)]',
  ],
  shellInteractive: [
    `${radius.standard} border transition-all duration-300`,
    ...border.subtle,
    ...surface.card,
    ...effect.glassShadow,
    'hover:border-[var(--dashboard-category-card-hover-border)]',
  ],
  chartHoverBorder: [
    'transition-all duration-300',
    'hover:!border-[var(--dashboard-category-card-hover-border)]',
  ],
} as const;

export const modalBackdrop = {
  provider: [
    'backdrop-blur-[6px]',
    'backdrop-saturate-[92%]',
    'bg-[color:color-mix(in_srgb,var(--color-surface-overlay)_22%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-overlay)_38%,transparent)]',
  ],
} as const;

export const floatingChromeGlass = {
  backdrop: ['backdrop-blur-md', 'backdrop-saturate-[150%]'],
  shell: [
    'border',
    ...surface.floatingChromePanel,
    ...border.floatingChrome,
    ...effect.glassShadow,
  ],
} as const;

export const categoryPickerPopover = {
  motion: ['category-picker-popover'],
} as const;

export const modalDrawer = {
  overlay: ['bg-transparent'],
  overlayMotion: ['modal-drawer-overlay'],
  contentMotion: ['modal-drawer-content'],
  formFooter: [
    'mt-auto',
    'border-t',
    'border-black/10',
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_96%,white)]',
    'px-5',
    'pb-[max(1rem,env(safe-area-inset-bottom))]',
    'pt-4',
    'dark:border-white/10',
    'dark:bg-[#0f172a]/98',
  ],
  formRow: ['flex', 'items-end', 'gap-2'],
  formField: ['min-w-0', 'flex-1', 'space-y-1'],
  submitButton: ['shrink-0'],
} as const;

export const chartTooltip = {
  shell: [
    radius.standard,
    'border',
    'px-3',
    'py-2',
    'isolate',
    'backdrop-blur-2xl backdrop-saturate-[150%]',
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_58%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
    ...border.floatingChrome,
    ...effect.glassShadow,
  ],
  fade: ['transition-opacity', 'ease-out', 'duration-200'],
  label: [font.caption, text.muted],
  row: [font.captionStrong, text.body],
} as const;

export const transactionsTable = {
  chromeBar: [...surface.glassPanel, 'backdrop-blur-md backdrop-saturate-[150%]'],
  footer: [
    'border-t px-4 py-4 transition-colors duration-500',
    ...border.subtle,
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_12%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
    'backdrop-blur-md backdrop-saturate-[150%]',
  ],
} as const;

export const buttonChrome = {
  ghost: ['border', ...border.floatingChrome],
  secondary: ['border', ...border.elevatedGlass],
  muted: ['border', ...border.control],
  settingsIdle: [
    'border',
    ...border.control,
    'dark:border-[var(--color-border-divider)]',
    ...surface.mutedChip,
    'hover:border-[var(--color-border-default)]',
    'hover:bg-[var(--color-surface-hover-row)]',
    'dark:hover:border-[var(--color-border-divider)]',
    'dark:hover:bg-[var(--color-surface-hover-row)]',
  ],
} as const;

export const checkboxControl = {
  field: ['peer', 'sr-only'],
  box: [
    'pointer-events-none',
    'absolute',
    'inset-0',
    'flex',
    'items-center',
    'justify-center',
    'rounded',
    'border',
    'transition-colors',
    ...border.control,
    ...surface.insetWell,
    'peer-focus-visible:outline-none',
    'peer-focus-visible:ring-2',
    'peer-focus-visible:ring-[var(--color-border-hover-accent)]',
    'peer-checked:border-[var(--color-brand-sky)]',
    'peer-checked:bg-[var(--color-brand-sky)]',
    'dark:peer-checked:border-[var(--color-brand-sky)]',
    'dark:peer-checked:bg-[var(--color-brand-sky)]',
  ],
  icon: [
    'pointer-events-none',
    'absolute',
    'inset-0',
    'm-auto',
    'h-3',
    'w-3',
    'text-white',
    'opacity-0',
    'transition-opacity',
    'peer-checked:opacity-100',
  ],
  shell: ['relative', 'inline-flex', 'h-4', 'w-4', 'shrink-0'],
} as const;

export const chrome = {
  xs: `px-[length:var(--spacing-button-chrome-inset-sm-x)] py-[length:var(--spacing-button-chrome-inset-sm-y)] ${radius.standard}`,
  sm: `px-[length:var(--spacing-button-chrome-inset-sm-x)] py-[length:var(--spacing-button-chrome-inset-sm-y)] ${radius.standard}`,
} as const;

export const chromeBar = {
  height: 'h-12',
  square: 'h-12 w-12',
  glyph: 'h-6 w-6',
  glyphWell: ['inline-flex', 'h-6', 'w-6', 'shrink-0', 'items-center', 'justify-center'],
} as const;

export const control = {
  height: {
    sm: 'h-9 md:h-8 lg:h-7',
    md: 'h-11 md:h-9 lg:h-8',
    lg: 'h-[52px] md:h-11 lg:h-10',
  },
  square: {
    sm: 'h-9 w-9 md:h-8 md:w-8 lg:h-7 lg:w-7',
    md: 'h-11 w-11 md:h-9 md:w-9 lg:h-8 lg:w-8',
    lg: 'h-[52px] w-[52px] md:h-11 md:w-11 lg:h-10 lg:w-10',
  },
  glyph: {
    sm: 'h-4 w-4 lg:h-3.5 lg:w-3.5',
    md: 'h-5 w-5 md:h-[18px] md:w-[18px] lg:h-4 lg:w-4',
    lg: 'h-6 w-6 md:h-[22px] md:w-[22px] lg:h-5 lg:w-5',
  },
  paddingX: {
    sm: 'px-3 md:px-2.5 lg:px-2.5',
    md: 'px-4 md:px-3.5 lg:px-3',
    lg: 'px-5 md:px-[18px] lg:px-4',
  },
  label: {
    sm: font.captionStrong,
    md: font.bodyStrong,
    lg: font.bodyStrong,
  },
} as const;

export const floatingChromeSearch = {
  height: 'h-[52px] md:h-12 lg:h-12',
  glyph: chromeBar.glyph,
  paddingX: 'px-4 md:px-3.5',
  label: control.label.md,
} as const;

export const controlIconWell = {
  sm: [
    'inline-flex',
    'shrink-0',
    'items-center',
    'justify-center',
    control.glyph.sm,
    '[&_svg]:block',
    '[&_svg]:h-full',
    '[&_svg]:w-full',
  ],
  md: [
    'inline-flex',
    'shrink-0',
    'items-center',
    'justify-center',
    control.glyph.md,
    '[&_svg]:block',
    '[&_svg]:h-full',
    '[&_svg]:w-full',
  ],
  lg: [
    'inline-flex',
    'shrink-0',
    'items-center',
    'justify-center',
    control.glyph.lg,
    '[&_svg]:block',
    '[&_svg]:h-full',
    '[&_svg]:w-full',
  ],
} as const;

export const settingsSecurityLayout = {
  section: ['space-y-4', 'border-t', 'pt-5', ...border.divider],
  list: ['flex', 'flex-col', 'gap-3'],
  passkeyRow: [
    'flex',
    'flex-col',
    'gap-3',
    'md:flex-row',
    'md:items-center',
    'md:justify-between',
    'lg:gap-4',
  ],
  passkeyMeta: ['min-w-0', 'flex-1', 'space-y-1'],
  passkeyRemoveWrap: ['inline-flex', 'shrink-0', 'self-end', 'md:self-center'],
  addTrigger: ['w-full', 'md:w-auto', 'lg:w-auto'],
  modalActions: ['flex', 'flex-col', 'gap-3', 'md:flex-row', 'lg:gap-4'],
  modalAction: ['w-full', 'md:flex-1'],
} as const;

export const appLayout = {
  contentShell: ['mx-auto', 'w-full', 'max-w-[var(--spacing-content-max)]'],
  contentGutter: ['px-4', 'md:px-6', 'lg:px-8'],
  contentShellWithGutter: [
    'mx-auto',
    'w-full',
    'max-w-[var(--spacing-content-max)]',
    'px-4',
    'md:px-6',
    'lg:px-8',
  ],
  mainSafeArea: ['pl-[env(safe-area-inset-left)]', 'pr-[env(safe-area-inset-right)]'],
} as const;

export const authLayout = {
  shell: [
    'relative',
    'flex',
    'w-full',
    'max-w-md',
    'flex-col',
    'items-center',
    'justify-center',
    'px-4',
    'py-8',
    'md:px-6',
    'md:py-10',
    'lg:max-w-lg',
    'lg:py-12',
  ],
  brandAside: [
    'hidden',
    'lg:flex',
    'pointer-events-none',
    'fixed',
    'right-0',
    'top-0',
    'bottom-0',
    'z-0',
    'w-1/2',
    'items-end',
    'justify-end',
  ],
  brandAsideImage: ['h-full', 'w-full', 'object-contain', 'object-right-bottom'],
  card: ['relative', 'z-10', 'w-full'],
  stackedActions: ['flex', 'flex-col', 'items-stretch', 'gap-3', 'md:gap-3', 'lg:items-center'],
  primaryAction: ['w-full', 'md:w-full', 'lg:w-auto', 'lg:min-w-[220px]'],
  secondaryAction: ['w-full', 'md:w-full', 'lg:w-auto'],
  footerLink: ['text-center', font.body, text.body],
} as const;

export const semanticTextRecipes = text;
export const semanticPlaceholderTextRecipes = placeholder;
