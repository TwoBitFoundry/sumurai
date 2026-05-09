import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
} from '@/ui/recipes';
import { designTokens } from '@/ui/tokens';

export const dashboardTokenRecipes = {
  cardShell: [
    'rounded-lg border transition-all duration-300',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
  ],
  cardShellActive: [
    'rounded-lg border transition-all duration-300 -translate-y-[2px]',
    ...semanticBorders.default,
    ...semanticSurfaces.hoverRow,
    ...semanticEffects.glassShadow,
  ],
  loadingCard: [
    'min-h-[220px] rounded-xl border animate-pulse',
    ...semanticBorders.subtle,
    ...semanticSurfaces.mutedChip,
  ],
  merchantRow: [
    'flex items-center justify-between rounded-lg border p-3 transition-all duration-300 hover:-translate-y-[2px]',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.accentHover,
  ],
  summaryShell: [
    'rounded-xl border p-4 transition-all duration-300',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
  ],
  summaryShellLoading: [
    'h-16 rounded-xl border',
    ...semanticBorders.subtle,
    ...semanticSurfaces.mutedChip,
  ],
  hoverInfoShell: [
    'flex flex-wrap items-center gap-3 rounded-lg border p-3',
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
  ],
  toolbarShell: ['border-b px-6 pb-4 pt-6', ...semanticBorders.subtle],
  floatingRangeShell: [
    'flex gap-2 rounded-2xl border px-3 py-2',
    ...semanticBorders.glass,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
    'backdrop-blur-md',
    'backdrop-saturate-[150%]',
  ],
  tableHeader: [
    ...semanticSurfaces.mutedChip,
    designTokens.text.body,
    'transition-colors duration-500',
  ],
  tableFooter: [
    'border-t px-4 py-4 transition-colors duration-500',
    ...semanticBorders.glass,
    ...semanticSurfaces.card,
    ...semanticEffects.glassShadow,
    'backdrop-blur-md',
    'backdrop-saturate-[150%]',
  ],
} as const;
