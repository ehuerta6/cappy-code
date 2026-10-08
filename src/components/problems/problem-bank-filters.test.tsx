// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptyProblemBankFilters } from '@/lib/problem-bank-filters';
import ProblemBankFilters from './problem-bank-filters';

describe('ProblemBankFilters', () => {
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
    expect(
      screen.getByText(
        '3 selected values across 2 groups; values within each group use OR and groups combine with AND.',
      ),
    ).toBeTruthy();
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
});
