export type ThemeMode = 'light' | 'dark';
export type HeroAccent = 'slate' | 'emerald' | 'sky' | 'violet' | 'amber' | 'rose';
export type SemanticTone = 'success' | 'info' | 'warning' | 'danger';

export type ThemeColors = {
  chart: {
    primary: string[];
    grid: string;
    axis: string;
    tooltipBg: string;
    tooltipBorder: string;
    tooltipText: string;
    dotFill: string;
  };
  semantic: {
    cash: string;
    investments: string;
    credit: string;
    loan: string;
    netWorth: string;
  };
};

export type CategoryTheme = {
  key: string;
  tag: string;
  dot: string;
  ring: string;
  ringHex: string;
};

export type HeroAccentTheme = {
  border: string;
  borderDark: string;
  hoverBorder: string;
  hoverBorderDark: string;
  ringHex: string;
  gradFrom: string;
  gradVia: string;
  icon: string;
  defaultPill: string;
  defaultDot: string;
  glowRgb: string;
};

const brandColors = {
  sky: '#0ea5e9',
  skyDark: '#38bdf8',
  emerald: '#10b981',
  emeraldDark: '#34d399',
  amber: '#f59e0b',
  amberDark: '#fbbf24',
  rose: '#ef4444',
  roseDark: '#f87171',
  violet: '#8b5cf6',
  violetDark: '#a78bfa',
  cyan: '#06b6d4',
  cyanDark: '#22d3ee',
} as const;

const chartLight = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#059669'];
const chartDark = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#10b981'];
const brandFont = "'Cal Sans', system-ui, sans-serif";
const sansFont = "'Mr Eaves XL Mod', system-ui, sans-serif";
const glassShadowLight = 'shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)]';
const glassShadowDark = 'dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]';
const glassInsetLight =
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]';
const glassInsetDark =
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]';
const panelShadow = 'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]';
const panelShadowDark = 'dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]';

const gradientPrimitives = {
  appShellLight:
    'bg-[radial-gradient(128%_96%_at_18%_-20%,#c4e2ff_0%,#dbeafe_30%,#e5f2ff_56%,#ffffff_96%)]',
  appShellDark:
    'dark:bg-[radial-gradient(100%_85%_at_20%_-10%,#0f172a_0%,#0b162c_55%,#05070d_100%)]',
  auraBlue:
    'bg-[radial-gradient(136%_108%_at_20%_-18%,rgba(14,165,233,0.42)_0%,#e1f2ff_36%,#ffffff_100%)]',
  auraBlueDark:
    'dark:bg-[radial-gradient(92%_80%_at_20%_-6%,#0f172a_0%,#0a1224_50%,#05070d_100%)]',
  auraViolet:
    'bg-[radial-gradient(86%_64%_at_86%_18%,rgba(167,139,250,0.28)_0%,rgba(59,130,246,0.14)_55%,transparent_78%)]',
  auraCyan:
    'bg-[radial-gradient(92%_68%_at_12%_24%,rgba(56,189,248,0.28)_0%,rgba(129,140,248,0.12)_52%,transparent_80%)]',
  activeTab:
    'bg-[linear-gradient(115deg,#38bdf8_0%,#22d3ee_46%,#a855f7_100%)] before:bg-[linear-gradient(140deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0)_60%)] dark:before:bg-[linear-gradient(140deg,rgba(255,255,255,0.32)_0%,rgba(255,255,255,0)_60%)]',
  emptyStateIcon:
    'bg-gradient-to-br from-slate-400/10 via-slate-300/15 to-slate-500/10 dark:from-slate-500/10 dark:via-slate-600/15 dark:to-slate-700/10',
  pageTitleBar: 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700',
} as const;

const layoutEffects = {
  shell: {
    vignette:
      'bg-gradient-to-b from-white/70 via-white/38 to-transparent transition-colors duration-700 ease-out dark:from-slate-900/68 dark:via-slate-900/42 dark:to-transparent',
    vignetteOverlay:
      'bg-[radial-gradient(120%_120%_at_50%_55%,transparent_60%,rgba(15,23,42,0.1)_100%)] transition-opacity duration-700 ease-out dark:bg-[radial-gradient(120%_120%_at_50%_54%,transparent_58%,rgba(2,6,23,0.38)_100%)]',
    centerGlow:
      'rounded-full blur-3xl h-[72rem] w-[72rem] opacity-[0.28] animate-[rotateAura_95s_linear_infinite] bg-[conic-gradient(from_90deg,#93c5fd,#34d399,#fbbf24,#a78bfa,#fb7185,#93c5fd)] transition-opacity duration-500 dark:opacity-[0.4] dark:bg-[conic-gradient(from_110deg,#38bdf8,#34d399,#a78bfa,#fbbf24,#f87171,#38bdf8)]',
  },
  titleBar: {
    tabHalo:
      'after:absolute after:inset-[-28%] after:rounded-[999px] after:bg-[radial-gradient(circle_at_35%_30%,rgba(14,165,233,0.16),transparent_62%)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-90 dark:after:bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.22),transparent_62%)]',
    themeToggle:
      'rounded-lg !bg-amber-500/80 dark:!bg-purple-600/80 hover:!bg-amber-600/80 dark:hover:!bg-purple-700/80 !border !border-amber-400/30 dark:!border-purple-500/30 !text-white backdrop-blur-sm transition-colors',
  },
  pillOverflow: {
    fadeLeft:
      'pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80',
    fadeRight:
      'pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80',
  },
  emptyState: {
    iconHoverGlowLight: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.4),0_0_60px_rgba(59,130,246,0.2)]',
    iconHoverGlowDark:
      'dark:hover:shadow-[0_0_30px_rgba(96,165,250,0.5),0_0_60px_rgba(96,165,250,0.25)]',
  },
} as const;

const semanticLight = {
  cash: '#10b981',
  investments: '#06b6d4',
  credit: '#fb7185',
  loan: '#f59e0b',
  netWorth: '#8b5cf6',
};

const semanticDark = {
  cash: '#34d399',
  investments: '#22d3ee',
  credit: '#fb7185',
  loan: '#fbbf24',
  netWorth: '#a78bfa',
};

