'use client';

import { useState } from 'react';
import { useColorTheme, type ColorTheme } from './theme-provider';
import { Button } from './ui/primitives';

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
    <Button
      variant="secondary"
      className="theme-toggle h-11 w-11 gap-2 px-0 sm:w-auto sm:px-2.5"
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
    </Button>
  );
}
