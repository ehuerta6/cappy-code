import { describe, expect, it } from 'vitest';
import { getProblemReadiness } from './preparation-readiness';

const problem = {
  title: 'Pair Sum',
  description: 'Find a pair.',
  exampleInput: '[1, 2]',
  exampleOutput: '3',
};
const solution = (python: string, java: string, cpp: string) => ({
  id: 'a',
  name: 'Hash Map',
  tags: [],
  order: 0,
  solutions: {
    python: { code: python },
    java: { code: java },
    cpp: { code: cpp },
  },
});

describe('problem preparation readiness', () => {
  it('accepts useful content with one prepared language and warns about the others', () => {
    expect(
      getProblemReadiness(problem, [solution('code', '', '')]),
    ).toMatchObject({
      warnings: ['Hash Map: Java, C++ not prepared'],
      approaches: [{ missingLanguages: ['java', 'cpp'] }],
    });
  });

  it('warns for placeholder title, missing description and examples, and zero approaches', () => {
    expect(
      getProblemReadiness(
        {
          title: 'Untitled Problem',
          description: '',
          exampleInput: '',
          exampleOutput: '',
        },
        [],
      ),
    ).toMatchObject({
      warnings: [
        'Add a meaningful title',
        'Add a description',
        'Add example input',
        'Add example output',
        'Add an Approach',
      ],
    });
  });

  it('accepts all languages across multiple approaches and calls out an empty approach', () => {
    const result = getProblemReadiness(problem, [
      solution('py', 'java', 'cpp'),
      { ...solution('', '', ''), id: 'b', name: 'Two Pointers' },
    ]);
    expect(result.warnings).toEqual(['Two Pointers: no Solutions prepared']);
    expect(result.approaches).toHaveLength(2);
  });
});
