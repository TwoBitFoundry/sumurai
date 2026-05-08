export type SemanticTextRole =
  | 'primary'
  | 'body'
  | 'muted'
  | 'subtle'
  | 'label'
  | 'inverse'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info';

export const semanticTextRecipes = {
  primary: 'text-slate-900 dark:text-slate-100',
  body: 'text-slate-700 dark:text-slate-300',
  muted: 'text-slate-600 dark:text-slate-400',
  subtle: 'text-slate-500 dark:text-slate-500',
  label: 'text-slate-600 dark:text-slate-400',
  inverse: 'text-white dark:text-white',
  accent: 'text-sky-600 dark:text-sky-300',
  danger: 'text-red-600 dark:text-red-300',
  success: 'text-emerald-600 dark:text-emerald-300',
  warning: 'text-amber-600 dark:text-amber-300',
  info: 'text-sky-600 dark:text-sky-300',
} as const satisfies Record<SemanticTextRole, string>;
