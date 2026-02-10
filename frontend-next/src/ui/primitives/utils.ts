import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const focusRingClasses =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900';

export const disabledClasses = 'disabled:cursor-not-allowed disabled:opacity-60';

export const transitionClasses = 'transition-all duration-200 ease-out';

export const glassBackdropClasses = 'backdrop-blur-2xl backdrop-saturate-[150%]';
