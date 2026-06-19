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
  strong: ['border-[var(--color-border-strong)]', 'dark:border-[var(--color-border-strong)]'],
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
  glassDropShadow: [
    'drop-shadow-[0_8px_32px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
  ],
  glassElevationShadow: [
    'shadow-[0_8px_32px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]',
  ],
  tabBarDropShadow: [
    'drop-shadow-[0_8px_28px_color-mix(in_srgb,var(--color-effect-glass-shadow)_20%,transparent)]',
    'md:drop-shadow-[0_10px_36px_color-mix(in_srgb,var(--color-effect-glass-shadow)_20%,transparent)]',
  ],
  bottomBarDropShadow: [
    'drop-shadow-[0_-6px_28px_color-mix(in_srgb,var(--color-effect-glass-shadow)_20%,transparent)]',
    'md:drop-shadow-[0_-8px_36px_color-mix(in_srgb,var(--color-effect-glass-shadow)_20%,transparent)]',
  ],
  accentHover: [
    'hover:drop-shadow-[0_10px_36px_color-mix(in_srgb,var(--color-effect-accent-hover)_32%,transparent)]',
  ],
  successGlow: ['drop-shadow-[0_0_12px_var(--color-effect-success-glow)]'],
  dangerGlow: ['drop-shadow-[0_0_12px_var(--color-effect-danger-glow)]'],
  warningGlow: ['drop-shadow-[0_0_12px_var(--color-effect-warning-glow)]'],
  accentOutlineGlow: [
    'ring-2 ring-inset ring-[color:color-mix(in_srgb,var(--color-effect-accent-outline-glow)_60%,transparent)]',
  ],
  accentOutlineGlowCta: ['drop-shadow-[0_0_12px_var(--color-effect-accent-outline-glow)]'],
  accentOutlineGlowHover: [
    'hover:ring-2 hover:ring-inset hover:ring-[color:color-mix(in_srgb,var(--color-effect-accent-outline-glow)_60%,transparent)]',
  ],
  glassBackdrop: ['backdrop-blur-md', 'backdrop-saturate-[150%]'],
} as const;

export const scroll = {
  visibleWhenOverflow: [
    '[scrollbar-gutter:stable]',
    '[scrollbar-width:thin]',
    '[scrollbar-color:color-mix(in_srgb,var(--color-border-strong)_72%,transparent)_transparent]',
    '[&::-webkit-scrollbar]:w-2',
    '[&::-webkit-scrollbar-track]:bg-transparent',
    '[&::-webkit-scrollbar-thumb]:rounded-full',
    '[&::-webkit-scrollbar-thumb]:bg-[color:color-mix(in_srgb,var(--color-border-strong)_72%,transparent)]',
    'dark:[&::-webkit-scrollbar-thumb]:bg-[color:color-mix(in_srgb,var(--color-border-glass)_60%,transparent)]',
  ],
} as const;

export const buttonCta = {
  gradient: ['bg-[var(--color-brand-sky)]'],
  glow: [...effect.accentOutlineGlowCta],
  hover: ['hover:-translate-y-0.5', 'disabled:hover:translate-y-0'],
} as const;

