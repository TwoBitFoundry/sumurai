import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const disabledClasses = 'disabled:cursor-not-allowed disabled:opacity-60';
