// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { expect, it, vi } from 'vitest';
import brandIcon from '@/app/icon.png';
import AppHeader from './app-header';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src }: { src: string | { src: string } }) => (
    <span
      aria-hidden="true"
      data-testid="brand-icon"
      data-src={typeof src === 'string' ? src : src.src}
    />
  ),
}));

it('uses the bundled CappyCode icon asset for the brand image', () => {
  render(<AppHeader />);

  expect(screen.getByTestId('brand-icon').getAttribute('data-src')).toBe(
    brandIcon,
  );
});

it('shows both primary destinations and exposes the current location', () => {
  render(<AppHeader current="problem-bank" />);
  const header = within(screen.getAllByRole('banner').at(-1)!);

  expect(
    header.getAllByRole('navigation', { name: 'Member navigation' }).length,
  ).toBeGreaterThan(0);
  expect(
    header
      .getByRole('link', { name: 'Problem Bank' })
      .getAttribute('aria-current'),
  ).toBe('page');
  expect(
    header.getByRole('link', { name: 'Sessions' }).getAttribute('aria-current'),
  ).toBeNull();
  expect(header.getByRole('link', { name: 'Officer login' })).toBeTruthy();
});
