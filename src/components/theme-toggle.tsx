'use client';

import { useState } from 'react';
import { useColorTheme, type ColorTheme } from './theme-provider';
import styles from './app-header.module.css';

function systemTheme(): ColorTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export default function ThemeToggle() {
  const context = useColorTheme();
  const [fallbackTheme, setFallbackTheme] = useState<ColorTheme | null>(null);
  const theme = context?.theme ?? fallbackTheme;

  function toggle() {
    if (context) {
      context.toggleTheme();
      return;
    }
    const currentTheme =
      theme ??
      (document.documentElement.dataset.theme === 'dark'
        ? 'dark'
        : document.documentElement.dataset.theme === 'light'
          ? 'light'
          : systemTheme());
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    setFallbackTheme(nextTheme);
  }

  return (
    <button
      className={styles.themeToggle}
      type="button"
      aria-label="Toggle color theme"
      aria-pressed={theme === null ? undefined : theme === 'dark'}
      onClick={toggle}
    >
      <span className={styles.themeIcon} aria-hidden="true">
        {theme === 'dark' ? '☾' : theme === 'light' ? '☼' : '◐'}
      </span>
      <span>
        {theme ? `${theme === 'dark' ? 'Dark' : 'Light'} mode` : 'Theme'}
      </span>
    </button>
  );
}