export const successCta = {
  gradient: ['bg-[var(--color-brand-emerald)]'],
  glow: [...effect.successGlow],
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
    alertBorder: ['border-[var(--color-status-info-border)]'],
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
    alertBorder: ['border-[var(--color-status-success-border)]'],
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
    alertBorder: ['border-[var(--color-status-warning-border)]'],
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
    alertBorder: ['border-[var(--color-status-danger-border)]'],
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
  shell: ['overflow-visible', 'py-2', '-my-2'],
  track: [
    'relative',
    'h-2.5',
    'w-full',
    'overflow-visible',
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
  fillWithin: ['bg-[var(--color-brand-sky)]', ...effect.successGlow],
  fillOver: [
    'bg-gradient-to-r',
    'from-[var(--color-brand-rose)]',
    'via-[var(--color-brand-rose)]',
    'to-[var(--color-text-danger)]',
    ...effect.dangerGlow,
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

export const insightsPanel = {
  stickyShell: [
    'sticky',
    'z-30',
    'top-[calc(env(safe-area-inset-top)+3.5rem+0.75rem)]',
    'md:top-[calc(env(safe-area-inset-top)+3.5rem+1.5rem)]',
    'lg:top-[calc(env(safe-area-inset-top)+3.5rem+2rem)]',
  ],
  glassShell: [
    'relative',
    'overflow-visible',
    'rounded-[length:var(--radius-standard)]',
    'border',
    ...border.glass,
    ...surface.glassPanel,
    ...effect.glassElevationShadow,
    ...effect.glassBackdrop,
    'transition-colors',
    'duration-200',
  ],
  glassInnerRing: [
    'absolute',
    'inset-[1px]',
    radius.standard,
    'ring-1',
    'ring-white/45',
    'dark:ring-white/12',
  ],
  glassInnerGradient: [
    'absolute',
    'inset-0',
    radius.standard,
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
  labelDivider: [
    'border-[var(--color-border-strong)]',
    'dark:border-[var(--color-border-divider)]',
  ],
  summarySectionPadding: ['pl-1.5', 'pr-3', 'py-1.5', 'md:pl-2', 'md:pr-4', 'md:py-2'],
  summaryToggleGrid: [
    'grid',
    'w-full',
    'grid-cols-[1rem_minmax(0,1fr)]',
    'items-stretch',
    'gap-x-1.5',
  ],
  summaryChevronColumn: ['flex', 'w-4', 'self-stretch', 'items-center', 'justify-start'],
  summaryChevron: [
    'h-4',
    'w-4',
    'shrink-0',
    'transition-transform',
    'duration-200',
    'text-slate-500',
    'dark:text-slate-500',
  ],
  summaryToggleShell: ['relative'],
  summaryToggleOverlay: ['absolute', 'inset-0', 'z-0', 'cursor-pointer'],
  summaryToggleContent: ['relative', 'z-10', 'pointer-events-none'],
} as const;

export const alert = {
  shell: [
    `relative ${radius.standard} border dark:border-0 px-4 py-3`,
    'transition-colors duration-300',
  ],
  tone: {
    solid: [...effect.glassBackdrop].join(' '),
    subtle: [...effect.glassBackdrop].join(' '),
  },
} as const;

export const dashboardCategoryCard = {
  shell: [
    `${radius.standard} border transition-all duration-300 text-left`,
    ...border.subtle,
    ...surface.card,
  ],
  shellActive: [
    `${radius.standard} border transition-all duration-300`,
    ...surface.card,
    '!border-[var(--color-border-hover-accent)]',
    'dark:!border-[var(--color-border-hover-accent)]',
  ],
  shellInteractive: [
    `${radius.standard} border transition-all duration-300`,
    ...border.subtle,
    ...surface.card,
    'hover:!border-[var(--color-border-hover-accent)]',
    'dark:hover:!border-[var(--color-border-hover-accent)]',
  ],
  chartHoverBorder: [
    'transition-all duration-300',
    'hover:!border-[var(--color-border-hover-accent)]',
    'dark:hover:!border-[var(--color-border-hover-accent)]',
  ],
  metricRow: ['flex min-w-0 items-center justify-between gap-x-2 gap-y-1'],
  metricCluster: ['flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5'],
  insetRing: [
    'hero-stat-card__inset-ring',
    'pointer-events-none',
    'absolute',
    'inset-0',
    'z-[1]',
    'rounded-[length:inherit]',
    'opacity-0',
    'transition-opacity',
    'duration-200',
    'group-hover:opacity-100',
  ],
  insetRingActive: 'opacity-100',
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
  backdrop: [...effect.glassBackdrop],
  shell: [
    'border',
    ...surface.floatingChromePanel,
    ...border.floatingChrome,
    ...effect.glassDropShadow,
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

export const chartFloatingGlass = {
  backdrop: [...floatingChromeGlass.backdrop],
  shell: [
    'border',
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_58%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
    ...border.glass,
    ...effect.glassDropShadow,
  ],
} as const;

export const chartTooltip = {
  shell: [
    radius.standard,
    'px-3',
    'py-2',
    'isolate',
    ...chartFloatingGlass.backdrop,
    ...chartFloatingGlass.shell,
  ],
  fade: ['transition-opacity', 'ease-out', 'duration-200'],
  label: [font.caption, text.muted],
  row: [font.captionStrong, text.body],
} as const;

export const budgetRealityChart = {
  curveGlow: {
    blurStdDeviation: 4,
    strokeWidth: 8,
    opacity: 0.55,
  },
  animationDurationMs: 800,
} as const;

export const sankeyChartSizing = {
  baseMinHeightPx: 280,
  baseMaxHeightPx: 560,
  defaultScale: 1.5,
} as const;

const sankeyDefaultMinHeightClass =
  `min-h-[calc(${sankeyChartSizing.baseMinHeightPx}px*${sankeyChartSizing.defaultScale})]` as const;

export const sankeyChart = {
  shell: [
    'flex',
    'min-h-0',
    'min-w-0',
    'h-full',
    'w-full',
    'flex-1',
    'flex-col',
    'overflow-visible',
  ],
  viewport: [
    'h-full',
    sankeyDefaultMinHeightClass,
    'min-w-0',
    'w-full',
    'flex-1',
    'overflow-visible',
    '[&_.recharts-wrapper]:overflow-visible',
    '[&_.recharts-surface]:overflow-visible',
  ],
  emptyState: [sankeyDefaultMinHeightClass],
  nodeLabel: [font.badge],
  nodeMeta: [font.cardTitle, text.primary, 'fill-current'],
  nodePercent: [font.caption, text.muted, 'fill-current'],
  nodeGlow: {
    filterId: 'sankey-node-glow-blur',
    opacity: 0.55,
    blurStdDeviation: 5,
    strokeOpacity: 0.38,
  },
  margin: { top: 8, right: 24, bottom: 28, left: 24 },
  animationDurationMs: 800,
} as const;

export const netWorthLineChart = {
  curveGlow: {
    blurStdDeviation: 4,
    strokeWidth: 6,
    opacity: 0.42,
  },
  lineStrokeWidth: 2,
} as const;

export const dashboardStatsCarousel = {
  shell: ['flex', 'min-w-0', 'flex-col', 'gap-4'],
  header: ['flex', 'items-center', 'justify-between', 'gap-3'],
  label: [font.captionStrong, text.muted],
  viewport: ['flex', sankeyDefaultMinHeightClass, 'w-full', 'flex-col', 'overflow-hidden'],
  panelStack: [
    'grid',
    sankeyDefaultMinHeightClass,
    'w-full',
    'min-w-0',
    'overflow-visible',
    '[&>*]:col-start-1',
    '[&>*]:row-start-1',
    '[&>*]:min-h-0',
    '[&>*]:w-full',
  ],
  panel: [
    'flex',
    sankeyDefaultMinHeightClass,
    'min-h-0',
    'min-w-0',
    'flex-col',
    'overflow-visible',
  ],
  panelActive: ['relative', 'z-10'],
  panelHidden: ['invisible', 'pointer-events-none', 'z-0'],
} as const;

export const transactionsTable = {
  chromeBar: [...surface.glassPanel, ...effect.glassBackdrop],
  listViewport: [
    'relative',
    'overflow-y-auto',
    'overscroll-contain',
    ...scroll.visibleWhenOverflow,
  ],
  footer: [
    'border-t px-4 py-4 transition-colors duration-500',
    ...border.subtle,
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_12%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
    ...effect.glassBackdrop,
  ],
} as const;

export const buttonChrome = {
  ghost: ['border', ...border.floatingChrome],
  secondary: ['border', ...border.control, 'dark:border-[var(--color-border-divider)]'],
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
  sectionHeader: [
    'flex',
    'flex-col',
    'gap-4',
    'md:flex-row',
    'md:items-start',
    'md:justify-between',
  ],
  sectionIntro: ['min-w-0', 'space-y-1'],
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
  addTrigger: ['w-full', 'shrink-0', 'md:w-auto'],
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
  brandBackdrop: [
    'pointer-events-none',
    'fixed',
    'z-0',
    'flex',
    'inset-x-0',
    'top-14',
    'bottom-0',
    'items-end',
    'justify-center',
  ],
  brandBackdropImage: ['h-full', 'w-auto', 'max-w-full', 'object-contain', 'object-bottom'],
  card: ['relative', 'z-10', 'w-full'],
  stackedActions: ['flex', 'flex-col', 'items-stretch', 'gap-3', 'md:gap-3', 'lg:items-center'],
  primaryAction: ['w-full', 'md:w-full', 'lg:w-auto', 'lg:min-w-[220px]'],
  secondaryAction: ['w-full', 'md:w-full', 'lg:w-auto'],
  footerLink: ['text-center', font.body, text.body],
} as const;

export const semanticTextRecipes = text;
export const semanticPlaceholderTextRecipes = placeholder;
