import { describe, expect, it } from 'vitest';
import { containsDuplicateProgram } from './fixtures/contains-duplicate';
import { twoSumProgram } from './fixtures/two-sum';

describe('CappyCode translation IR fixtures', () => {
  it('represents a class method and map-based two-sum algorithm', () => {
    const solution = twoSumProgram.declarations[0];

    expect(solution.kind).toBe('class');
    if (solution.kind !== 'class') return;

    expect(solution.methods[0].name).toBe('twoSum');
    expect(solution.methods[0].parameters.map(({ type }) => type.kind)).toEqual(
      ['array', 'integer'],
    );
    const loop = solution.methods[0].body[1];

    expect(loop.kind).toBe('for');
    if (loop.kind !== 'for') return;
    expect(loop.condition?.kind).toBe('binary');
  });

  it('represents set membership and boolean return values', () => {
    const containsDuplicate = containsDuplicateProgram.declarations[0];

    expect(containsDuplicate.kind).toBe('function');
    if (containsDuplicate.kind !== 'function') return;

    expect(containsDuplicate.returnType).toEqual({ kind: 'boolean' });
    expect(containsDuplicate.body.map(({ kind }) => kind)).toEqual([
      'variableDeclaration',
      'forEach',
      'return',
    ]);
  });
});
