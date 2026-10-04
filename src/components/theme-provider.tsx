'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';

export type ColorTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'cappycode-theme';

type ThemeContextValue = {
  theme: ColorTheme | null;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isColorTheme(value: string | null | undefined): value is ColorTheme {
  return value === 'light' || value === 'dark';
}

function preferredTheme(): ColorTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ColorTheme | null>(null);

  useLayoutEffect(() => {
    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // The system preference still works when browser storage is unavailable.
    }
    const initialTheme = isColorTheme(savedTheme)
      ? savedTheme
      : preferredTheme();
    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const currentTheme =
      theme ??
      (isColorTheme(document.documentElement.dataset.theme)
        ? document.documentElement.dataset.theme
        : preferredTheme());
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Theme remains usable for the current page without browser storage.
    }
    setTheme(nextTheme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColorTheme() {
  return useContext(ThemeContext);
}
