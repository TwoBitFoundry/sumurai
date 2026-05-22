import generatedTokens from './generated/tokens';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeMode;
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

export const chart = {
  series: {
    light: chartThemeLight.primary,
    dark: chartThemeDark.primary,
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
  grid: {
    light: chartThemeLight.grid,
    dark: chartThemeDark.grid,
  },
  dot: {
    light: chartThemeLight.dotFill,
    dark: chartThemeDark.dotFill,
  },
} as const;

export const finance = {
  light: {
    cash: semanticLight.cash,
    investments: semanticLight.investments,
    credit: semanticLight.credit,
    loan: semanticLight.loan,
    netWorth: semanticLight.netWorth,
  },
  dark: {
    cash: semanticDark.cash,
    investments: semanticDark.investments,
    credit: semanticDark.credit,
    loan: semanticDark.loan,
    netWorth: semanticDark.netWorth,
  },
} as const;

export const accountTypeDot = {
  checking: '#38bdf8',
  savings: '#22c55e',
  credit: '#f59e0b',
  loan: '#a78bfa',
  other: '#94a3b8',
} as const;

const pillTypography = 'text-[0.6rem] font-bold uppercase tracking-[0.18em]';

export const categoryAccents: CategoryTheme[] = [
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

export const heroAccents: Record<HeroAccent, HeroAccentTheme> = {
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

export const featurePalettes = {
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

const themeColors = {
  light: { chart: chartThemeLight, semantic: semanticLight },
  dark: { chart: chartThemeDark, semantic: semanticDark },
} as const;

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export function getThemeColors(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? themeColors.dark : themeColors.light;
}

export function getCategoryAccentByIndex(index: number): CategoryTheme {
  const normalizedIndex =
    ((index % categoryAccents.length) + categoryAccents.length) % categoryAccents.length;
  return categoryAccents[normalizedIndex];
}

export function getCategoryAccent(name?: string | null, index?: number): CategoryTheme {
  if (index != null) {
    return getCategoryAccentByIndex(index);
  }
  const key = (name || 'Uncategorized').toLowerCase();
  return categoryAccents[hashString(key) % categoryAccents.length];
}

export function getHeroAccentForCategoryKey(categoryKey: string): HeroAccent {
  const map: Record<string, HeroAccent> = {
    sky: 'sky',
    emerald: 'emerald',
    cyan: 'sky',
    violet: 'violet',
    amber: 'amber',
    rose: 'rose',
    indigo: 'violet',
    fuchsia: 'violet',
    teal: 'emerald',
    lime: 'emerald',
  };
  return map[categoryKey] ?? 'emerald';
}

export function getHeroAccentTheme(accent: HeroAccent): HeroAccentTheme {
  return heroAccents[accent];
}
