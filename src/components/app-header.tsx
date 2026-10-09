import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import brandIcon from '@/app/icon.png';
import ThemeToggle from './theme-toggle';

export default function AppHeader({
  context,
  children,
}: {
  context?: string;
  children?: ReactNode;
}) {
  return (
    <header className="min-h-14 border-b border-border-soft bg-surface text-ink">
      <div className="mx-auto flex min-h-14 w-[calc(100%-32px)] max-w-[1440px] flex-wrap items-center justify-between gap-2 py-1 sm:w-[calc(100%-48px)] sm:flex-nowrap sm:gap-4 sm:py-0">
        <Link
          className="inline-flex shrink-0 items-center gap-2 text-base font-semibold text-ink no-underline"
          href="/"
          aria-label="CappyCode home"
        >
          <Image src={brandIcon} width={28} height={28} alt="" priority />
          <span>CappyCode</span>
        </Link>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:gap-3">
          {context ? (
            <span className="hidden items-center gap-1.5 whitespace-nowrap text-sm text-muted sm:inline-flex">
              {context}
            </span>
          ) : null}
          <ThemeToggle />
          <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:gap-3 [&_a]:text-sm [&_a]:text-muted [&_a]:underline-offset-4 [&_a:hover]:text-accent-hover [&_a:hover]:underline [&_button:not(.theme-toggle)]:min-h-11 [&_button:not(.theme-toggle)]:px-2 [&_button:not(.theme-toggle)]:text-sm [&_button:not(.theme-toggle)]:text-ink [&_button:not(.theme-toggle)]:hover:bg-hover [&_button:not(.theme-toggle)]:disabled:cursor-default [&_button:not(.theme-toggle)]:disabled:text-muted [&_nav]:flex [&_nav]:flex-wrap [&_nav]:items-center [&_nav]:justify-end [&_nav]:gap-2 sm:[&_nav]:flex-nowrap sm:[&_nav]:gap-3">
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}
