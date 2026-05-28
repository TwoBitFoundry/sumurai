export const transactionsRowRecipes = {
  shell: [
    'group relative border-b border-slate-200/70 transition-colors duration-150 ease-out hover:ring-2 hover:ring-sky-400/60',
    'dark:border-slate-700/50 dark:hover:ring-sky-400/50',
  ],
  placeholder: [
    'pointer-events-none',
    'select-none',
    'border-b',
    'border-slate-200/70',
    'dark:border-slate-700/50',
  ],
  placeholderDesktopHeight: ['h-[3.75rem]'],
  placeholderMobileHeight: ['min-h-[5.25rem]'],
  odd: [
    'bg-[color:color-mix(in_srgb,var(--color-surface-muted-chip)_40%,transparent)]',
    'dark:bg-slate-700/20',
  ],
  even: ['bg-transparent', 'dark:bg-transparent'],
  merchantEllipsis: ['min-w-0', 'overflow-hidden', 'text-ellipsis', 'whitespace-nowrap'],
  merchantCell: ['max-w-0', 'overflow-hidden', 'text-ellipsis', 'whitespace-nowrap'],
  categoryPill: ['w-full', 'min-w-0', '!justify-start', '!gap-0', 'px-2', 'py-0'],
  categoryFilterPill: ['px-2', 'py-0'],
  categoryLabel: ['min-w-0', 'flex-1', 'truncate', 'text-center'],
  categoryChevron: ['ml-1', 'shrink-0'],
} as const;
