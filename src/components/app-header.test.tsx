// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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