const chartThemeLight = {
  primary: chartLight,
  grid: '#e2e8f0',
  axis: '#64748b',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
  tooltipText: '#0f172a',
  dotFill: '#ffffff',
} as const;

const chartThemeDark = {
  primary: chartDark,
  grid: '#334155',
  axis: '#94a3b8',
  tooltipBg: '#1e293b',
  tooltipBorder: '#475569',
  tooltipText: '#f8fafc',
  dotFill: '#0b1220',
} as const;

const pillTypography = 'text-[0.6rem] font-bold uppercase tracking-[0.18em]';

const categoryThemes: CategoryTheme[] = [
  {
    key: 'sky',
    tag: `${pillTypography} text-slate-800 dark:text-sky-100 border border-sky-200/70 dark:border-sky-400/30 shadow-[0_18px_52px_-34px_rgba(14,165,233,0.55)] bg-[linear-gradient(130deg,_rgba(14,165,233,0.24),_rgba(14,165,233,0.08))] dark:bg-[linear-gradient(130deg,_rgba(56,189,248,0.18),_rgba(56,189,248,0.06))]`,
    dot: 'bg-sky-500/90 dark:bg-sky-300/85',
    ring: 'ring-sky-400',
    ringHex: '#38bdf8',
  },
  {
    key: 'emerald',
    tag: `${pillTypography} text-slate-800 dark:text-emerald-100 border border-emerald-200/70 dark:border-emerald-400/30 shadow-[0_18px_52px_-34px_rgba(16,185,129,0.55)] bg-[linear-gradient(130deg,_rgba(16,185,129,0.26),_rgba(16,185,129,0.08))] dark:bg-[linear-gradient(130deg,_rgba(34,197,94,0.2),_rgba(34,197,94,0.07))]`,
    dot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
    ring: 'ring-emerald-400',
    ringHex: '#34d399',
  },
  {
    key: 'cyan',
    tag: `${pillTypography} text-slate-800 dark:text-cyan-100 border border-cyan-200/70 dark:border-cyan-400/30 shadow-[0_18px_52px_-34px_rgba(6,182,212,0.52)] bg-[linear-gradient(130deg,_rgba(6,182,212,0.25),_rgba(6,182,212,0.08))] dark:bg-[linear-gradient(130deg,_rgba(34,211,238,0.18),_rgba(34,211,238,0.06))]`,
    dot: 'bg-cyan-500/90 dark:bg-cyan-300/80',
    ring: 'ring-cyan-400',
    ringHex: '#22d3ee',
  },
  {
    key: 'violet',
    tag: `${pillTypography} text-slate-800 dark:text-violet-100 border border-violet-200/70 dark:border-violet-400/30 shadow-[0_18px_52px_-34px_rgba(139,92,246,0.54)] bg-[linear-gradient(130deg,_rgba(139,92,246,0.24),_rgba(139,92,246,0.08))] dark:bg-[linear-gradient(130deg,_rgba(167,139,250,0.2),_rgba(167,139,250,0.06))]`,
    dot: 'bg-violet-500/90 dark:bg-violet-300/80',
    ring: 'ring-violet-400',
    ringHex: '#a78bfa',
  },
  {
    key: 'amber',
    tag: `${pillTypography} text-slate-800 dark:text-amber-100 border border-amber-200/70 dark:border-amber-400/30 shadow-[0_18px_52px_-34px_rgba(245,158,11,0.5)] bg-[linear-gradient(130deg,_rgba(245,158,11,0.26),_rgba(245,158,11,0.1))] dark:bg-[linear-gradient(130deg,_rgba(251,191,36,0.24),_rgba(251,191,36,0.08))]`,
    dot: 'bg-amber-500/90 dark:bg-amber-300/85',
    ring: 'ring-amber-400',
    ringHex: '#fbbf24',
  },
  {
    key: 'rose',
    tag: `${pillTypography} text-slate-800 dark:text-rose-100 border border-rose-200/70 dark:border-rose-400/30 shadow-[0_18px_52px_-34px_rgba(244,63,94,0.5)] bg-[linear-gradient(130deg,_rgba(244,63,94,0.26),_rgba(244,63,94,0.1))] dark:bg-[linear-gradient(130deg,_rgba(251,113,133,0.22),_rgba(251,113,133,0.07))]`,
    dot: 'bg-rose-500/90 dark:bg-rose-300/80',
    ring: 'ring-rose-400',
    ringHex: '#fb7185',
  },
  {
    key: 'indigo',
    tag: `${pillTypography} text-slate-800 dark:text-indigo-100 border border-indigo-200/70 dark:border-indigo-400/30 shadow-[0_18px_52px_-34px_rgba(99,102,241,0.5)] bg-[linear-gradient(130deg,_rgba(99,102,241,0.26),_rgba(99,102,241,0.08))] dark:bg-[linear-gradient(130deg,_rgba(129,140,248,0.2),_rgba(129,140,248,0.06))]`,
    dot: 'bg-indigo-500/90 dark:bg-indigo-300/80',
    ring: 'ring-indigo-400',
    ringHex: '#818cf8',
  },
  {
    key: 'fuchsia',
    tag: `${pillTypography} text-slate-800 dark:text-fuchsia-100 border border-fuchsia-200/70 dark:border-fuchsia-400/30 shadow-[0_18px_52px_-34px_rgba(232,121,249,0.5)] bg-[linear-gradient(130deg,_rgba(232,121,249,0.26),_rgba(232,121,249,0.1))] dark:bg-[linear-gradient(130deg,_rgba(217,70,239,0.2),_rgba(217,70,239,0.06))]`,
    dot: 'bg-fuchsia-500/90 dark:bg-fuchsia-300/80',
    ring: 'ring-fuchsia-400',
    ringHex: '#e879f9',
  },
  {
    key: 'teal',
    tag: `${pillTypography} text-slate-800 dark:text-teal-100 border border-teal-200/70 dark:border-teal-400/30 shadow-[0_18px_52px_-34px_rgba(20,184,166,0.5)] bg-[linear-gradient(130deg,_rgba(20,184,166,0.25),_rgba(20,184,166,0.09))] dark:bg-[linear-gradient(130deg,_rgba(45,212,191,0.2),_rgba(45,212,191,0.06))]`,
    dot: 'bg-teal-500/90 dark:bg-teal-300/80',
    ring: 'ring-teal-400',
    ringHex: '#2dd4bf',
  },
  {
    key: 'lime',
    tag: `${pillTypography} text-slate-800 dark:text-lime-100 border border-lime-200/70 dark:border-lime-400/30 shadow-[0_18px_52px_-34px_rgba(132,204,22,0.48)] bg-[linear-gradient(130deg,_rgba(132,204,22,0.26),_rgba(132,204,22,0.1))] dark:bg-[linear-gradient(130deg,_rgba(163,230,53,0.2),_rgba(163,230,53,0.06))]`,
    dot: 'bg-lime-500/90 dark:bg-lime-300/80',
    ring: 'ring-lime-400',
    ringHex: '#a3e635',
  },
];

