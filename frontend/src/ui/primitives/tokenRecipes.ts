import { semanticTextRecipes } from '@/ui/tokens/textRecipes';

const semanticSurfaces = {
  card: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-card)_70%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-card-dark)_55%,transparent)]',
  ],
  glassPanel: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_18%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel-dark)_55%,transparent)]',
  ],
  solidPanel: [
    'bg-[var(--color-surface-solid-panel)]',
    'dark:bg-[var(--color-surface-solid-panel-dark)]',
  ],
  hoverRow: [
    'bg-[var(--color-surface-hover-row)]',
    'dark:bg-[var(--color-surface-hover-row-dark)]',
  ],
  mutedChip: [
    'bg-[var(--color-surface-muted-chip)]',
    'dark:bg-[var(--color-surface-muted-chip-dark)]',
  ],
  insetWell: [
    'bg-[var(--color-surface-inset-well)]',
    'dark:bg-[var(--color-surface-inset-well-dark)]',
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
  divider: [
    'border-[var(--color-border-divider)]',
    'dark:border-[var(--color-border-divider-dark)]',
  ],
  hoverAccent: [
    'border-[var(--color-border-hover-accent)]',
    'dark:border-[var(--color-border-hover-accent-dark)]',
  ],
  danger: ['border-[var(--color-border-danger)]', 'dark:border-[var(--color-border-danger-dark)]'],
} as const;

