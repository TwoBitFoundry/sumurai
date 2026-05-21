import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { ThemeColors, ThemeMode, ThemePreference } from '@/ui/tokens';
import { getThemeColors } from '@/ui/tokens';
import { getSessionThemePreference, setSessionThemePreference } from '@/utils/sessionPreferences';

export type { ThemePreference } from '@/ui/tokens';

interface ThemeContextType {
  preference: ThemePreference;
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
  setPreference: (preference: ThemePreference) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialPreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';

  return getSessionThemePreference() ?? 'system';
};

const resolveThemeMode = (preference: ThemePreference, systemMode: ThemeMode): ThemeMode => {
  return preference === 'system' ? systemMode : preference;
};

const applyTheme = (resolvedMode: ThemeMode) => {
  if (typeof window === 'undefined') return;

  document.documentElement.classList.toggle('dark', resolvedMode === 'dark');
  document.documentElement.style.colorScheme = resolvedMode;
};

interface ThemeProviderProps {
  children: ReactNode;
  initialPreference?: ThemePreference;
}

export function ThemeProvider({ children, initialPreference }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    initialPreference !== undefined ? initialPreference : getInitialPreference()
  );
  const [systemMode, setSystemMode] = useState<ThemeMode>(() => getSystemTheme());

  useEffect(() => {
    if (initialPreference !== undefined) {
      setPreferenceState(initialPreference);
      if (initialPreference === 'system') {
        setSystemMode(getSystemTheme());
      }
    }
  }, [initialPreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSessionThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== 'system') {
      return;
    }

    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemMode = () => {
      setSystemMode(mediaQuery.matches ? 'dark' : 'light');
    };

    syncSystemMode();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', syncSystemMode);
      return () => mediaQuery.removeEventListener('change', syncSystemMode);
    }

    return undefined;
  }, [preference]);

  const resolvedMode = resolveThemeMode(preference, systemMode);

  useEffect(() => {
    applyTheme(resolvedMode);
  }, [resolvedMode]);

  const setPreference = useCallback((newPreference: ThemePreference) => {
    setPreferenceState(newPreference);
    setSystemMode(newPreference === 'system' ? getSystemTheme() : newPreference);
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setPreferenceState(mode);
    setSystemMode(mode);
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((currentPreference) => {
      const currentMode = resolveThemeMode(currentPreference, systemMode);
      return currentMode === 'dark' ? 'light' : 'dark';
    });
  }, [systemMode]);

  const colors = getThemeColors(resolvedMode);

  return (
    <ThemeContext.Provider
      value={{ preference, mode: resolvedMode, toggle, setMode, setPreference, colors }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