const heroAccentThemes: Record<HeroAccent, HeroAccentTheme> = {
  slate: {
    border: 'border-slate-300',
    borderDark: 'dark:border-slate-600',
    hoverBorder: 'hover:border-slate-400',
    hoverBorderDark: 'dark:hover:border-slate-500',
    ringHex: '#64748b',
    gradFrom: '#64748b',
    gradVia: '#475569',
    icon: 'text-slate-500 dark:text-slate-300',
    defaultPill:
      'border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 bg-[linear-gradient(135deg,_rgba(226,232,240,0.95),_rgba(248,250,252,0.65))] dark:bg-[linear-gradient(135deg,_rgba(30,41,59,0.75),_rgba(15,23,42,0.6))] shadow-[0_16px_44px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-slate-400/85 dark:bg-slate-200/80',
    glowRgb: '100,116,139',
  },
  emerald: {
    border: 'border-emerald-300',
    borderDark: 'dark:border-emerald-600',
    hoverBorder: 'hover:border-emerald-400',
    hoverBorderDark: 'dark:hover:border-emerald-500',
    ringHex: '#34d399',
    gradFrom: '#34d399',
    gradVia: '#10b981',
    icon: 'text-emerald-500 dark:text-emerald-400',
    defaultPill:
      'border border-emerald-200/70 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-[linear-gradient(135deg,_rgba(16,185,129,0.22),_rgba(16,185,129,0.08))] dark:bg-[linear-gradient(135deg,_rgba(34,197,94,0.22),_rgba(34,197,94,0.08))] shadow-[0_18px_46px_-32px_rgba(16,185,129,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
    glowRgb: '16,185,129',
  },
  sky: {
    border: 'border-sky-300',
    borderDark: 'dark:border-sky-600',
    hoverBorder: 'hover:border-sky-400',
    hoverBorderDark: 'dark:hover:border-sky-500',
    ringHex: '#93c5fd',
    gradFrom: '#38bdf8',
    gradVia: '#0ea5e9',
    icon: 'text-sky-500 dark:text-sky-400',
    defaultPill:
      'border border-sky-200/70 dark:border-sky-500/40 text-sky-700 dark:text-sky-200 bg-[linear-gradient(135deg,_rgba(14,165,233,0.2),_rgba(14,165,233,0.08))] dark:bg-[linear-gradient(135deg,_rgba(56,189,248,0.2),_rgba(56,189,248,0.08))] shadow-[0_18px_46px_-32px_rgba(14,165,233,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-sky-500/90 dark:bg-sky-300/80',
    glowRgb: '14,165,233',
  },
  violet: {
    border: 'border-violet-300',
    borderDark: 'dark:border-violet-600',
    hoverBorder: 'hover:border-violet-400',
    hoverBorderDark: 'dark:hover:border-violet-500',
    ringHex: '#a78bfa',
    gradFrom: '#a78bfa',
    gradVia: '#7c3aed',
    icon: 'text-violet-500 dark:text-violet-400',
    defaultPill:
      'border border-violet-200/70 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 bg-[linear-gradient(135deg,_rgba(139,92,246,0.22),_rgba(139,92,246,0.08))] dark:bg-[linear-gradient(135deg,_rgba(167,139,250,0.22),_rgba(167,139,250,0.08))] shadow-[0_18px_46px_-32px_rgba(139,92,246,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-violet-500/90 dark:bg-violet-300/80',
    glowRgb: '167,139,250',
  },
  amber: {
    border: 'border-amber-300',
    borderDark: 'dark:border-amber-600',
    hoverBorder: 'hover:border-amber-400',
    hoverBorderDark: 'dark:hover:border-amber-500',
    ringHex: '#fbbf24',
    gradFrom: '#fbbf24',
    gradVia: '#f59e0b',
    icon: 'text-amber-500 dark:text-amber-400',
    defaultPill:
      'border border-amber-200/70 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-[linear-gradient(135deg,_rgba(245,158,11,0.22),_rgba(245,158,11,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,191,36,0.22),_rgba(251,191,36,0.08))] shadow-[0_18px_46px_-32px_rgba(245,158,11,0.52)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-amber-500/90 dark:bg-amber-300/85',
    glowRgb: '251,191,36',
  },
  rose: {
    border: 'border-rose-300',
    borderDark: 'dark:border-rose-600',
    hoverBorder: 'hover:border-rose-400',
    hoverBorderDark: 'dark:hover:border-rose-500',
    ringHex: '#f43f5e',
    gradFrom: '#fb7185',
    gradVia: '#f43f5e',
    icon: 'text-rose-500 dark:text-rose-400',
    defaultPill:
      'border border-rose-200/70 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 bg-[linear-gradient(135deg,_rgba(244,63,94,0.22),_rgba(244,63,94,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,113,133,0.22),_rgba(251,113,133,0.08))] shadow-[0_18px_46px_-32px_rgba(244,63,94,0.5)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-rose-500/90 dark:bg-rose-300/80',
    glowRgb: '244,63,94',
  },
};

