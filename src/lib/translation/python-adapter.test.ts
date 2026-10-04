import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PythonEmitter, PythonParser } from './python-adapter';
import { containsDuplicateProgram } from './fixtures/contains-duplicate';
import { twoSumProgram } from './fixtures/two-sum';

const parser = new PythonParser();
const emitter = new PythonEmitter();
const twoSumSource = readFileSync(
  fileURLToPath(new URL('./fixtures/two-sum.py', import.meta.url)),
  'utf8',
);

describe('Python parser', () => {
  it('parses a realistic Two Sum method into the shared IR', () => {
    const result = parser.parse(twoSumSource);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.program.declarations).toHaveLength(1);
    const solution = result.program.declarations[0];
    expect(solution.kind).toBe('class');
    if (solution.kind !== 'class') return;

    expect(solution.name).toBe('Solution');
    expect(solution.methods).toHaveLength(1);
    expect(solution.methods[0].parameters).toEqual([
      {
        name: 'numbers',
        type: { kind: 'array', elementType: { kind: 'integer' } },
      },
      { name: 'target', type: { kind: 'integer' } },
    ]);
    expect(solution.methods[0].body.map((statement) => statement.kind)).toEqual(
      ['variableDeclaration', 'for', 'return'],
    );
    const loop = solution.methods[0].body[1];
    expect(loop).toMatchObject({
      kind: 'for',
      initializer: { kind: 'variableDeclaration', name: 'index' },
      condition: {
        kind: 'binary',
        operator: 'lessThan',
        right: { kind: 'collectionOperation', operation: 'length' },
      },
    });
  });

  it('maps common list, dictionary, set, and membership syntax to IR operations', () => {
    const result = parser.parse(`
def has_item(items: list[int], values: dict[int, int], seen: set[int], key: int) -> bool:
    items.append(key)
    values[key] = key + 1
    seen.add(key)
    return key in values and key in seen
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.program.declarations[0]).toMatchObject({
      kind: 'function',
      body: [
        {
          kind: 'expressionStatement',
          expression: { kind: 'collectionOperation', operation: 'append' },
        },
        { kind: 'assignment', target: { kind: 'index' } },
        {
          kind: 'expressionStatement',
          expression: { kind: 'collectionOperation', operation: 'add' },
        },
        {
          kind: 'return',
          value: {
            kind: 'binary',
            operator: 'and',
            left: { kind: 'collectionOperation', operation: 'contains' },
            right: { kind: 'collectionOperation', operation: 'contains' },
          },
        },
      ],
    });
  });

  it('preserves negative membership and dictionary get calls', () => {
    const result = parser.parse(
      'def excludes(values: dict[int, int], key: int) -> bool:\n    return key not in values\n\ndef lookup(values: dict[int, int], key: int) -> int:\n    return values.get(key)\n',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program.declarations[0]).toMatchObject({
      kind: 'function',
      body: [
        {
          kind: 'return',
          value: {
            kind: 'unary',
            operator: 'not',
            operand: { kind: 'collectionOperation', operation: 'contains' },
          },
        },
      ],
    });
    const code = emitter.emit(result.program).code;
    expect(code).toContain('return key not in values');
    expect(code).toContain('return values.get(key)');
  });

  it('returns a located diagnostic for syntactically invalid Python', () => {
    const result = parser.parse('def broken(:\n  return 1\n');

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          message: 'Invalid Python syntax.',
          location: { line: 1, column: 12 },
        },
      ],
    });
  });

  it('returns a controlled diagnostic for valid but unsupported syntax', () => {
    const result = parser.parse(
      'def visit(node):\n    try:\n        return node.value\n    except ValueError:\n        return 0\n',
    );

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          message: 'Python try statement is not supported.',
          location: { line: 2, column: 5 },
        },
      ],
    });
  });
});

describe('Python emitter', () => {
  it('emits readable typed methods and idiomatic collection operations', () => {
    expect(emitter.emit(twoSumProgram).code).toBe(`class Solution:
    def twoSum(self, numbers: list[int], target: int) -> list[int]:
        seen = {}
        for index in range(len(numbers)):
            number = numbers[index]
            complement = target - number
            if complement in seen:
                return [seen.get(complement), index]
            seen[number] = index
        return []`);
  });

  it('emits set membership and mutation with Python syntax', () => {
    expect(emitter.emit(containsDuplicateProgram).code).toBe(
      `def containsDuplicate(numbers: list[int]) -> bool:
    seen = set()
    for number in numbers:
        if number in seen:
            return True
        else:
            seen.add(number)
    return False`,
    );
  });
});
