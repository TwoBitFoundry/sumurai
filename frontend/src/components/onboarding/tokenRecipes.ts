import {
  font as primitiveTypographyRecipes,
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
} from '@/ui/recipes';

export const onboardingTokenRecipes = {
  shell: [
    'group relative overflow-hidden',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
    'transition-all duration-300 ease-out hover:-translate-y-[2px]',
    ...semanticEffects.accentHover,
  ],
  stepCard: [
    'group relative overflow-hidden',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
    'transition-all duration-300 ease-out hover:-translate-y-[2px]',
    ...semanticEffects.accentHover,
    'flex h-full flex-col items-center justify-start rounded-xl px-4 py-4 text-center',
  ],
  iconWell: [
    'relative z-10 inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full',
    ...semanticSurfaces.insetWell,
    'ring-1 ring-inset',
  ],
  iconWellLarge: [
    'relative z-10 inline-flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full',
    ...semanticSurfaces.insetWell,
    'ring-1 ring-inset',
  ],
  providerRow: [
    'group relative overflow-hidden',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
    'transition-all duration-300 ease-out hover:-translate-y-[2px]',
    ...semanticEffects.accentHover,
    'flex h-full items-start gap-4 rounded-2xl p-4 text-[13px]',
  ],
  titleStrong: ['relative z-10 mt-3', primitiveTypographyRecipes.bodyStrong, 'dark:text-white'],
  titleStrongInline: [primitiveTypographyRecipes.bodyStrong, 'dark:text-white'],
  bodyMuted: ['relative z-10 mt-1', primitiveTypographyRecipes.caption, 'dark:text-[#cbd5e1]'],
  rowBodyMuted: [primitiveTypographyRecipes.caption, 'dark:text-[#cbd5e1]'],
  eyebrowCaps: [
    primitiveTypographyRecipes.label,
    'uppercase transition-colors duration-300 ease-out',
  ],
  previewFrame: [
    'relative aspect-[16/10] overflow-hidden rounded-2xl',
    ...semanticBorders.subtle,
    'bg-[var(--color-surface-overlay)]',
    'shadow-lg sm:aspect-[18/10]',
  ],
  hoverOverlay:
    'pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20',
  providerHoverOverlay:
    'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20',
  iconGlow:
    'absolute inset-[20%] rounded-full bg-[var(--color-effect-accent-hover)] opacity-20 blur-[6px] dark:bg-[var(--color-effect-accent-hover-dark)] dark:opacity-[0.18]',
  providerIconGlow:
    'absolute inset-[18%] rounded-full bg-[var(--color-effect-accent-hover)] opacity-[0.22] blur-[6px] dark:bg-[var(--color-effect-accent-hover-dark)] dark:opacity-[0.18]',
  providerConnect: {
    plaidEyebrowBg: [...semanticStatus.success.surface],
    plaidEyebrowText: [...semanticStatus.success.text],
    tellerEyebrowBg: [...semanticStatus.info.surface],
    tellerEyebrowText: [...semanticStatus.info.text],
  },
} as const;
