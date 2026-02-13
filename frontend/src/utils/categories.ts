export function formatCategoryName(categoryPrimary: string | undefined | null): string {
  if (!categoryPrimary) return 'Other';
  return categoryPrimary
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const PILL_TYPOGRAPHY = 'text-[0.6rem] font-bold uppercase tracking-[0.18em]';

const TAG_THEMES = [
  {
    key: 'sky',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-sky-100 border border-sky-200/70 dark:border-sky-400/30 shadow-[0_18px_52px_-34px_rgba(14,165,233,0.55)] bg-[linear-gradient(130deg,_rgba(14,165,233,0.24),_rgba(14,165,233,0.08))] dark:bg-[linear-gradient(130deg,_rgba(56,189,248,0.18),_rgba(56,189,248,0.06))]`,
    dot: 'bg-sky-500/90 dark:bg-sky-300/85',
    ring: 'ring-sky-400',
    ringHex: '#38bdf8',
  },
  {
    key: 'emerald',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-emerald-100 border border-emerald-200/70 dark:border-emerald-400/30 shadow-[0_18px_52px_-34px_rgba(16,185,129,0.55)] bg-[linear-gradient(130deg,_rgba(16,185,129,0.26),_rgba(16,185,129,0.08))] dark:bg-[linear-gradient(130deg,_rgba(34,197,94,0.2),_rgba(34,197,94,0.07))]`,
    dot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
    ring: 'ring-emerald-400',
    ringHex: '#34d399',
  },
  {
    key: 'cyan',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-cyan-100 border border-cyan-200/70 dark:border-cyan-400/30 shadow-[0_18px_52px_-34px_rgba(6,182,212,0.52)] bg-[linear-gradient(130deg,_rgba(6,182,212,0.25),_rgba(6,182,212,0.08))] dark:bg-[linear-gradient(130deg,_rgba(34,211,238,0.18),_rgba(34,211,238,0.06))]`,
    dot: 'bg-cyan-500/90 dark:bg-cyan-300/80',
    ring: 'ring-cyan-400',
    ringHex: '#22d3ee',
  },
  {
    key: 'violet',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-violet-100 border border-violet-200/70 dark:border-violet-400/30 shadow-[0_18px_52px_-34px_rgba(139,92,246,0.54)] bg-[linear-gradient(130deg,_rgba(139,92,246,0.24),_rgba(139,92,246,0.08))] dark:bg-[linear-gradient(130deg,_rgba(167,139,250,0.2),_rgba(167,139,250,0.06))]`,
    dot: 'bg-violet-500/90 dark:bg-violet-300/80',
    ring: 'ring-violet-400',
    ringHex: '#a78bfa',
  },
  {
    key: 'amber',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-amber-100 border border-amber-200/70 dark:border-amber-400/30 shadow-[0_18px_52px_-34px_rgba(245,158,11,0.5)] bg-[linear-gradient(130deg,_rgba(245,158,11,0.26),_rgba(245,158,11,0.1))] dark:bg-[linear-gradient(130deg,_rgba(251,191,36,0.24),_rgba(251,191,36,0.08))]`,
    dot: 'bg-amber-500/90 dark:bg-amber-300/85',
    ring: 'ring-amber-400',
    ringHex: '#fbbf24',
  },
  {
    key: 'rose',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-rose-100 border border-rose-200/70 dark:border-rose-400/30 shadow-[0_18px_52px_-34px_rgba(244,63,94,0.5)] bg-[linear-gradient(130deg,_rgba(244,63,94,0.26),_rgba(244,63,94,0.1))] dark:bg-[linear-gradient(130deg,_rgba(251,113,133,0.22),_rgba(251,113,133,0.07))]`,
    dot: 'bg-rose-500/90 dark:bg-rose-300/80',
    ring: 'ring-rose-400',
    ringHex: '#fb7185',
  },
  {
    key: 'indigo',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-indigo-100 border border-indigo-200/70 dark:border-indigo-400/30 shadow-[0_18px_52px_-34px_rgba(99,102,241,0.5)] bg-[linear-gradient(130deg,_rgba(99,102,241,0.26),_rgba(99,102,241,0.08))] dark:bg-[linear-gradient(130deg,_rgba(129,140,248,0.2),_rgba(129,140,248,0.06))]`,
    dot: 'bg-indigo-500/90 dark:bg-indigo-300/80',
    ring: 'ring-indigo-400',
    ringHex: '#818cf8',
  },
  {
    key: 'fuchsia',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-fuchsia-100 border border-fuchsia-200/70 dark:border-fuchsia-400/30 shadow-[0_18px_52px_-34px_rgba(232,121,249,0.5)] bg-[linear-gradient(130deg,_rgba(232,121,249,0.26),_rgba(232,121,249,0.1))] dark:bg-[linear-gradient(130deg,_rgba(217,70,239,0.2),_rgba(217,70,239,0.06))]`,
    dot: 'bg-fuchsia-500/90 dark:bg-fuchsia-300/80',
    ring: 'ring-fuchsia-400',
    ringHex: '#e879f9',
  },
  {
    key: 'teal',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-teal-100 border border-teal-200/70 dark:border-teal-400/30 shadow-[0_18px_52px_-34px_rgba(20,184,166,0.5)] bg-[linear-gradient(130deg,_rgba(20,184,166,0.25),_rgba(20,184,166,0.09))] dark:bg-[linear-gradient(130deg,_rgba(45,212,191,0.2),_rgba(45,212,191,0.06))]`,
    dot: 'bg-teal-500/90 dark:bg-teal-300/80',
    ring: 'ring-teal-400',
    ringHex: '#2dd4bf',
  },
  {
    key: 'lime',
    tag: `${PILL_TYPOGRAPHY} text-slate-800 dark:text-lime-100 border border-lime-200/70 dark:border-lime-400/30 shadow-[0_18px_52px_-34px_rgba(132,204,22,0.48)] bg-[linear-gradient(130deg,_rgba(132,204,22,0.26),_rgba(132,204,22,0.1))] dark:bg-[linear-gradient(130deg,_rgba(163,230,53,0.2),_rgba(163,230,53,0.06))]`,
    dot: 'bg-lime-500/90 dark:bg-lime-300/80',
    ring: 'ring-lime-400',
    ringHex: '#a3e635',
  },
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getTagThemeForCategory(name?: string | null) {
  const key = (name || 'Uncategorized').toLowerCase();
  const idx = hashString(key) % TAG_THEMES.length;
  return TAG_THEMES[idx];
}
