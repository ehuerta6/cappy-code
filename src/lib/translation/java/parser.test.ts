import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { javaParser } from './parser';

const twoSumJava = readFileSync(
  new URL('../fixtures/two-sum.java', import.meta.url),
  'utf8',
);

describe('Java parser', () => {
  it('parses an interview-style solution into the neutral IR', () => {
    const result = javaParser.parse(twoSumJava);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const solution = result.program.declarations[0];
    expect(solution.kind).toBe('class');
    if (solution.kind !== 'class') return;

    const twoSum = solution.methods[0];
    expect(twoSum.parameters.map(({ type }) => type)).toEqual([
      { kind: 'array', elementType: { kind: 'integer' } },
      { kind: 'integer' },
    ]);
    expect(twoSum.returnType).toEqual({
      kind: 'array',
      elementType: { kind: 'integer' },
    });

    const map = twoSum.body[0];
    expect(map.kind).toBe('variableDeclaration');
    if (map.kind !== 'variableDeclaration') return;
    expect(map.type).toEqual({
      kind: 'map',
      keyType: { kind: 'integer' },
      valueType: { kind: 'integer' },
    });
  });

  it('normalizes Java arrays, lists, maps, and sets into neutral collection types', () => {
    const result = javaParser.parse(`
      import java.util.HashMap;
      import java.util.HashSet;
      import java.util.List;
      import java.util.Map;
      import java.util.Set;
      class CollectionsExample {
        public void convert(int[] first, List<String> second, Map<String, Integer> map, Set<Integer> set) {}
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const declaration = result.program.declarations[0];
    if (declaration.kind !== 'class') throw new Error('Expected a Java class.');

    expect(
      declaration.methods[0].parameters.map(({ type }) => type.kind),
    ).toEqual(['array', 'array', 'map', 'set']);
  });

  it('returns a located diagnostic for syntax outside the supported subset', () => {
    const result = javaParser.parse(
      'class Solution { void run() { try {} catch (Exception e) {} } }',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0].message).toContain(
      'Unsupported Java statement',
    );
    expect(result.diagnostics[0].location).toBeDefined();
  });
});