const semanticStatus = {
  success: {
    surface: [
      'bg-[var(--color-status-success-surface)]',
      'dark:bg-[var(--color-status-success-surface-dark)]',
    ],
    border: [
      'border-[var(--color-status-success-border)]',
      'dark:border-[var(--color-status-success-border-dark)]',
    ],
    text: [
      'text-[var(--color-status-success-text)]',
      'dark:text-[var(--color-status-success-text-dark)]',
    ],
  },
  info: {
    surface: [
      'bg-[var(--color-status-info-surface)]',
      'dark:bg-[var(--color-status-info-surface-dark)]',
    ],
    text: [
      'text-[var(--color-status-info-text)]',
      'dark:text-[var(--color-status-info-text-dark)]',
    ],
  },
  warning: {
    surface: [
      'bg-[var(--color-status-warning-surface)]',
      'dark:bg-[var(--color-status-warning-surface-dark)]',
    ],
    text: [
      'text-[var(--color-status-warning-text)]',
      'dark:text-[var(--color-status-warning-text-dark)]',
    ],
  },
  danger: {
    surface: [
      'bg-[color:color-mix(in_srgb,var(--color-status-danger-surface)_82%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-status-danger-surface-dark)_28%,transparent)]',
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
    'shadow-[0_40px_120px_-82px_var(--color-effect-glass-shadow)]',
    'dark:shadow-[0_42px_140px_-80px_var(--color-effect-glass-shadow-dark)]',
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

export const primitiveTypographyRecipes = {
  display: 'font-display text-[clamp(2.25rem,3vw,3rem)] font-bold leading-[1.1] tracking-normal',
  pageTitle: 'font-page-title text-[2rem] font-bold leading-[1.1] tracking-normal',
  pageTitleWordmark:
    'font-[family-name:var(--font-page-title-wordmark)] font-[weight:var(--font-weight-page-title-wordmark)] leading-[1.1] tracking-normal',
  sectionTitle: 'font-section-title text-[1.5rem] font-semibold leading-[1.25] tracking-normal',
  cardTitle: 'font-card-title text-[1.25rem] font-semibold leading-[1.25] tracking-normal',
  body: 'font-body text-[1rem] font-normal leading-[1.5] tracking-normal',
  bodyStrong: 'font-body-strong text-[1rem] font-semibold leading-[1.5] tracking-normal',
  caption: 'font-caption text-[0.875rem] font-normal leading-[1.5] tracking-normal',
  captionStrong: 'font-caption-strong text-[0.875rem] font-semibold leading-[1.5] tracking-normal',
  label: 'font-label text-[0.75rem] font-semibold uppercase leading-none tracking-[0.14em]',
  titleBarChromeExpanded:
    'font-[family-name:var(--font-title-bar-chrome-expanded)] text-[length:var(--text-title-bar-chrome-expanded)] font-[weight:var(--font-weight-title-bar-chrome-expanded)] uppercase leading-none tracking-[var(--tracking-title-bar-chrome-expanded)]',
  badge: 'font-badge text-[0.75rem] font-bold uppercase leading-none tracking-[0.14em]',
  chartDonutCenterTotal: 'font-display text-2xl font-bold tracking-tight',
  confirmationCode: 'font-mono font-bold',
} as const;

export const buttonChromeInset = {
  xs: 'px-[length:var(--spacing-button-chrome-inset-xs-x)] py-[length:var(--spacing-button-chrome-inset-xs-y)] rounded-[length:var(--radius-medium)]',
  sm: 'px-[length:var(--spacing-button-chrome-inset-sm-x)] py-[length:var(--spacing-button-chrome-inset-sm-y)] rounded-[length:var(--radius-medium)]',
} as const;

export const primitiveTokenRecipes = {
  button: {
    base: [
      'inline-flex items-center justify-center gap-2',
      'transition-all duration-200 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900',
      'disabled:cursor-not-allowed disabled:opacity-60',
    ],
    primary: [
      'bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500',
      semanticTextRecipes.inverse,
      'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
      'hover:-translate-y-0.5',
      'disabled:hover:translate-y-0',
    ],
    secondary: [
      ...semanticBorders.subtle,
      ...semanticSurfaces.card,
      semanticTextRecipes.muted,
      ...semanticEffects.glassShadow,
      'hover:border-[var(--color-border-hover-accent)] hover:text-slate-900',
      'hover:shadow-[0_14px_32px_-18px_var(--color-effect-accent-hover)]',
      'dark:text-slate-300',
      'dark:hover:border-[var(--color-border-hover-accent-dark)] dark:hover:text-white',
    ],
    ghost: [
      ...semanticBorders.glass,
      ...semanticSurfaces.glassPanel,
      semanticTextRecipes.primary,
      'hover:-translate-y-0.5',
      ...semanticEffects.glassShadow,
      'dark:text-slate-200',
    ],
    icon: [
      'border border-transparent',
      ...semanticSurfaces.mutedChip,
      semanticTextRecipes.muted,
      ...semanticEffects.glassShadow,
      'hover:-translate-y-[1px] hover:border-[var(--color-border-hover-accent)]',
      'hover:text-slate-900',
      'dark:text-slate-400',
      'dark:hover:border-[var(--color-border-hover-accent-dark)] dark:hover:text-white',
    ],
    tab: ['group relative', 'overflow-hidden', 'backdrop-blur-sm'],
    tabActive: [
      'group relative',
      'overflow-hidden',
      ...semanticBorders.glass,
      'bg-[linear-gradient(115deg,#38bdf8_0%,#22d3ee_46%,#a855f7_100%)]',
      'text-white',
      'shadow-[0_16px_42px_-18px_rgba(14,165,233,0.55)]',
      'backdrop-blur-sm',
      'before:absolute before:inset-0',
      'before:bg-[linear-gradient(140deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0)_60%)]',
      'before:opacity-80 before:pointer-events-none',
      'dark:border-[var(--color-border-glass-dark)]',
      'dark:shadow-[0_16px_38px_-18px_rgba(56,189,248,0.55)]',
    ],
    danger: [
      ...semanticBorders.danger,
      ...semanticStatus.danger.surface,
      semanticTextRecipes.danger,
      'hover:bg-[var(--color-status-danger-strong-surface)]',
      'dark:hover:bg-[color:color-mix(in_srgb,var(--color-status-danger-strong-surface-dark)_46%,transparent)]',
    ],
    success: [
      'bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400',
      semanticTextRecipes.inverse,
      'shadow-[0_20px_55px_-28px_rgba(16,185,129,0.65)]',
      'hover:-translate-y-[3px]',
      'disabled:hover:translate-y-0',
    ],
    connect: [
      'bg-gradient-to-r from-[#0ea5e9] via-[#38bdf8] to-[#a78bfa]',
      semanticTextRecipes.inverse,
      'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.78)]',
      'hover:-translate-y-[1px]',
      'hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.85)]',
      'active:scale-[0.98]',
      'dark:shadow-[0_22px_60px_-32px_rgba(56,189,248,0.65)]',
    ],
  },
  connectButton: {
    base: [
      `inline-flex items-center gap-2 rounded-full px-5 py-2 ${primitiveTypographyRecipes.captionStrong} whitespace-nowrap`,
      'transition-all duration-200',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      'dark:focus-visible:ring-offset-slate-900',
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none',
    ],
    secondary: [
      ...semanticBorders.subtle,
      ...semanticSurfaces.card,
      semanticTextRecipes.muted,
      ...semanticEffects.glassShadow,
      'hover:border-[var(--color-border-hover-accent)] hover:text-[var(--color-text-primary)]',
      'dark:text-[#cbd5e1]',
      'dark:hover:border-[var(--color-border-hover-accent-dark)] dark:hover:text-white',
    ],
  },
  badge: {
    base: [
      'inline-flex items-center justify-center',
      primitiveTypographyRecipes.badge,
      'transition-all duration-200 ease-out',
    ],
    default: [
      ...semanticSurfaces.mutedChip,
      semanticTextRecipes.muted,
      ...semanticEffects.glassShadow,
      'dark:text-slate-200',
    ],
    primary: [...semanticStatus.info.surface, ...semanticStatus.info.text],
    feature: [...semanticSurfaces.insetWell, 'ring-1 ring-inset'],
  },
  menuDropdown: {
    content: [
      'absolute right-0 z-20 mt-3 w-48',
      'overflow-hidden rounded-2xl',
      ...semanticBorders.glass,
      ...semanticSurfaces.solidPanel,
      'p-2',
      ...semanticEffects.glassShadow,
      'backdrop-blur-md',
      'dark:shadow-[0_28px_70px_-36px_var(--color-effect-glass-shadow-dark)]',
    ],
    item: [
      'flex w-full items-center gap-2',
      'rounded-xl px-3 py-2',
      `text-left ${semanticTextRecipes.muted}`,
      'transition-all duration-200 ease-out',
      ...semanticSurfaces.hoverRow,
      'dark:text-slate-300',
      'dark:hover:bg-[var(--color-surface-hover-row-dark)]',
    ],
  },
  glassCard: {
    base: [
      'relative overflow-hidden',
      'border',
      ...semanticEffects.glassShadow,
      'backdrop-blur-2xl backdrop-saturate-[150%]',
      'transition-colors duration-500',
      'dark:shadow-[0_42px_140px_-80px_var(--color-effect-glass-shadow-dark)]',
    ],
    default: [...semanticBorders.glass, ...semanticSurfaces.glassPanel],
    auth: [
      ...semanticBorders.glass,
      ...semanticSurfaces.glassPanel,
      'shadow-[0_38px_120px_-60px_var(--color-effect-glass-shadow)]',
      'backdrop-blur-[26px]',
      'backdrop-saturate-[140%]',
      'dark:shadow-[0_40px_120px_-58px_var(--color-effect-glass-shadow-dark)]',
    ],
    accent: [
      ...semanticBorders.glass,
      'bg-[color:color-mix(in_srgb,var(--color-surface-solid-panel)_85%,transparent)]',
      'dark:bg-[color:color-mix(in_srgb,var(--color-surface-solid-panel-dark)_75%,transparent)]',
      'backdrop-blur-sm',
    ],
    rounded: {
      default: 'rounded-[2.25rem]',
      lg: 'rounded-2xl',
      xl: 'rounded-3xl',
    },
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
  },
  gradientShell: {
    base: ['relative', 'min-h-screen'],
    centered: ['overflow-hidden'],
    backdrop: ['pointer-events-none'],
    aura: [
      'bg-[radial-gradient(128%_96%_at_18%_-20%,#c4e2ff_0%,#dbeafe_30%,#e5f2ff_56%,#ffffff_96%)]',
      'transition-colors duration-500 ease-out',
      'dark:bg-[radial-gradient(100%_85%_at_20%_-10%,#0f172a_0%,#0b162c_55%,#05070d_100%)]',
    ],
    overlay: [
      'bg-[radial-gradient(136%_108%_at_20%_-18%,rgba(14,165,233,0.42)_0%,#e1f2ff_36%,#ffffff_100%)]',
      'transition-colors duration-700',
      'dark:bg-[radial-gradient(92%_80%_at_20%_-6%,#0f172a_0%,#0a1224_50%,#05070d_100%)]',
    ],
    violetAura: [
      'bg-[radial-gradient(86%_64%_at_86%_18%,rgba(167,139,250,0.28)_0%,rgba(59,130,246,0.14)_55%,transparent_78%)]',
      'transition-opacity duration-700',
      'dark:bg-transparent',
    ],
    cyanAura: [
      'bg-[radial-gradient(92%_68%_at_12%_24%,rgba(56,189,248,0.28)_0%,rgba(129,140,248,0.12)_52%,transparent_80%)]',
      'transition-opacity duration-700',
      'dark:bg-transparent',
    ],
    vignette:
      'bg-gradient-to-b from-white/70 via-white/38 to-transparent transition-colors duration-700 ease-out dark:from-slate-900/68 dark:via-slate-900/42 dark:to-transparent',
    vignetteOverlay:
      'bg-[radial-gradient(120%_120%_at_50%_55%,transparent_60%,rgba(15,23,42,0.1)_100%)] transition-opacity duration-700 ease-out dark:bg-[radial-gradient(120%_120%_at_50%_54%,transparent_58%,rgba(2,6,23,0.38)_100%)]',
    centerGlow:
      'rounded-full blur-3xl h-[72rem] w-[72rem] opacity-[0.28] animate-[rotateAura_95s_linear_infinite] bg-[conic-gradient(from_90deg,#93c5fd,#34d399,#fbbf24,#a78bfa,#fb7185,#93c5fd)] transition-opacity duration-500 dark:opacity-[0.4] dark:bg-[conic-gradient(from_110deg,#38bdf8,#34d399,#a78bfa,#fbbf24,#f87171,#38bdf8)]',
    contentCentered: 'flex min-h-screen items-center justify-center px-4 py-12 sm:px-6',
  },
  appTitleBar: {
    base: ['sticky top-0 z-50 border-b backdrop-blur-sm transition-all duration-200 ease-out'],
    shell: [
      ...semanticSurfaces.card,
      ...semanticBorders.divider,
      'dark:bg-[var(--color-surface-solid-panel-dark)]',
    ],
    height: {
      scrolled: 'h-14',
      default: 'h-16',
    },
    logo: {
      container: ['flex', 'items-center', 'gap-2', semanticTextRecipes.primary],
      scrolled: 'text-xl',
      default: 'text-3xl',
      wordmark: primitiveTypographyRecipes.pageTitleWordmark,
      fontFamily: { fontFamily: "'Cal Sans', system-ui, sans-serif" },
    },
    tabIdle: [
      ...semanticBorders.subtle,
      ...semanticSurfaces.card,
      semanticTextRecipes.muted,
      'hover:text-slate-900 dark:hover:text-white',
      'hover:border-[var(--color-border-hover-accent)] dark:hover:border-[var(--color-border-hover-accent-dark)]',
      'hover:shadow-[0_14px_32px_-18px_var(--color-effect-accent-hover)]',
    ].join(' '),
    tabHalo:
      'after:absolute after:inset-[-28%] after:rounded-[999px] after:bg-[radial-gradient(circle_at_35%_30%,rgba(14,165,233,0.16),transparent_62%)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-90 dark:after:bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.22),transparent_62%)]',
    divider: 'w-px h-6 bg-[var(--color-border-divider)] dark:bg-[var(--color-border-divider-dark)]',
    themeToggle:
      'rounded-lg !bg-[color:color-mix(in_srgb,var(--color-brand-amber)_80%,transparent)] dark:!bg-[color:color-mix(in_srgb,var(--color-brand-violet)_80%,transparent)] hover:!bg-[color:color-mix(in_srgb,var(--color-brand-amber)_90%,transparent)] dark:hover:!bg-[color:color-mix(in_srgb,var(--color-brand-violet)_90%,transparent)] !border !border-[color:color-mix(in_srgb,var(--color-brand-amber-dark)_30%,transparent)] dark:!border-[color:color-mix(in_srgb,var(--color-brand-violet-dark)_30%,transparent)] !text-white backdrop-blur-sm transition-colors',
    settingsIdle:
      'border border-[var(--color-border-divider)] dark:border-[var(--color-border-divider-dark)] bg-[var(--color-surface-muted-chip)] dark:bg-[var(--color-surface-muted-chip-dark)] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row-dark)]',
  },
  pageLayout: {
    shell: [
      'relative',
      'overflow-hidden',
      'rounded-[2.25rem]',
      'border',
      ...semanticBorders.glass,
      ...semanticSurfaces.glassPanel,
      'p-8',
      ...semanticEffects.glassShadow,
      'backdrop-blur-[28px]',
      'backdrop-saturate-[150%]',
      'transition-colors',
      'duration-500',
      'ease-out',
      'dark:shadow-[0_36px_120px_-62px_var(--color-effect-glass-shadow-dark)]',
      'sm:p-12',
    ],
    innerRing: [
      'absolute',
      'inset-[1px]',
      'rounded-[2.2rem]',
      'ring-1',
      'ring-white/45',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]',
      'dark:ring-white/12',
      'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]',
    ],
    innerGradient: [
      'absolute',
      'inset-0',
      'rounded-[2.2rem]',
      'bg-gradient-to-b',
      'from-white/72',
      'via-white/28',
      'to-transparent',
      'transition-colors',
      'duration-500',
      'dark:from-slate-900/68',
      'dark:via-slate-900/34',
      'dark:to-transparent',
    ],
    badge: `${primitiveTypographyRecipes.badge} inline-flex items-center justify-center rounded-full ${semanticSurfaces.mutedChip.join(' ')} px-3 py-1 ${semanticTextRecipes.label} ${semanticEffects.glassShadow[0]} dark:text-slate-200`,
    title: `${primitiveTypographyRecipes.pageTitle} ${semanticTextRecipes.primary} transition-colors duration-300 ease-out`,
    subtitle: `${primitiveTypographyRecipes.body} ${semanticTextRecipes.body} transition-colors duration-300 ease-out`,
    error: [
      'rounded-2xl',
      ...semanticBorders.danger,
      ...semanticStatus.danger.surface,
      'px-5 py-3',
      'shadow-sm',
    ].join(' '),
    errorText: `${primitiveTypographyRecipes.captionStrong} ${semanticTextRecipes.danger}`,
  },
  emptyState: {
    iconWrapper: [
      'flex',
      'h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20',
      'items-center',
      'justify-center',
      'rounded-full',
      ...semanticSurfaces.card,
      semanticTextRecipes.muted,
      'transition-all duration-300 ease-out',
      'hover:scale-110 hover:-translate-y-1',
      'hover:shadow-[0_0_30px_var(--color-effect-accent-hover),0_0_60px_var(--color-effect-accent-hover)]',
      'dark:text-slate-300',
      'dark:hover:shadow-[0_0_30px_var(--color-effect-accent-hover-dark),0_0_60px_var(--color-effect-accent-hover-dark)]',
      'cursor-pointer',
    ],
    title: `${primitiveTypographyRecipes.cardTitle} ${semanticTextRecipes.primary} transition-colors duration-500`,
    description: `${primitiveTypographyRecipes.body} max-w-sm ${semanticTextRecipes.body} transition-colors duration-500`,
  },
  pill: {
    base: `inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 ${primitiveTypographyRecipes.badge}`,
    dot: 'h-2 w-2 rounded-full shadow-[0_0_0_1px_var(--color-border-glass)] dark:shadow-[0_0_0_1px_var(--color-effect-glass-shadow-dark)]',
    fadeLeft:
      'pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card-dark)]',
    fadeRight:
      'pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card-dark)]',
  },
} as const;