const glassSurfaces = {
  shell: [
    'relative',
    'overflow-hidden',
    'rounded-[2.25rem]',
    'border',
    'border-white/35',
    'bg-white/24',
    'p-8',
    panelShadow,
    'backdrop-blur-[28px]',
    'backdrop-saturate-[150%]',
    'transition-colors',
    'duration-500',
    'ease-out',
    'dark:border-white/12',
    'dark:bg-[#0f172a]/55',
    panelShadowDark,
    'sm:p-12',
  ],
  panelDark: ['dark:bg-[#0f172a]/55'],
  panelShadow: ['dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]'],
  panelShadowDeep: ['dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]'],
  insetRing: [
    'absolute',
    'inset-[1px]',
    'rounded-[2.2rem]',
    'ring-1',
    'ring-white/45',
    glassInsetLight,
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
  wizardInsetRing: [
    'absolute inset-0 rounded-[inherit]',
    'ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(15,23,42,0.12)]',
    'transition-colors duration-500 ease-out',
    'dark:ring-white/10',
    'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(2,6,23,0.45)]',
  ],
  wizardSoftWash: [
    'absolute inset-0 rounded-[inherit]',
    'bg-[radial-gradient(120%_120%_at_14%_-8%,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0.12)_42%,transparent_68%)]',
    'opacity-80',
    'transition-opacity duration-500 ease-out',
    'dark:bg-[radial-gradient(120%_120%_at_16%_-10%,rgba(148,163,184,0.16)_0%,rgba(15,23,42,0.2)_38%,transparent_66%)]',
  ],
  wizardBrandWash: [
    'absolute inset-0 rounded-[inherit]',
    'bg-[radial-gradient(132%_160%_at_82%_118%,rgba(14,165,233,0.22)_0%,rgba(56,189,248,0.18)_28%,rgba(167,139,250,0.22)_56%,rgba(251,191,36,0.2)_76%,transparent_88%)]',
    'opacity-75',
    'transition-opacity duration-500 ease-out',
    'dark:bg-[radial-gradient(136%_160%_at_86%_122%,rgba(56,189,248,0.35)_0%,rgba(167,139,250,0.32)_48%,rgba(248,113,113,0.28)_68%,transparent_88%)]',
  ],
} as const;

const layeredSurfaces = {
  card85: ['dark:bg-[#111a2f]/85'],
  card90: ['dark:bg-[#111a2f]/90'],
  solid: ['dark:bg-[#111a2f]'],
  panel70: ['dark:bg-[#111a2f]/70'],
  panel80: ['dark:bg-[#111a2f]/80'],
  inputDark85: ['dark:bg-[#0f172a]/85'],
  shellHoverDark: ['dark:hover:bg-[#0f172a]'],
  dataRowDark70: ['dark:bg-[#1e293b]/70'],
  dataRowHover80: ['dark:hover:bg-[#1e293b]/80'],
  dataRowHover85: ['dark:hover:bg-[#1e293b]/85'],
  insetWell75: ['dark:bg-[#1e293b]/75'],
  control90: ['dark:bg-[#1e293b]/90'],
  fadeFromDark: ['dark:from-[#0f172a]'],
  secondaryTextMuted: ['text-[#475569]', 'dark:text-[#cbd5e1]'],
  eyebrowChip: [
    'inline-flex',
    'items-center',
    'justify-center',
    'rounded-full',
    'bg-white/75',
    'px-3',
    'py-1',
    'text-[11px]',
    'font-semibold',
    'uppercase',
    'tracking-[0.32em]',
    'text-[#475569]',
    'shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)]',
    'dark:bg-[#1e293b]/75',
    'dark:text-[#cbd5e1]',
  ],
} as const;

const focusSurfaces = {
  visibleDarkOffset: ['dark:focus-visible:ring-offset-[#0f172a]'],
  darkOffset: ['dark:focus:ring-offset-[#0f172a]'],
  ringOffsetLightOnDark: ['ring-offset-white', 'dark:ring-offset-[#0f172a]'],
} as const;

const featurePalettes = {
  welcome: {
    sky: {
      gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
      ring: 'ring-sky-300/35',
      iconLight: 'text-sky-700',
      iconDark: 'text-sky-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(14,165,233,0.55)]',
    },
    amber: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(245,158,11,0.55)]',
    },
    purple: {
      gradient: 'from-purple-400/55 via-purple-500/25 to-purple-500/5',
      ring: 'ring-purple-300/35',
      iconLight: 'text-purple-700',
      iconDark: 'text-purple-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(168,85,247,0.55)]',
    },
  },
  providerFeature: {
    emerald: {
      gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
      ring: 'ring-emerald-300/35',
      icon: 'text-emerald-700 dark:text-emerald-100',
      glow: 'shadow-[0_16px_40px_-24px_rgba(16,185,129,0.55)]',
    },
    amber: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      icon: 'text-amber-700 dark:text-amber-100',
      glow: 'shadow-[0_16px_40px_-24px_rgba(245,158,11,0.55)]',
    },
    purple: {
      gradient: 'from-purple-400/55 via-purple-500/25 to-purple-500/5',
      ring: 'ring-purple-300/35',
      icon: 'text-purple-700 dark:text-purple-100',
      glow: 'shadow-[0_16px_40px_-24px_rgba(168,85,247,0.55)]',
    },
  },
  highlight: {
    amber: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(245,158,11,0.65)]',
    },
    sky: {
      gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
      ring: 'ring-sky-300/35',
      iconLight: 'text-sky-700',
      iconDark: 'text-sky-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(14,165,233,0.6)]',
    },
    violet: {
      gradient: 'from-violet-400/55 via-violet-500/25 to-violet-500/5',
      ring: 'ring-violet-300/35',
      iconLight: 'text-violet-700',
      iconDark: 'text-violet-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(139,92,246,0.6)]',
    },
    fuchsia: {
      gradient: 'from-fuchsia-400/55 via-fuchsia-500/25 to-fuchsia-500/5',
      ring: 'ring-fuchsia-300/35',
      iconLight: 'text-fuchsia-700',
      iconDark: 'text-fuchsia-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(217,70,239,0.62)]',
    },
    emerald: {
      gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
      ring: 'ring-emerald-300/35',
      iconLight: 'text-emerald-700',
      iconDark: 'text-emerald-100',
      glow: 'shadow-[0_18px_45px_-25px_rgba(16,185,129,0.55)]',
    },
  },
} as const;

