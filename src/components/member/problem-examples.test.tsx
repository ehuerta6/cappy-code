// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProblemExamples from './problem-examples';

describe('ProblemExamples', () => {
  it('renders the same literal example hierarchy and preserves authored text', () => {
    const input = 'first line\n**literal value** <tag> & value';
    const output = '[1, 2]\n"done"';
    render(
      <ProblemExamples
        id="problem-1"
        input={input}
        output={output}
        headingLevel={2}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Examples' }).tagName).toBe(
      'H2',
    );
    expect(screen.getByRole('heading', { name: 'Input' }).tagName).toBe('H3');
    expect(
      screen.getByRole('heading', { name: 'Expected output' }).tagName,
    ).toBe('H3');
    const examples = Array.from(document.querySelectorAll('pre'));
    expect(examples.map((example) => example.textContent)).toEqual([
      input,
      output,
    ]);
    expect(
      screen.queryByText('literal value', { selector: 'strong' }),
    ).toBeNull();
  });
});
