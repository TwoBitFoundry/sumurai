import generatedTokens from './generated/tokens';
import { categoryPill, font, effect as uiEffectRecipes } from './recipes';

const glassBackdropClasses = uiEffectRecipes.glassBackdrop.join(' ');

const brandAzure = generatedTokens.color['brand-azure'].$value.hex;
const brandGlacier = generatedTokens.color['brand-glacier'].$value.hex;
const brandTeal = generatedTokens.color['brand-teal'].$value.hex;
const brandMint = generatedTokens.color['brand-mint'].$value.hex;
const brandOcean = generatedTokens.color['brand-ocean'].$value.hex;
const brandNavy = generatedTokens.color['brand-navy'].$value.hex;
const brandIce = generatedTokens.color['brand-ice'].$value.hex;
const brandCrimson = generatedTokens.color['brand-crimson'].$value.hex;
const brandSignalRed = generatedTokens.color['brand-signal-red'].$value.hex;
const brandAmber = generatedTokens.color['brand-amber'].$value.hex;
const brandAmberDark = generatedTokens.color['brand-amber-dark'].$value.hex;

function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const alphaByte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${normalized}${alphaByte}`;
}

const textMuted = generatedTokens.color['text-muted'].$value.hex;
const textMutedDark = generatedTokens.color['text-muted-dark'].$value.hex;
const textPrimaryDark = generatedTokens.color['text-primary-dark'].$value.hex;

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeMode;
export type HeroAccent = 'slate' | 'teal' | 'azure' | 'ocean' | 'amber' | 'crimson';
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
  effect: {
    successGlow: string;
    dangerGlow: string;
  };
};

export type CategoryTheme = {
  key: string;
  cssVars: {
    '--category-accent': string;
    '--category-accent-bright': string;
  };
  tag: string;
  inlineLabel: string;
  chipSurface: string;
  chipSurfaceSelected: string;
  dot: string;
  ring: string;
  ringHex: string;
};

export type CategoryThemeVars = CategoryTheme['cssVars'];

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
  grid: hexWithAlpha(textMuted, 0.28),
  axis: textMuted,
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
  tooltipText: textMuted,
  dotFill: '#ffffff',
} as const;

const chartThemeDark = {
  primary: chartDark,
  grid: hexWithAlpha(textMutedDark, 0.42),
  axis: textMutedDark,
  tooltipBg: '#1e293b',
  tooltipBorder: '#475569',
  tooltipText: textPrimaryDark,
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

export const status = {
  light: {
    successIcon: generatedTokens.color['status-success-icon'].$value.hex,
    dangerIcon: generatedTokens.color['status-danger-icon'].$value.hex,
  },
  dark: {
    successIcon: generatedTokens.color['status-success-icon-dark'].$value.hex,
    dangerIcon: generatedTokens.color['status-danger-icon-dark'].$value.hex,
  },
} as const;

export const accountTypeDot = {
  cash: brandTeal,
  credit: brandCrimson,
  investments: brandAzure,
  loan: brandAmber,
} as const;

const ROTATION_EXCLUDED_CATEGORY_ACCENT_KEYS = new Set(['emerald', 'rose']);

type CategoryAccentKey =
  | 'sky'
  | 'emerald'
  | 'cyan'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'fuchsia'
  | 'teal'
  | 'lime'
  | 'orange'
  | 'pink'
  | 'slate'
  | 'coral'
  | 'mint';

const categoryAccentColors: Record<CategoryAccentKey, { light: string; dark: string }> = {
  sky: { light: '#0284c7', dark: '#38bdf8' },
  emerald: { light: brandTeal, dark: brandMint },
  cyan: { light: '#0891b2', dark: '#67e8f9' },
  violet: { light: '#7c3aed', dark: '#c4b5fd' },
  amber: { light: brandAmber, dark: brandAmberDark },
  rose: { light: brandCrimson, dark: brandSignalRed },
  indigo: { light: '#4f46e5', dark: '#a5b4fc' },
  fuchsia: { light: '#c026d3', dark: '#f0abfc' },
  teal: { light: '#0d9488', dark: '#5eead4' },
  lime: { light: '#65a30d', dark: '#bef264' },
  orange: { light: '#ea580c', dark: '#fdba74' },
  pink: { light: '#db2777', dark: '#f9a8d4' },
  slate: { light: '#64748b', dark: '#cbd5e1' },
  coral: { light: '#f43f5e', dark: '#fda4af' },
  mint: { light: '#059669', dark: '#6ee7b7' },
};

function joinRecipeClasses(...groups: readonly (readonly string[] | string)[]): string {
  return groups.flatMap((group) => (typeof group === 'string' ? [group] : [...group])).join(' ');
}

function buildCategoryAccentCssVars(key: CategoryAccentKey): CategoryThemeVars {
  const colors = categoryAccentColors[key];
  return {
    '--category-accent': colors.light,
    '--category-accent-bright': colors.dark,
  };
}

function brandCategoryAccent(key: CategoryAccentKey, ringHex: string): CategoryTheme {
  return {
    key,
    cssVars: buildCategoryAccentCssVars(key),
    tag: joinRecipeClasses(
      font.categoryTag,
      categoryPill.text,
      'border',
      categoryPill.border,
      categoryPill.surface
    ),
    inlineLabel: joinRecipeClasses(font.badge, categoryPill.text),
    chipSurface: joinRecipeClasses(categoryPill.chipSurface),
    chipSurfaceSelected: joinRecipeClasses(categoryPill.chipSurfaceSelected),
    dot: joinRecipeClasses(categoryPill.dot),
    ring: joinRecipeClasses(categoryPill.ring),
    ringHex,
  };
}

export function categoryThemeVars(theme: CategoryTheme): CategoryThemeVars {
  return theme.cssVars;
}

export const categoryAccents: CategoryTheme[] = [
  brandCategoryAccent('sky', '#38bdf8'),
  brandCategoryAccent('emerald', brandMint),
  brandCategoryAccent('cyan', '#67e8f9'),
  brandCategoryAccent('violet', '#c4b5fd'),
  brandCategoryAccent('amber', brandAmberDark),
  brandCategoryAccent('rose', brandCrimson),
  brandCategoryAccent('indigo', '#a5b4fc'),
  brandCategoryAccent('fuchsia', '#f0abfc'),
  brandCategoryAccent('teal', '#5eead4'),
  brandCategoryAccent('lime', '#bef264'),
  brandCategoryAccent('orange', '#fdba74'),
  brandCategoryAccent('pink', '#f9a8d4'),
  brandCategoryAccent('slate', '#cbd5e1'),
  brandCategoryAccent('coral', '#fda4af'),
  brandCategoryAccent('mint', '#6ee7b7'),
];

export function getCategoryLabelHex(theme: CategoryTheme, mode: ThemeMode): string {
  const colors = categoryAccentColors[theme.key as CategoryAccentKey];
  return colors?.[mode] ?? theme.ringHex;
}

const heroPill = (lightVar: string, darkVar: string, lightText: string, darkText: string) =>
  `border border-[color:color-mix(in_srgb,var(${lightVar})_20%,transparent)] dark:border-[color:color-mix(in_srgb,var(${darkVar})_25%,transparent)] text-[var(${lightText})] dark:text-[var(${darkText})] bg-[linear-gradient(135deg,color-mix(in_srgb,var(${lightVar})_22%,transparent),color-mix(in_srgb,var(${lightVar})_8%,transparent))] dark:bg-[linear-gradient(135deg,color-mix(in_srgb,var(${darkVar})_22%,transparent),color-mix(in_srgb,var(${darkVar})_8%,transparent))] ${glassBackdropClasses} ring-1 ring-white/65 dark:ring-white/12`;

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
    defaultPill: `border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 bg-[linear-gradient(135deg,_rgba(226,232,240,0.95),_rgba(248,250,252,0.65))] dark:bg-[linear-gradient(135deg,_rgba(30,41,59,0.75),_rgba(15,23,42,0.6))] ${glassBackdropClasses} ring-1 ring-white/65 dark:ring-white/12`,
    defaultDot: 'bg-slate-400/85 dark:bg-slate-200/80',
    glowRgb: '100,116,139',
  },
  teal: {
    border: 'border-[color:color-mix(in_srgb,var(--color-brand-teal)_40%,transparent)]',
    borderDark: 'dark:border-[color:color-mix(in_srgb,var(--color-brand-mint)_35%,transparent)]',
    hoverBorder: 'hover:border-[var(--color-brand-teal)]',
    hoverBorderDark: 'dark:hover:border-[var(--color-brand-mint)]',
    ringHex: brandMint,
    gradFrom: brandMint,
    gradVia: brandTeal,
    icon: 'text-[var(--color-brand-teal)] dark:text-[var(--color-brand-mint)]',
    defaultPill: heroPill(
      '--color-brand-teal',
      '--color-brand-mint',
      '--color-brand-teal',
      '--color-brand-mint'
    ),
    defaultDot:
      'bg-[color:color-mix(in_srgb,var(--color-brand-teal)_90%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--color-brand-mint)_80%,transparent)]',
    glowRgb: '0,194,162',
  },
  azure: {
    border: 'border-[color:color-mix(in_srgb,var(--color-brand-azure)_40%,transparent)]',
    borderDark: 'dark:border-[color:color-mix(in_srgb,var(--color-brand-glacier)_35%,transparent)]',
    hoverBorder: 'hover:border-[var(--color-brand-azure)]',
    hoverBorderDark: 'dark:hover:border-[var(--color-brand-glacier)]',
    ringHex: brandGlacier,
    gradFrom: brandGlacier,
    gradVia: brandAzure,
    icon: 'text-[var(--color-brand-azure)] dark:text-[var(--color-brand-glacier)]',
    defaultPill: heroPill(
      '--color-brand-azure',
      '--color-brand-glacier',
      '--color-brand-azure',
      '--color-brand-glacier'
    ),
    defaultDot:
      'bg-[color:color-mix(in_srgb,var(--color-brand-azure)_90%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--color-brand-glacier)_80%,transparent)]',
    glowRgb: '13,138,204',
  },
  ocean: {
    border: 'border-[color:color-mix(in_srgb,var(--color-brand-ocean)_40%,transparent)]',
    borderDark: 'dark:border-[color:color-mix(in_srgb,var(--color-brand-navy)_50%,transparent)]',
    hoverBorder: 'hover:border-[var(--color-brand-ocean)]',
    hoverBorderDark: 'dark:hover:border-[var(--color-brand-navy)]',
    ringHex: brandOcean,
    gradFrom: brandOcean,
    gradVia: brandNavy,
    icon: 'text-[var(--color-brand-ocean)] dark:text-[var(--color-brand-glacier)]',
    defaultPill: heroPill(
      '--color-brand-ocean',
      '--color-brand-navy',
      '--color-brand-ocean',
      '--color-brand-glacier'
    ),
    defaultDot:
      'bg-[color:color-mix(in_srgb,var(--color-brand-ocean)_90%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--color-brand-glacier)_80%,transparent)]',
    glowRgb: '32,66,140',
  },
  amber: {
    border: 'border-amber-300',
    borderDark: 'dark:border-amber-600',
    hoverBorder: 'hover:border-amber-400',
    hoverBorderDark: 'dark:hover:border-amber-500',
    ringHex: brandAmberDark,
    gradFrom: brandAmberDark,
    gradVia: brandAmber,
    icon: 'text-[var(--color-brand-amber)]',
    defaultPill: heroPill(
      '--color-brand-amber',
      '--color-brand-amber',
      '--color-brand-amber',
      '--color-brand-amber'
    ),
    defaultDot:
      'bg-[color:color-mix(in_srgb,var(--color-brand-amber)_90%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--color-brand-amber)_85%,transparent)]',
    glowRgb: '251,191,36',
  },
  crimson: {
    border: 'border-[color:color-mix(in_srgb,var(--color-brand-crimson)_40%,transparent)]',
    borderDark:
      'dark:border-[color:color-mix(in_srgb,var(--color-brand-signal-red)_35%,transparent)]',
    hoverBorder: 'hover:border-[var(--color-brand-crimson)]',
    hoverBorderDark: 'dark:hover:border-[var(--color-brand-signal-red)]',
    ringHex: brandCrimson,
    gradFrom: brandSignalRed,
    gradVia: brandCrimson,
    icon: 'text-[var(--color-brand-crimson)] dark:text-[var(--color-brand-signal-red)]',
    defaultPill: heroPill(
      '--color-brand-crimson',
      '--color-brand-signal-red',
      '--color-brand-crimson',
      '--color-brand-signal-red'
    ),
    defaultDot:
      'bg-[color:color-mix(in_srgb,var(--color-brand-crimson)_90%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--color-brand-signal-red)_80%,transparent)]',
    glowRgb: '184,40,18',
  },
};

export const featurePalettes = {
  welcome: {
    azure: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-glacier)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-azure)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-azure)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-glacier)_35%,transparent)]',
      iconLight: 'text-[var(--color-brand-ocean)]',
      iconDark: 'text-[var(--color-brand-ice)]',
      glow: '${glassDropShadowClasses}',
    },
    amber: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-100',
      glow: '${glassDropShadowClasses}',
    },
    ocean: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-ocean)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-navy)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-navy)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-ocean)_35%,transparent)]',
      iconLight: 'text-[var(--color-brand-navy)]',
      iconDark: 'text-[var(--color-brand-ice)]',
      glow: '${glassDropShadowClasses}',
    },
  },
  providerFeature: {
    teal: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-mint)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-teal)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-teal)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-mint)_35%,transparent)]',
      icon: 'text-[var(--color-brand-teal)] dark:text-[var(--color-brand-mint)]',
      glow: '${glassDropShadowClasses}',
    },
    amber: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      icon: 'text-amber-700 dark:text-amber-100',
      glow: '${glassDropShadowClasses}',
    },
    ocean: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-ocean)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-navy)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-navy)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-ocean)_35%,transparent)]',
      icon: 'text-[var(--color-brand-navy)] dark:text-[var(--color-brand-ice)]',
      glow: '${glassDropShadowClasses}',
    },
  },
  highlight: {
    amber: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-200',
      glow: '${glassDropShadowClasses}',
    },
    azure: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-glacier)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-azure)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-azure)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-glacier)_35%,transparent)]',
      iconLight: 'text-[var(--color-brand-ocean)]',
      iconDark: 'text-[var(--color-brand-ice)]',
      glow: '${glassDropShadowClasses}',
    },
    ocean: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-ocean)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-navy)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-navy)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-ocean)_35%,transparent)]',
      iconLight: 'text-[var(--color-brand-navy)]',
      iconDark: 'text-[var(--color-brand-ice)]',
      glow: '${glassDropShadowClasses}',
    },
    crimson: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-signal-red)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-crimson)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-crimson)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-signal-red)_35%,transparent)]',
      iconLight: 'text-[var(--color-brand-crimson)]',
      iconDark: 'text-[var(--color-brand-signal-red)]',
      glow: '${glassDropShadowClasses}',
    },
    teal: {
      gradient:
        'from-[color:color-mix(in_srgb,var(--color-brand-mint)_55%,transparent)] via-[color:color-mix(in_srgb,var(--color-brand-teal)_25%,transparent)] to-[color:color-mix(in_srgb,var(--color-brand-teal)_5%,transparent)]',
      ring: 'ring-[color:color-mix(in_srgb,var(--color-brand-mint)_35%,transparent)]',
      iconLight: 'text-[var(--color-brand-teal)]',
      iconDark: 'text-[var(--color-brand-mint)]',
      glow: '${glassDropShadowClasses}',
    },
  },
} as const;

const effectLight = {
  successGlow: generatedTokens.color['effect-success-glow'].$value.hex,
  dangerGlow: generatedTokens.color['effect-danger-glow'].$value.hex,
};

const effectDark = {
  successGlow: generatedTokens.color['effect-success-glow-dark'].$value.hex,
  dangerGlow: generatedTokens.color['effect-danger-glow-dark'].$value.hex,
};

const themeColors = {
  light: { chart: chartThemeLight, semantic: semanticLight, effect: effectLight },
  dark: { chart: chartThemeDark, semantic: semanticDark, effect: effectDark },
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

export const rotatableCategoryAccents = categoryAccents.filter(
  (accent) => !ROTATION_EXCLUDED_CATEGORY_ACCENT_KEYS.has(accent.key)
);

export function getCategoryAccentByKey(key: string): CategoryTheme {
  return categoryAccents.find((accent) => accent.key === key) ?? categoryAccents[0];
}

export function getCategoryAccentByIndex(index: number): CategoryTheme {
  const normalizedIndex =
    ((index % rotatableCategoryAccents.length) + rotatableCategoryAccents.length) %
    rotatableCategoryAccents.length;
  return rotatableCategoryAccents[normalizedIndex];
}

export function getCategoryAccent(name?: string | null, index?: number): CategoryTheme {
  if (index != null) {
    return getCategoryAccentByIndex(index);
  }
  const key = (name || 'Uncategorized').toLowerCase();
  return rotatableCategoryAccents[hashString(key) % rotatableCategoryAccents.length];
}

export function getHeroAccentForCategoryKey(categoryKey: string): HeroAccent {
  const map: Record<string, HeroAccent> = {
    sky: 'azure',
    emerald: 'teal',
    cyan: 'azure',
    violet: 'ocean',
    amber: 'amber',
    rose: 'crimson',
    indigo: 'ocean',
    fuchsia: 'azure',
    teal: 'teal',
    lime: 'teal',
    orange: 'amber',
    pink: 'crimson',
    slate: 'slate',
    coral: 'crimson',
    mint: 'teal',
  };
  return map[categoryKey] ?? 'teal';
}

export function getHeroAccentTheme(accent: HeroAccent): HeroAccentTheme {
  return heroAccents[accent];
}

export const _categoryChipClasses = [
  ...categoryPill.surface,
  ...categoryPill.border,
  ...categoryPill.chipSurface,
  ...categoryPill.chipSurfaceSelected,
  ...categoryPill.text,
  ...categoryPill.dot,
  ...categoryPill.ring,
  '--category-accent',
  '--category-accent-bright',
] as const;