const brandAccentPalettes = {
  sky: { background: brandColors.sky, text: chartThemeLight.tooltipText },
  skyDark: { background: brandColors.skyDark, text: chartThemeDark.dotFill },
  emerald: { background: brandColors.emerald, text: chartThemeLight.tooltipText },
  emeraldDark: { background: brandColors.emeraldDark, text: chartThemeDark.dotFill },
  amber: { background: brandColors.amber, text: chartThemeLight.tooltipText },
  amberDark: { background: brandColors.amberDark, text: chartThemeDark.dotFill },
  rose: { background: brandColors.rose, text: chartThemeLight.tooltipText },
  roseDark: { background: brandColors.roseDark, text: chartThemeDark.dotFill },
  violet: { background: brandColors.violet },
  violetDark: { background: brandColors.violetDark, text: chartThemeDark.dotFill },
  cyan: { background: brandColors.cyan, text: chartThemeLight.tooltipText },
  cyanDark: { background: brandColors.cyanDark, text: chartThemeDark.dotFill },
} as const;

const chartPalettes = {
  series: {
    light: chartLight,
    dark: chartDark,
  },
  tooltip: {
    light: {
      background: chartThemeLight.tooltipBg,
      text: chartThemeLight.tooltipText,
      border: chartThemeLight.tooltipBorder,
    },
    dark: {
      background: chartThemeDark.tooltipBg,
      text: chartThemeDark.tooltipText,
      border: chartThemeDark.tooltipBorder,
    },
  },
  axis: {
    light: chartThemeLight.axis,
    dark: chartThemeDark.axis,
  },
  dot: {
    light: chartThemeLight.dotFill,
    dark: chartThemeDark.dotFill,
  },
} as const;

const financePalettes = {
  light: {
    cash: { text: semanticLight.cash },
    investments: { text: semanticLight.investments },
    credit: { text: semanticLight.credit },
    loan: { text: semanticLight.loan },
    netWorth: { text: semanticLight.netWorth },
  },
  dark: {
    cash: { text: semanticDark.cash },
    investments: { text: semanticDark.investments },
    credit: { text: semanticDark.credit },
    loan: { text: semanticDark.loan },
    netWorth: { text: semanticDark.netWorth },
  },
} as const;

const categoryPillPalettes = Object.fromEntries(
  categoryThemes.map((theme) => [theme.key, { background: theme.ringHex, text: chartThemeDark.dotFill }])
) as Record<string, { background: string; text: string }>;

