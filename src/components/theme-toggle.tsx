'use client';

import { useState } from 'react';
import { useColorTheme, type ColorTheme } from './theme-provider';

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
      className="theme-toggle inline-flex min-h-11 w-11 items-center justify-center gap-2 rounded border border-border-strong bg-surface px-0 text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto sm:px-2.5"
      type="button"
      aria-label="Toggle color theme"
      aria-pressed={theme === null ? undefined : theme === 'dark'}
      onClick={toggle}
    >
      <span className="text-lg leading-none text-accent" aria-hidden="true">
        {theme === 'dark' ? '☾' : theme === 'light' ? '☼' : '◐'}
      </span>
      <span className="hidden text-sm sm:inline">
        {theme ? `${theme === 'dark' ? 'Dark' : 'Light'} mode` : 'Theme'}
      </span>
    </button>
  );
}
