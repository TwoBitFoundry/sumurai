export function formatCategoryName(categoryPrimary: string | undefined | null): string {
  if (!categoryPrimary) return 'Other';
  return categoryPrimary
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const TAG_THEMES = [
  { key: 'sky',      tag: 'bg-sky-100 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200 border border-sky-300/20 dark:border-sky-300/20', ring: 'ring-sky-400', ringHex: '#38bdf8' },
  { key: 'emerald',  tag: 'bg-emerald-100 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200 border border-emerald-300/20 dark:border-emerald-300/20', ring: 'ring-emerald-400', ringHex: '#34d399' },
  { key: 'cyan',     tag: 'bg-cyan-100 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-200 border border-cyan-300/20 dark:border-cyan-300/20', ring: 'ring-cyan-400', ringHex: '#22d3ee' },
  { key: 'violet',   tag: 'bg-violet-100 dark:bg-violet-400/10 text-violet-800 dark:text-violet-200 border border-violet-300/20 dark:border-violet-300/20', ring: 'ring-violet-400', ringHex: '#a78bfa' },
  { key: 'amber',    tag: 'bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200 border border-amber-300/20 dark:border-amber-300/20', ring: 'ring-amber-400', ringHex: '#fbbf24' },
  { key: 'rose',     tag: 'bg-rose-100 dark:bg-rose-400/10 text-rose-800 dark:text-rose-200 border border-rose-300/20 dark:border-rose-300/20', ring: 'ring-rose-400', ringHex: '#fb7185' },
  { key: 'indigo',   tag: 'bg-indigo-100 dark:bg-indigo-400/10 text-indigo-800 dark:text-indigo-200 border border-indigo-300/20 dark:border-indigo-300/20', ring: 'ring-indigo-400', ringHex: '#818cf8' },
  { key: 'fuchsia',  tag: 'bg-fuchsia-100 dark:bg-fuchsia-400/10 text-fuchsia-800 dark:text-fuchsia-200 border border-fuchsia-300/20 dark:border-fuchsia-300/20', ring: 'ring-fuchsia-400', ringHex: '#e879f9' },
  { key: 'teal',     tag: 'bg-teal-100 dark:bg-teal-400/10 text-teal-800 dark:text-teal-200 border border-teal-300/20 dark:border-teal-300/20', ring: 'ring-teal-400', ringHex: '#2dd4bf' },
  { key: 'lime',     tag: 'bg-lime-100 dark:bg-lime-400/10 text-lime-800 dark:text-lime-200 border border-lime-300/20 dark:border-lime-300/20', ring: 'ring-lime-400', ringHex: '#a3e635' },
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

