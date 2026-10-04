import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { twoSumProgram } from '../fixtures/two-sum';
import { javaEmitter } from './emitter';
import { javaParser } from './parser';

describe('Java emitter', () => {
  it('emits readable Java with explicit generic collection types and standard collections', () => {
    const result = javaEmitter.emit(twoSumProgram);

    expect(result.code).toContain('import java.util.ArrayList;');
    expect(result.code).toContain('import java.util.HashMap;');
    expect(result.code).toContain(
      'Map<Integer, Integer> seen = new HashMap<>();',
    );
    expect(result.code).toContain('List<Integer> numbers');
    expect(result.code).toContain('seen.containsKey(complement)');
    expect(result.code).toContain('seen.put(number, index)');
    expect(result.code).toContain(
      'new ArrayList<>(Arrays.asList(seen.get(complement), index))',
    );
    expect(result.code).toContain('return new ArrayList<>();');
  });

  it('emits valid Java from the interview-style Java fixture after parsing it', () => {
    const source = readFileSync(
      new URL('../fixtures/two-sum.java', import.meta.url),
      'utf8',
    );
    const parsed = javaParser.parse(source);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = javaEmitter.emit(parsed.program);
    expect(result.code).toContain('class Solution {');
    expect(result.code).toContain(
      'public List<Integer> twoSum(List<Integer> numbers, int target)',
    );
    expect(result.code).toContain(
      'for (int index = 0; (index < numbers.size()); index = (index + 1))',
    );
    expect(result.code).toContain('seen.containsKey(complement)');
    expect(result.code).toContain('seen.put(numbers.get(index), index)');
  });
});
