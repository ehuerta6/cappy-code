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
    fireEvent.change(screen.getByLabelText('Difficulty'), {
      target: { value: 'medium' },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...emptyProblemBankFilters,
      difficulty: 'medium',
    });
    rerender(
      <ProblemBankFilters
        value={{
          ...emptyProblemBankFilters,
          difficulty: 'medium',
          branch: 'general',
        }}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByText(
        '2 active filters; selected groups are combined with AND.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all (2)' }));
    expect(onChange).toHaveBeenLastCalledWith(emptyProblemBankFilters);
    expect(screen.getByLabelText('CIC branch')).toBeTruthy();
    expect(screen.getByLabelText('DSA / algorithm')).toBeTruthy();
  });
});
