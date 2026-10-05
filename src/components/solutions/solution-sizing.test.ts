import { describe, expect, it } from 'vitest';
import { getOutputHeight, getSharedEditorHeight } from './solution-sizing';

describe('solution sizing', () => {
  it('shares a compact minimum height and grows to the tallest language', () => {
    expect(
      getSharedEditorHeight({
        python: { code: 'print(1)', output: '' },
        java: { code: 'return 1;', output: '' },
        cpp: { code: 'return 1;', output: '' },
      }),
    ).toBe(124);
    expect(
      getSharedEditorHeight({
        python: { code: 'line 1\nline 2\nline 3\nline 4\nline 5', output: '' },
        java: { code: 'line 1', output: '' },
        cpp: { code: 'line 1', output: '' },
      }),
    ).toBe(147);
  });

  it('caps long editors and prepared output', () => {
    const longCode = Array.from(
      { length: 40 },
      (_, index) => `line ${index}`,
    ).join('\n');
    const longOutput = Array.from(
      { length: 40 },
      (_, index) => `line ${index}`,
    ).join('\n');
    expect(
      getSharedEditorHeight({
        python: { code: longCode, output: '' },
        java: { code: 'line 1', output: '' },
        cpp: { code: 'line 1', output: '' },
      }),
    ).toBe(354);
    expect(getOutputHeight('1')).toBe(48);
    expect(getOutputHeight(longOutput)).toBe(230);
  });
});
