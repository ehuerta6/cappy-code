import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import brandIcon from '@/app/icon.png';
import ThemeToggle from './theme-toggle';

export default function AppHeader({
  context,
  mode = 'member',
  current = 'sessions',
  children,
}: {
  context?: string;
  mode?: 'member' | 'officer' | 'login';
  current?: 'sessions' | 'problem-bank';
  children?: ReactNode;
}) {
  const officer = mode === 'officer';
  const navigation = officer
    ? [
        {
          label: 'Sessions',
          href: '/officer',
          current: current === 'sessions',
        },
        {
          label: 'Problem Bank',
          href: '/officer/problem-bank',
          current: current === 'problem-bank',
        },
      ]
    : [
        { label: 'Sessions', href: '/', current: current === 'sessions' },
        {
          label: 'Problem Bank',
          href: '/problem-bank',
          current: current === 'problem-bank',
        },
      ];

  return (
    <header className="min-h-14 border-b border-border-soft bg-surface text-ink">
      <div className="mx-auto flex min-h-14 w-[calc(100%-32px)] max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 py-2 sm:w-[calc(100%-48px)] sm:flex-nowrap sm:gap-4 sm:py-0">
        <Link
          className="inline-flex min-h-11 min-w-0 shrink-0 items-center gap-2 text-base font-semibold text-ink no-underline"
          href="/"
          aria-label="CappyCode home"
        >
          <Image src={brandIcon} width={28} height={28} alt="" priority />
          <span>CappyCode</span>
        </Link>
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:ml-0 sm:gap-3">
          {context ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-muted">
              {context}
            </span>
          ) : null}
          <ThemeToggle />
        </div>
        {mode !== 'login' && (
          <nav
            className="order-3 flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-soft pt-2 text-sm sm:order-2 sm:ml-auto sm:w-auto sm:justify-end sm:gap-x-4 sm:border-0 sm:pt-0"
            aria-label={officer ? 'Officer navigation' : 'Member navigation'}
          >
            {navigation.map(({ label, href, current: isCurrent }) => (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`ui-header-link ${isCurrent ? 'ui-header-link--current' : ''}`}
              >
                {label}
              </Link>
            ))}
            {mode === 'member' && (
              <Link href="/officer" className="ui-header-link">
                Officer login
              </Link>
            )}
            {children ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:ml-1 sm:border-l sm:border-border-soft sm:pl-3">
                {children}
              </div>
            ) : null}
          </nav>
        )}
        {mode === 'login' && children ? (
          <nav
            className="order-3 flex w-full flex-wrap items-center gap-2 border-t border-border-soft pt-2 sm:order-2 sm:ml-auto sm:w-auto sm:justify-end sm:border-0 sm:pt-0"
            aria-label="Officer navigation"
          >
            {children}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
