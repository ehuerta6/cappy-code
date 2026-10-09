// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProblemBankFilters } from '@/lib/problem-bank-filters';
import ProblemBankFilters from './problem-bank-filters';

describe('ProblemBankFilters', () => {
  afterEach(() => cleanup());
  it('labels controls, exposes active state, updates without navigation, and clears all groups', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ProblemBankFilters
        value={emptyProblemBankFilters}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Difficulty'));
    fireEvent.click(screen.getByLabelText('Medium'));
    expect(onChange).toHaveBeenCalledWith({
      ...emptyProblemBankFilters,
      difficulty: ['medium'],
    });
    rerender(
      <ProblemBankFilters
        value={{
          ...emptyProblemBankFilters,
          difficulty: ['easy', 'medium'],
          branch: ['general'],
        }}
        onChange={onChange}
      />,
    );
    expect(screen.queryByText('No filters active.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all (2)' }));
    expect(onChange).toHaveBeenLastCalledWith(emptyProblemBankFilters);
    rerender(
      <ProblemBankFilters
        value={emptyProblemBankFilters}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('CIC branch')).toBeTruthy();
    expect(screen.getByText('DSA / algorithm')).toBeTruthy();
  });

  it('keeps only one filter menu open and dismisses it outside or with Escape', () => {
    render(
      <ProblemBankFilters value={emptyProblemBankFilters} onChange={vi.fn()} />,
    );
    const difficulty = screen.getByRole('button', { name: 'Difficulty' });
    const category = screen.getByRole('button', { name: 'Category' });
    fireEvent.click(difficulty);
    expect(
      screen.getByRole('group', { name: 'Difficulty options' }),
    ).toBeTruthy();
    fireEvent.click(category);
    expect(
      screen.queryByRole('group', { name: 'Difficulty options' }),
    ).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Category options' }),
    ).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('group', { name: 'Category options' }),
    ).toBeNull();
    fireEvent.click(difficulty);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('group', { name: 'Difficulty options' }),
    ).toBeNull();
    expect(document.activeElement).toBe(difficulty);
  });

  it('uses a bounded scrolling panel for the long DSA option list', () => {
    render(
      <ProblemBankFilters value={emptyProblemBankFilters} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'DSA / algorithm' }));
    const panel = screen.getByRole('group', {
      name: 'DSA / algorithm options',
    });
    expect(panel.className).toContain('max-h-');
    expect(panel.className).toContain('overflow-y-auto');
  });
});