export const designTokens = {
  typography: {
    brand: brandFont,
    sans: sansFont,
    subheading: sansFont,
    label: 'text-[0.65rem] font-semibold uppercase tracking-[0.24em]',
    pill: pillTypography,
    badge: 'text-[11px] font-semibold uppercase tracking-[0.32em]',
  },
  radii: {
    panel: 'rounded-[2.25rem]',
    card: 'rounded-2xl',
    large: 'rounded-3xl',
    pill: 'rounded-full',
    medium: 'rounded-xl',
    small: 'rounded-lg',
  },
  spacing: {
    pageX: 'px-4 sm:px-6 lg:px-8',
    pageY: 'py-4 sm:py-6 lg:py-8',
    shellX: 'px-4 sm:px-6',
    shellY: 'py-12 sm:py-16',
    compactGap: 'gap-2',
    sectionGap: 'gap-5',
  },
  shadows: {
    glass: {
      light: 'shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)]',
      dark: 'dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]',
    },
    glassInset: {
      light: glassInsetLight,
      dark: glassInsetDark,
    },
    panel: 'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]',
    panelDark: 'dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]',
    buttonPrimary: 'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
  },
  gradients: gradientPrimitives,
  effects: layoutEffects,
  motion: {
    fast: 'duration-200',
    medium: 'duration-300',
    slow: 'duration-500',
    aura: 'animate-[rotateAura_95s_linear_infinite]',
  },
  surfaces: {
    glass: glassSurfaces,
    layered: layeredSurfaces,
    focus: focusSurfaces,
  },
  colors: {
    brand: brandColors,
    theme: {
      light: {
        chart: chartThemeLight,
        semantic: semanticLight,
      },
      dark: {
        chart: chartThemeDark,
        semantic: semanticDark,
      },
    },
    categoryAccents: categoryThemes,
    accountTypeDot: {
      checking: '#38bdf8',
      savings: '#22c55e',
      credit: '#f59e0b',
      loan: '#a78bfa',
      other: '#94a3b8',
    },
  },
  palettes: {
    brandAccent: brandAccentPalettes,
    chart: chartPalettes,
    finance: financePalettes,
    categoryPill: categoryPillPalettes,
    feature: featurePalettes,
  },
  components: {
    button: {
      base: [
        'inline-flex items-center justify-center gap-2',
        'font-subheading uppercase',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900',
        'disabled:cursor-not-allowed disabled:opacity-60',
      ],
      primary: [
        'bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500',
        'text-white',
        'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
        'hover:-translate-y-0.5',
        'disabled:hover:translate-y-0',
      ],
      secondary: [
        'border border-slate-200/70 bg-white/70',
        'text-slate-600',
        'shadow-[0_14px_38px_-30px_rgba(15,23,42,0.45)]',
        'hover:border-sky-300/50 hover:text-slate-900',
        'hover:shadow-[0_14px_32px_-18px_rgba(56,189,248,0.35)]',
        'dark:border-white/10 dark:bg-white/5',
        'dark:text-slate-300',
        'dark:hover:border-sky-500/60 dark:hover:text-white',
      ],
      ghost: [
        'border border-white/50 bg-white/70',
        'text-slate-800',
        'shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]',
        'hover:-translate-y-0.5',
        'dark:border-white/15 dark:bg-[#1e293b]/70',
        'dark:text-slate-200',
      ],
      icon: [
        'border border-transparent bg-white/75',
        'text-slate-600',
        'shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)]',
        'hover:-translate-y-[1px] hover:border-sky-300',
        'hover:text-slate-900',
        'dark:bg-[#1e293b]/85',
        'dark:text-slate-400',
        'dark:hover:border-sky-400 dark:hover:text-white',
      ],
      tab: ['group relative', 'overflow-hidden', 'backdrop-blur-sm'],
      tabActive: [
        'group relative',
        'overflow-hidden',
        'border border-white/65',
        'bg-[linear-gradient(115deg,#38bdf8_0%,#22d3ee_46%,#a855f7_100%)]',
        'text-white',
        'shadow-[0_16px_42px_-18px_rgba(14,165,233,0.55)]',
        'backdrop-blur-sm',
        'before:absolute before:inset-0',
        'before:bg-[linear-gradient(140deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0)_60%)]',
        'before:opacity-80 before:pointer-events-none',
        'dark:border-white/20',
        'dark:shadow-[0_16px_38px_-18px_rgba(56,189,248,0.55)]',
      ],
      danger: [
        'border border-red-200 bg-red-50',
        'text-red-600',
        'hover:bg-red-100',
        'dark:border-red-700 dark:bg-red-900/20',
        'dark:text-red-400',
        'dark:hover:bg-red-900/30',
      ],
      success: [
        'bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400',
        'text-white',
        'shadow-[0_20px_55px_-28px_rgba(16,185,129,0.65)]',
        'hover:-translate-y-[3px]',
        'disabled:hover:translate-y-0',
      ],
      connect: [
        'bg-gradient-to-r from-[#0ea5e9] via-[#38bdf8] to-[#a78bfa]',
        'text-white',
        'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.78)]',
        'hover:-translate-y-[1px]',
        'hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.85)]',
        'active:scale-[0.98]',
        'dark:shadow-[0_22px_60px_-32px_rgba(56,189,248,0.65)]',
      ],
    },
    connectButton: {
      base: [
        'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'dark:focus-visible:ring-offset-slate-900',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none',
      ],
      secondary: [
        'border border-[#e2e8f0] bg-white/90 text-[#475569]',
        'shadow-[0_14px_38px_-30px_rgba(15,23,42,0.45)]',
        'hover:border-[#93c5fd] hover:text-[#0f172a]',
        'dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1]',
        'dark:hover:border-[#38bdf8] dark:hover:text-white',
      ],
    },
    badge: {
      base: ['inline-flex items-center justify-center', 'font-semibold uppercase', 'transition-all duration-200 ease-out'],
      default: [
        'bg-white/70 text-slate-600',
        'shadow-[0_12px_32px_-22px_rgba(15,23,42,0.45)]',
        'dark:bg-[#1e293b]/70 dark:text-slate-200',
      ],
      primary: ['bg-[#93c5fd]/20 text-[#0ea5e9]', 'dark:bg-[#38bdf8]/20 dark:text-[#38bdf8]'],
      feature: ['bg-[#f8fafc] ring-1 ring-inset', 'dark:bg-[#1e293b]'],
    },
    menuDropdown: {
      content: [
        'absolute right-0 z-20 mt-3 w-48',
        'overflow-hidden rounded-2xl',
        'border border-white/45 bg-white/95',
        'p-2',
        'shadow-[0_22px_60px_-32px_rgba(15,23,42,0.45)]',
        'backdrop-blur-md',
        'dark:border-white/12 dark:bg-[#0f172a]/92',
        'dark:shadow-[0_28px_70px_-36px_rgba(2,6,23,0.7)]',
      ],
      item: [
        'flex w-full items-center gap-2',
        'rounded-xl px-3 py-2',
        'text-left text-slate-600',
        'transition-all duration-200 ease-out',
        'hover:bg-slate-50',
        'dark:text-slate-300',
        'dark:hover:bg-[#1e293b]',
      ],
    },
    budgetCard: {
      shell: [
        'group relative overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white/90 p-6',
        'shadow-[0_32px_80px_-58px_rgba(15,23,42,0.58)] transition-all duration-300 hover:-translate-y-1',
        'hover:shadow-[0_38px_110px_-62px_rgba(14,165,233,0.35)] dark:border-white/10 dark:bg-[#111a2f]/90',
        'dark:shadow-[0_32px_90px_-60px_rgba(2,6,23,0.76)]',
      ],
    },
    actions: {
      budgetIconGhost: [
        'inline-flex items-center justify-center rounded-full border border-white/60 bg-white/80 p-2 text-slate-600',
        'shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)] transition-transform duration-200 hover:-translate-y-[2px] hover:bg-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'dark:border-white/12 dark:bg-[#1e293b]/70 dark:text-slate-200 dark:hover:bg-[#1e293b]/80 dark:focus-visible:ring-offset-[#0f172a]',
      ],
      budgetSaveIcon: [
        'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 p-2 text-white',
        'shadow-[0_18px_45px_-28px_rgba(16,185,129,0.6)] transition-transform duration-200 hover:-translate-y-[2px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'dark:focus-visible:ring-offset-[#0f172a]',
      ],
      budgetDeleteIcon: [
        'inline-flex items-center justify-center rounded-full bg-red-500/15 p-2 text-red-600',
        'shadow-[0_16px_38px_-26px_rgba(248,113,113,0.55)] transition-transform duration-200 hover:-translate-y-[2px] hover:bg-red-500/25',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/25 dark:focus-visible:ring-offset-[#0f172a]',
      ],
      paginationRound: [
        'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/50 bg-white/70 text-slate-600',
        'shadow-[0_14px_38px_-28px_rgba(15,23,42,0.55)] transition-all duration-200 hover:-translate-y-[2px] hover:bg-white/90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:border-white/10 dark:bg-[#1e293b]/70 dark:text-slate-200',
        'dark:hover:bg-[#1e293b]/85 dark:focus-visible:ring-offset-[#0f172a]',
      ],
      accountsToolbar: [
        'inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-5 py-2 text-sm font-semibold text-[#0f172a]',
        'shadow-[0_18px_48px_-32px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#93c5fd] hover:text-[#0f172a]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none',
        'dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white dark:focus-visible:ring-offset-slate-900',
      ],
    },
    onboarding: {
      stepCard: [
        'group relative overflow-hidden flex h-full flex-col items-center justify-start rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 text-center shadow-sm',
        'transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] hover:border-[#93c5fd]',
        'dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8] dark:hover:shadow-[0_20px_56px_-40px_rgba(2,6,23,0.65)]',
      ],
      iconWell: [
        'relative z-10 inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] ring-1 ring-inset',
        'dark:bg-[#1e293b]',
      ],
      iconWellLarge: [
        'relative z-10 inline-flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] ring-1 ring-inset',
        'dark:bg-[#1e293b]',
      ],
      providerRow: [
        'group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4 text-[13px] shadow-sm',
        'transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] hover:border-[#93c5fd]',
        'dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8] dark:hover:shadow-[0_20px_56px_-40px_rgba(2,6,23,0.65)]',
      ],
      titleStrong: ['relative z-10 mt-3 text-sm font-semibold text-[#0f172a]', 'dark:text-white'],
      titleStrongInline: ['text-sm font-semibold text-[#0f172a]', 'dark:text-white'],
      bodyMuted: ['relative z-10 mt-1 text-xs text-[#475569]', 'dark:text-[#cbd5e1]'],
      rowBodyMuted: ['text-xs text-[#475569]', 'dark:text-[#cbd5e1]'],
      eyebrowCaps: [
        'text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]',
      ],
      previewFrame: [
        'relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#0f172a] shadow-lg sm:aspect-[18/10]',
        'dark:border-[#334155]',
      ],
      hoverOverlay:
        'pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20',
      providerHoverOverlay:
        'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20',
      iconGlow:
        'absolute inset-[20%] rounded-full bg-slate-300/30 opacity-40 blur-[6px] dark:bg-black/20',
      providerIconGlow:
        'absolute inset-[18%] rounded-full bg-slate-300/30 opacity-50 blur-[6px] dark:bg-black/20',
      providerConnect: {
        plaidEyebrowBg: ['bg-[#34d399]/20', 'dark:bg-[#34d399]/20'],
        plaidEyebrowText: ['text-[#10b981]', 'dark:text-[#34d399]'],
        tellerEyebrowBg: ['bg-[#38bdf8]/20', 'dark:bg-[#38bdf8]/15'],
        tellerEyebrowText: ['text-[#0284c7]', 'dark:text-[#38bdf8]'],
      },
    },
    budgetProgress: {
      track: [
        'relative',
        'h-2.5',
        'overflow-hidden',
        'rounded-full',
        'bg-slate-200/70',
        'shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]',
        'transition-colors',
        'duration-300',
        'dark:bg-slate-700/60',
        'dark:shadow-[inset_0_1px_2px_rgba(2,6,23,0.35)]',
      ],
      fill: {
        base: ['absolute', 'inset-y-0', 'left-0', 'rounded-full', 'transition-all', 'duration-500'],
        within: [
          'bg-gradient-to-r',
          'from-sky-400',
          'via-cyan-400',
          'to-violet-500',
          'shadow-[0_0_12px_rgba(14,165,233,0.35)]',
        ],
        over: [
          'bg-gradient-to-r',
          'from-rose-400',
          'via-rose-500',
          'to-rose-600',
          'shadow-[0_0_12px_rgba(244,63,94,0.35)]',
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
        summaryOver: ['font-semibold', 'text-red-600', 'dark:text-red-300'],
      },
    },
    input: {
      base: [
        'w-full',
        'px-4',
        'border',
        'font-medium',
        'shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]',
        'transition-all duration-200 ease-out',
        'focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
      ],
      default: [
        'bg-white text-slate-900',
        'border-black/10',
        'focus:ring-2 focus:ring-sky-400',
        'focus:ring-offset-2 focus:ring-offset-white',
        'dark:bg-[#111a2f] dark:text-white',
        'dark:border-white/12',
        'dark:focus:ring-sky-400/80',
        'dark:focus:ring-offset-[#0f172a]',
      ],
      invalid: [
        'bg-white text-slate-900',
        'border-red-300',
        'focus:ring-2 focus:ring-red-400',
        'focus:ring-offset-2 focus:ring-offset-white',
        'dark:bg-[#111a2f] dark:text-white',
        'dark:border-red-600/80',
        'dark:focus:ring-red-400/75',
        'dark:focus:ring-offset-[#0f172a]',
      ],
      glass: [
        'bg-white/80 text-slate-700',
        'border-white/60',
        'shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)]',
        'focus:ring-2 focus:ring-sky-400/80',
        'focus:ring-offset-2 focus:ring-offset-white',
        'dark:bg-[#111a2f]/80 dark:text-slate-100',
        'dark:border-white/12',
        'dark:focus:ring-offset-[#0f172a]',
      ],
      size: {
        sm: 'py-1.5 text-xs rounded-lg',
        md: 'py-2.5 text-sm rounded-xl',
        lg: 'py-3 text-base rounded-xl',
      },
    },
    glassCard: {
      base: [
        'relative overflow-hidden',
        'border',
        glassShadowLight,
        'backdrop-blur-2xl backdrop-saturate-[150%]',
        'transition-colors duration-500',
        glassShadowDark,
      ],
      default: ['border-white/35', 'bg-white/18', 'dark:border-white/12', 'dark:bg-[#0f172a]/55'],
      auth: [
        'border-white/35',
        'bg-white/20',
        'shadow-[0_38px_120px_-60px_rgba(15,23,42,0.78)]',
        'backdrop-blur-[26px]',
        'backdrop-saturate-[140%]',
        'dark:border-white/12',
        'dark:bg-[#0f172a]/55',
        'dark:shadow-[0_40px_120px_-58px_rgba(2,6,23,0.85)]',
      ],
      accent: [
        'border-white/40',
        'bg-white/85',
        'backdrop-blur-sm',
        'dark:border-white/10',
        'dark:bg-[#111a2f]/75',
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
        gradientPrimitives.appShellLight,
        'transition-colors duration-500 ease-out',
        gradientPrimitives.appShellDark,
      ],
      overlay: [gradientPrimitives.auraBlue, 'transition-colors duration-700', gradientPrimitives.auraBlueDark],
      violetAura: [gradientPrimitives.auraViolet, 'transition-opacity duration-700', 'dark:bg-transparent'],
      cyanAura: [gradientPrimitives.auraCyan, 'transition-opacity duration-700', 'dark:bg-transparent'],
      vignette: layoutEffects.shell.vignette,
      vignetteOverlay: layoutEffects.shell.vignetteOverlay,
      centerGlow: layoutEffects.shell.centerGlow,
      contentCentered: 'flex min-h-screen items-center justify-center px-4 py-12 sm:px-6',
    },
    appTitleBar: {
      base: ['sticky top-0 z-50 border-b backdrop-blur-sm transition-all duration-200 ease-out'],
      shell: [gradientPrimitives.pageTitleBar],
      height: {
        scrolled: 'h-14',
        default: 'h-16',
      },
      logo: {
        container: ['flex', 'items-center', 'gap-2', 'text-slate-900', 'dark:text-white'],
        scrolled: 'text-xl',
        default: 'text-3xl',
        fontFamily: { fontFamily: brandFont },
      },
      tabIdle:
        'border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-sky-300/50 dark:hover:border-sky-500/60 hover:shadow-[0_14px_32px_-18px_rgba(56,189,248,0.35)]',
      tabHalo: layoutEffects.titleBar.tabHalo,
      divider: 'w-px h-6 bg-slate-200 dark:bg-slate-600',
      themeToggle: layoutEffects.titleBar.themeToggle,
      settingsIdle: 'border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
    },
    pageLayout: {
      shell: glassSurfaces.shell,
      innerRing: glassSurfaces.insetRing,
      innerGradient: glassSurfaces.innerGradient,
      badge:
        'inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-slate-200',
      title: 'text-3xl font-bold text-slate-900 transition-colors duration-300 ease-out dark:text-white sm:text-4xl',
      subtitle:
        'text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300',
      error:
        'rounded-2xl border border-red-200/70 bg-red-50/80 px-5 py-3 shadow-sm dark:border-red-700/60 dark:bg-red-900/25',
      errorText: 'text-sm font-medium text-red-600 dark:text-red-300',
    },
    emptyState: {
      iconWrapper: [
        'flex',
        'h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20',
        'items-center',
        'justify-center',
        'rounded-full',
        gradientPrimitives.emptyStateIcon,
        'text-slate-600',
        'transition-all duration-300 ease-out',
        'hover:scale-110 hover:-translate-y-1',
        layoutEffects.emptyState.iconHoverGlowLight,
        'dark:text-slate-300',
        layoutEffects.emptyState.iconHoverGlowDark,
        'cursor-pointer',
      ],
      title: 'text-lg font-semibold text-slate-700 transition-colors duration-500 dark:text-slate-200',
      description:
        'text-sm text-slate-500 transition-colors duration-500 dark:text-slate-400 max-w-sm',
    },
    pill: {
      base:
        'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em]',
      dot: 'h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)]',
      fadeLeft: layoutEffects.pillOverflow.fadeLeft,
      fadeRight: layoutEffects.pillOverflow.fadeRight,
    },
    heroStatCard: {
      base: 'hero-stat-card group relative rounded-2xl transition-colors duration-300',
      shell:
        'relative h-full w-full overflow-hidden rounded-2xl border-2 bg-white/80 p-4 transform-gpu origin-center will-change-transform transition-transform duration-200 dark:bg-[#111a2f]/70',
      title:
        'text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400',
      value: 'text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white',
      suffix: 'text-sm font-medium text-slate-600 transition-colors duration-500 dark:text-slate-300',
      overlay:
        'pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
      ring: 'pointer-events-none absolute inset-[2px] rounded-[calc(1rem-2px)] opacity-70',
      ringLine: 'absolute inset-0 rounded-[calc(1rem-2px)] ring-2',
      footer: 'relative',
      footerInner: 'scrollbar-hide flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      accent: heroAccentThemes,
      semantic: {
        success: {
          wrapper:
            'border border-emerald-200/70 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-[linear-gradient(135deg,_rgba(16,185,129,0.24),_rgba(16,185,129,0.1))] dark:bg-[linear-gradient(135deg,_rgba(34,197,94,0.22),_rgba(34,197,94,0.08))] shadow-[0_14px_40px_-28px_rgba(16,185,129,0.52)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
          dot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
        },
        info: {
          wrapper:
            'border border-sky-200/70 dark:border-sky-500/40 text-sky-700 dark:text-sky-200 bg-[linear-gradient(135deg,_rgba(14,165,233,0.22),_rgba(14,165,233,0.08))] dark:bg-[linear-gradient(135deg,_rgba(56,189,248,0.22),_rgba(56,189,248,0.08))] shadow-[0_14px_40px_-28px_rgba(14,165,233,0.52)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
          dot: 'bg-sky-500/90 dark:bg-sky-300/80',
        },
        warning: {
          wrapper:
            'border border-amber-200/70 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-[linear-gradient(135deg,_rgba(245,158,11,0.24),_rgba(245,158,11,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,191,36,0.22),_rgba(251,191,36,0.08))] shadow-[0_14px_40px_-28px_rgba(245,158,11,0.5)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
          dot: 'bg-amber-500/90 dark:bg-amber-300/85',
        },
        danger: {
          wrapper:
            'border border-rose-200/70 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 bg-[linear-gradient(135deg,_rgba(244,63,94,0.24),_rgba(244,63,94,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,113,133,0.22),_rgba(251,113,133,0.08))] shadow-[0_14px_40px_-28px_rgba(244,63,94,0.48)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
          dot: 'bg-rose-500/90 dark:bg-rose-300/80',
        },
      },
    },
  },
} as const;

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? designTokens.colors.theme.dark : designTokens.colors.theme.light;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCategoryAccent(name?: string | null): CategoryTheme {
  const key = (name || 'Uncategorized').toLowerCase();
  return designTokens.colors.categoryAccents[hashString(key) % designTokens.colors.categoryAccents.length];
}

export function getHeroAccentTheme(accent: HeroAccent): HeroAccentTheme {
  return designTokens.components.heroStatCard.accent[accent];
}
