import generatedTokens from './generated/tokens';
import { budgetTokenRecipes } from '@/features/budgets/tokenRecipes';
import { onboardingTokenRecipes } from '@/components/onboarding/tokenRecipes';
import { primitiveTokenRecipes } from '@/ui/primitives/tokenRecipes';

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
  sky: generatedTokens.color['brand-sky'].$value.hex,
  skyDark: generatedTokens.color['brand-sky-dark'].$value.hex,
  emerald: generatedTokens.color['brand-emerald'].$value.hex,
  emeraldDark: generatedTokens.color['brand-emerald-dark'].$value.hex,
  amber: generatedTokens.color['brand-amber'].$value.hex,
  amberDark: generatedTokens.color['brand-amber-dark'].$value.hex,
  rose: generatedTokens.color['brand-rose'].$value.hex,
  roseDark: generatedTokens.color['brand-rose-dark'].$value.hex,
  violet: generatedTokens.color['brand-violet'].$value.hex,
  violetDark: generatedTokens.color['brand-violet-dark'].$value.hex,
  cyan: generatedTokens.color['brand-cyan'].$value.hex,
  cyanDark: generatedTokens.color['brand-cyan-dark'].$value.hex,
} as const;

const chartLight = [
  generatedTokens.color['chart-light-1'].$value.hex,
  generatedTokens.color['chart-light-2'].$value.hex,
  generatedTokens.color['chart-light-3'].$value.hex,
  generatedTokens.color['chart-light-4'].$value.hex,
  generatedTokens.color['chart-light-5'].$value.hex,
  generatedTokens.color['chart-light-6'].$value.hex,
];
const chartDark = [
  generatedTokens.color['chart-dark-1'].$value.hex,
  generatedTokens.color['chart-dark-2'].$value.hex,
  generatedTokens.color['chart-dark-3'].$value.hex,
  generatedTokens.color['chart-dark-4'].$value.hex,
  generatedTokens.color['chart-dark-5'].$value.hex,
  generatedTokens.color['chart-dark-6'].$value.hex,
];
const brandFont = generatedTokens.typography.brand.$value.fontFamily;
const sansFont = generatedTokens.typography.sans.$value.fontFamily;
const glassShadowLight = 'shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)]';
const glassShadowDark = 'dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]';
const glassInsetLight =
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]';
const glassInsetDark =
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]';
const panelShadow = 'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]';
const panelShadowDark = 'dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)]';
const fieldControlBase = [
  'w-full',
  'px-4',
  'border',
  'font-medium',
  'shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]',
  'transition-all duration-200 ease-out',
  'focus:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-60',
];
const fieldControlDefault = [
  'bg-white text-slate-900',
  'border-black/10',
  'focus:ring-2 focus:ring-sky-400',
  'focus:ring-offset-2 focus:ring-offset-white',
  'dark:bg-[#111a2f]',
  'dark:text-white',
  'dark:border-white/12',
  'dark:focus:ring-sky-400/80',
  'dark:focus:ring-offset-[#0f172a]',
];
const fieldControlInvalid = [
  'bg-white text-slate-900',
  'border-red-300',
  'focus:ring-2 focus:ring-red-400',
  'focus:ring-offset-2 focus:ring-offset-white',
  'dark:bg-[#111a2f]',
  'dark:text-white',
  'dark:border-red-600/80',
  'dark:focus:ring-red-400/75',
  'dark:focus:ring-offset-[#0f172a]',
];
const fieldControlGlass = [
  'bg-white/80 text-slate-700',
  'border-white/60',
  'shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)]',
  'focus:ring-2 focus:ring-sky-400/80',
  'focus:ring-offset-2 focus:ring-offset-white',
  'dark:bg-[#111a2f]/80 dark:text-slate-100',
  'dark:border-white/12',
  'dark:focus:ring-offset-[#0f172a]',
];
const fieldControlSizes = {
  sm: 'py-1.5 text-xs rounded-lg',
  md: 'py-2.5 text-sm rounded-xl',
  lg: 'py-3 text-base rounded-xl',
} as const;

const transactionRow = {
  shell: [
    'group relative border-b border-slate-200/70 transition-all duration-150 ease-out hover:-translate-y-[2px] hover:ring-2 hover:ring-sky-400/60',
    'dark:border-slate-700/50 dark:hover:ring-sky-400/50',
  ],
  odd: ['bg-slate-100', 'dark:bg-slate-700/20'],
  even: ['bg-white', 'dark:bg-transparent'],
} as const;

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
  cash: generatedTokens.color['semantic-light-cash'].$value.hex,
  investments: generatedTokens.color['semantic-light-investments'].$value.hex,
  credit: generatedTokens.color['semantic-light-credit'].$value.hex,
  loan: generatedTokens.color['semantic-light-loan'].$value.hex,
  netWorth: generatedTokens.color['semantic-light-net-worth'].$value.hex,
};

const semanticDark = {
  cash: generatedTokens.color['semantic-dark-cash'].$value.hex,
  investments: generatedTokens.color['semantic-dark-investments'].$value.hex,
  credit: generatedTokens.color['semantic-dark-credit'].$value.hex,
  loan: generatedTokens.color['semantic-dark-loan'].$value.hex,
  netWorth: generatedTokens.color['semantic-dark-net-worth'].$value.hex,
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

const onboardingShell = [
  'group relative overflow-hidden border border-[#e2e8f0] bg-white shadow-sm',
  'transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] hover:border-[#93c5fd]',
  'dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8] dark:hover:shadow-[0_20px_56px_-40px_rgba(2,6,23,0.65)]',
] as const;

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
    button: primitiveTokenRecipes.button,
    connectButton: primitiveTokenRecipes.connectButton,
    badge: primitiveTokenRecipes.badge,
    menuDropdown: primitiveTokenRecipes.menuDropdown,
    budgetCard: budgetTokenRecipes.budgetCard,
    actions: budgetTokenRecipes.actions,
    onboarding: onboardingTokenRecipes,
    budgetProgress: budgetTokenRecipes.budgetProgress,
    glassCard: primitiveTokenRecipes.glassCard,
    gradientShell: primitiveTokenRecipes.gradientShell,
    appTitleBar: primitiveTokenRecipes.appTitleBar,
    pageLayout: primitiveTokenRecipes.pageLayout,
    emptyState: primitiveTokenRecipes.emptyState,
    pill: primitiveTokenRecipes.pill,
    transactions: {
      row: transactionRow,
    },
    input: {
      base: fieldControlBase,
      default: fieldControlDefault,
      invalid: fieldControlInvalid,
      glass: fieldControlGlass,
      size: fieldControlSizes,
    },
    select: {
      base: fieldControlBase,
      default: fieldControlDefault,
      invalid: fieldControlInvalid,
      glass: fieldControlGlass,
      size: fieldControlSizes,
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
