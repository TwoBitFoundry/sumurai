export const onboardingTokenRecipes = {
  shell: [
    'group relative overflow-hidden border border-[#e2e8f0] bg-white shadow-sm',
    'transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] hover:border-[#93c5fd]',
    'dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8] dark:hover:shadow-[0_20px_56px_-40px_rgba(2,6,23,0.65)]',
  ],
  stepCard: [
    'group relative overflow-hidden border border-[#e2e8f0] bg-white shadow-sm',
    'transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] hover:border-[#93c5fd]',
    'dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8] dark:hover:shadow-[0_20px_56px_-40px_rgba(2,6,23,0.65)]',
    'flex h-full flex-col items-center justify-start rounded-xl px-4 py-4 text-center',
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
    'group relative overflow-hidden border border-[#e2e8f0] bg-white shadow-sm',
    'transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] hover:border-[#93c5fd]',
    'dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8] dark:hover:shadow-[0_20px_56px_-40px_rgba(2,6,23,0.65)]',
    'flex h-full items-start gap-4 rounded-2xl p-4 text-[13px]',
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
} as const;
