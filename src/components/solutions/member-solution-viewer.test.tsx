// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SolutionApproach } from '@/lib/domain';
import MemberSolutionViewer from './member-solution-viewer';

vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    options,
  }: {
    value: string;
    options: { ariaLabel: string; readOnly: boolean };
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      readOnly={options.readOnly}
      value={value}
    />
  ),
}));

afterEach(() => cleanup());

const approaches: SolutionApproach[] = [
  {
    id: 'map',
    name: 'Hash Map',
    tags: ['Hash Map'],
    order: 0,
    solutions: {
      python: {
        code: 'python map',
        timeComplexity: 'O(n)',
        timeComplexityReason: 'One pass.',
      },
      java: { code: 'java map', timeComplexity: 'O(n log n)' },
      cpp: { code: 'cpp map' },
    },
  },
  {
    id: 'brute',
    name: 'Brute Force',
    tags: [],
    order: 1,
    solutions: {
      python: { code: 'python brute', spaceComplexity: 'O(1)' },
      java: { code: 'java brute' },
      cpp: { code: 'cpp brute' },
    },
  },
];

describe('MemberSolutionViewer', () => {
  it('shows one editor and keeps approach, language, and complexity together', () => {
    const { container } = render(
      <MemberSolutionViewer approaches={approaches} modelPath="member/test" />,
    );

    expect((screen.getByLabelText('Approach') as HTMLSelectElement).value).toBe(
      'map',
    );
    expect((screen.getByLabelText('Language') as HTMLSelectElement).value).toBe(
      'python',
    );
    expect(
      screen.getByLabelText('Python Solution, read-only').textContent,
    ).toBe('python map');
    expect(
      container.querySelectorAll('[aria-label$="Solution, read-only"]'),
    ).toHaveLength(1);
    expect(screen.getByText('Time: O(n)')).toBeTruthy();
    expect(screen.getByText('One pass.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'java' },
    });
    expect(screen.getByLabelText('Java Solution, read-only').textContent).toBe(
      'java map',
    );
    expect(
      container.querySelectorAll('[aria-label$="Solution, read-only"]'),
    ).toHaveLength(1);
    expect(screen.getByText('Time: O(n log n)')).toBeTruthy();
    expect(screen.queryByText('Time: O(n)')).toBeNull();

    fireEvent.change(screen.getByLabelText('Approach'), {
      target: { value: 'brute' },
    });
    expect(screen.getByLabelText('Java Solution, read-only').textContent).toBe(
      'java brute',
    );
    expect(screen.queryByText('Time: O(n log n)')).toBeNull();
  });

  it('identifies a single approach without an interactive approach control', () => {
    render(
      <MemberSolutionViewer
        approaches={[approaches[0]]}
        modelPath="bank/test"
      />,
    );
    expect(
      screen.getByRole('group', { name: 'Approach: Hash Map' }),
    ).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Approach' })).toBeNull();
    expect(screen.getByLabelText('Language')).toBeTruthy();
  });

  it('shows the intentional unavailable state when no approaches exist', () => {
    render(<MemberSolutionViewer approaches={[]} modelPath="member/empty" />);
    expect(screen.getByRole('status').textContent).toContain(
      'No solution approaches',
    );
    expect(screen.queryByRole('combobox', { name: 'Language' })).toBeNull();
  });
});
