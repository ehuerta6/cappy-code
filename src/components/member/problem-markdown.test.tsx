// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ProblemMarkdown from './problem-markdown';

afterEach(() => cleanup());

describe('ProblemMarkdown', () => {
  it('keeps text-only Markdown and renders HTTPS images inline with alt text', () => {
    const { container, getByAltText, getByText } = render(
      <ProblemMarkdown>
        {'Read the diagram.\n\n![Binary tree](https://example.com/tree.webp)'}
      </ProblemMarkdown>,
    );
    expect(getByText('Read the diagram.')).toBeTruthy();
    const image = getByAltText('Binary tree') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://example.com/tree.webp');
    expect(image.className).toContain('max-w-full');
    expect(image.className).toContain('h-auto');
    expect(container.querySelector('.problem-markdown script')).toBeNull();
  });

  it('omits unsafe image URLs and keeps raw HTML disabled', () => {
    const { container } = render(
      <ProblemMarkdown>
        {
          '<img src="https://example.com/html.png"><script>bad()</script>\n\n![Unsafe](javascript:alert(1))\n\n![HTTP](http://example.com/a.png)'
        }
      </ProblemMarkdown>,
    );
    expect(container.querySelector('.problem-markdown script')).toBeNull();
    expect(container.querySelectorAll('.problem-markdown img')).toHaveLength(0);
    expect(container.querySelector('.problem-markdown [onerror]')).toBeNull();
  });

  it('does not parse images from text-only descriptions as markup', () => {
    const { container, getByText } = render(
      <ProblemMarkdown>{'A problem without an image.'}</ProblemMarkdown>,
    );
    expect(getByText('A problem without an image.')).toBeTruthy();
    expect(container.querySelector('.problem-markdown img')).toBeNull();
  });

  it('keeps surrounding Problem text available when an image fails to load', () => {
    const { getByAltText, getByText } = render(
      <ProblemMarkdown>
        {
          'The graph is below.\n\n![Connected graph](https://example.com/graph.png)\n\nReturn the number of components.'
        }
      </ProblemMarkdown>,
    );
    fireEvent.error(getByAltText('Connected graph'));
    expect(getByText('Image unavailable: Connected graph')).toBeTruthy();
    expect(getByText('The graph is below.')).toBeTruthy();
    expect(getByText('Return the number of components.')).toBeTruthy();
  });
});
