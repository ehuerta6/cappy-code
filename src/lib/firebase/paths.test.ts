import { describe, expect, it } from 'vitest';
import { languages } from '../domain';
import { problemPath, sessionPath, solutionPath } from './paths';

describe('Firestore paths', () => {
  it('supports exactly the prepared solution languages', () => {
    expect(languages).toEqual(['python', 'java', 'cpp']);
  });

  it('locates sessions and their problem metadata', () => {
    expect(sessionPath('intro')).toBe('sessions/intro');
    expect(problemPath('intro', 'two-sum')).toBe(
      'sessions/intro/problems/two-sum',
    );
  });

  it.each(languages)(
    'stores %s solutions separately from metadata',
    (language) => {
      expect(solutionPath('intro', 'two-sum', language)).toBe(
        `sessions/intro/problems/two-sum/solutions/${language}`,
      );
    },
  );

  it.each(['', '  ', 'intro/problems'])('rejects invalid IDs: %j', (id) => {
    expect(() => sessionPath(id)).toThrow('document ID');
    expect(() => problemPath('intro', id)).toThrow('document ID');
    expect(() => solutionPath(id, 'two-sum', 'python')).toThrow('document ID');
    expect(() => solutionPath('intro', id, 'python')).toThrow('document ID');
  });
});
