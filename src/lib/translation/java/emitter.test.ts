import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { containsDuplicateProgram } from '../fixtures/contains-duplicate';
import { twoSumProgram } from '../fixtures/two-sum';
import type { Program } from '../ir';
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

  it('uses map put and list set for neutral IR index assignments', () => {
    const program = {
      kind: 'program',
      declarations: [
        {
          kind: 'function',
          name: 'updateCollections',
          parameters: [
            {
              name: 'numbers',
              type: { kind: 'array', elementType: { kind: 'integer' } },
            },
            { name: 'index', type: { kind: 'integer' } },
            {
              name: 'positions',
              type: {
                kind: 'map',
                keyType: { kind: 'integer' },
                valueType: { kind: 'integer' },
              },
            },
            { name: 'key', type: { kind: 'integer' } },
          ],
          returnType: { kind: 'void' },
          body: [
            {
              kind: 'assignment',
              target: {
                kind: 'index',
                collection: { kind: 'variable', name: 'numbers' },
                index: { kind: 'variable', name: 'index' },
              },
              value: { kind: 'integerLiteral', value: 7 },
            },
            {
              kind: 'assignment',
              target: {
                kind: 'index',
                collection: { kind: 'variable', name: 'positions' },
                index: { kind: 'variable', name: 'key' },
              },
              value: { kind: 'variable', name: 'index' },
            },
          ],
        },
      ],
    } satisfies Program;

    const result = javaEmitter.emit(program);

    expect(result.code).toContain('numbers.set(index, 7);');
    expect(result.code).toContain('positions.put(key, index);');
  });

  it('compares strings by value and keeps primitive equality operators', () => {
    const program = {
      kind: 'program',
      declarations: [
        {
          kind: 'function',
          name: 'sameText',
          parameters: [
            { name: 'first', type: { kind: 'string' } },
            { name: 'second', type: { kind: 'string' } },
          ],
          returnType: { kind: 'boolean' },
          body: [
            {
              kind: 'return',
              value: {
                kind: 'binary',
                operator: 'equal',
                left: { kind: 'variable', name: 'first' },
                right: { kind: 'variable', name: 'second' },
              },
            },
          ],
        },
        {
          kind: 'function',
          name: 'differentText',
          parameters: [
            { name: 'first', type: { kind: 'string' } },
            { name: 'second', type: { kind: 'string' } },
          ],
          returnType: { kind: 'boolean' },
          body: [
            {
              kind: 'return',
              value: {
                kind: 'binary',
                operator: 'notEqual',
                left: { kind: 'variable', name: 'first' },
                right: { kind: 'variable', name: 'second' },
              },
            },
          ],
        },
        {
          kind: 'function',
          name: 'sameNumber',
          parameters: [
            { name: 'first', type: { kind: 'integer' } },
            { name: 'second', type: { kind: 'integer' } },
          ],
          returnType: { kind: 'boolean' },
          body: [
            {
              kind: 'return',
              value: {
                kind: 'binary',
                operator: 'equal',
                left: { kind: 'variable', name: 'first' },
                right: { kind: 'variable', name: 'second' },
              },
            },
          ],
        },
      ],
    } satisfies Program;

    const result = javaEmitter.emit(program);

    expect(result.code).toContain('Objects.equals(first, second)');
    expect(result.code).toContain('(!Objects.equals(first, second))');
    expect(result.code).toContain('(first == second)');
    expect(result.code).toContain('import java.util.Objects;');
  });

  it('emits language-neutral IR shaped like a Python set-membership solution', () => {
    const result = javaEmitter.emit(containsDuplicateProgram);

    expect(result.code).toContain(
      'public static boolean containsDuplicate(List<Integer> numbers)',
    );
    expect(result.code).toContain('Set<Integer> seen = new HashSet<>();');
    expect(result.code).toContain('for (int number : numbers)');
    expect(result.code).toContain('seen.contains(number)');
    expect(result.code).toContain('seen.add(number)');
  });
});
