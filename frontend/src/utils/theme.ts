/**
 * @deprecated Use ThemeProvider and useTheme hook from @/context/ThemeContext instead.
 * This utility is maintained for backward compatibility only.
 */
export const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return true;

  const stored = localStorage.getItem('theme');
  if (stored !== null) {
    return stored === 'dark';
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return true;
  }

  return true;
};

/**
 * @deprecated Use ThemeProvider and useTheme hook from @/context/ThemeContext instead.
 * This utility is maintained for backward compatibility only.
 */
export const setTheme = (isDark: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
};