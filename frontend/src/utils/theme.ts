// Theme utility for managing dark/light mode state
export const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return true; // Default to dark on SSR
  
  // Check localStorage first
  const stored = localStorage.getItem('theme');
  if (stored !== null) {
    return stored === 'dark';
  }
  
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return true;
  }
  
  // Default to dark
  return true;
};

export const setTheme = (isDark: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
};