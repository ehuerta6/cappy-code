import { describe, expect, it } from 'vitest';
import { getSharedEditorHeight } from './solution-sizing';

describe('solution sizing', () => {
  it('shares a compact minimum height and grows to the tallest language', () => {
    expect(
      getSharedEditorHeight({
        python: { code: 'print(1)' },
        java: { code: 'return 1;' },
        cpp: { code: 'return 1;' },
      }),
    ).toBe(124);
    expect(
      getSharedEditorHeight({
        python: { code: 'line 1\nline 2\nline 3\nline 4\nline 5' },
        java: { code: 'line 1' },
        cpp: { code: 'line 1' },
      }),
    ).toBe(147);
  });

  it('caps long editors', () => {
    const longCode = Array.from(
      { length: 40 },
      (_, index) => `line ${index}`,
    ).join('\n');
    expect(
      getSharedEditorHeight({
        python: { code: longCode },
        java: { code: 'line 1' },
        cpp: { code: 'line 1' },
      }),
    ).toBe(354);
  });
});
