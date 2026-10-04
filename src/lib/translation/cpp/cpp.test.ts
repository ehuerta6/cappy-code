import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { containsDuplicateProgram } from '../fixtures/contains-duplicate';
import { twoSumProgram } from '../fixtures/two-sum';
import { CppEmitter } from './emitter';
import { CppParser } from './parser';

const parser = new CppParser();
const emitter = new CppEmitter();

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

describe('C++ translation adapter', () => {
  it('parses an interview-style two-sum implementation into the shared IR', () => {
    const result = parser.parse(fixture('two-sum.cpp'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program.declarations[0]).toMatchObject({
      kind: 'class',
      name: 'Solution',
      methods: [
        {
          name: 'twoSum',
          parameters: [
            {
              name: 'numbers',
              type: { kind: 'array', elementType: { kind: 'integer' } },
            },
            { name: 'target', type: { kind: 'integer' } },
          ],
          body: [
            {
              kind: 'variableDeclaration',
              type: {
                kind: 'map',
                keyType: { kind: 'integer' },
                valueType: { kind: 'integer' },
              },
            },
            { kind: 'for' },
            { kind: 'return' },
          ],
        },
      ],
    });
  });

  it('normalizes vector, unordered_map, and unordered_set operations', () => {
    const result = parser.parse(fixture('contains-duplicate.cpp'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const declaration = result.program.declarations[0];
    expect(declaration.kind).toBe('class');
    if (declaration.kind !== 'class') return;
    const method = declaration.methods[0];
    expect(method.parameters[0].type.kind).toBe('array');
    expect(method.body[0]).toMatchObject({
      kind: 'variableDeclaration',
      type: { kind: 'set' },
    });
    expect(method.body[1]).toMatchObject({
      kind: 'forEach',
      iterable: { kind: 'variable', name: 'numbers' },
    });
    expect(JSON.stringify(method.body)).toContain('"operation":"contains"');
    expect(JSON.stringify(method.body)).toContain('"operation":"add"');
  });

  it('normalizes vector and map mutations to neutral collection operations', () => {
    const result = parser.parse(`
      #include <vector>
      #include <unordered_map>
      void update(vector<int>& values, unordered_map<int, int>& positions) {
        values.push_back(4);
        positions.insert({4, 2});
        positions.erase(4);
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const declaration = result.program.declarations[0];
    expect(declaration.kind).toBe('function');
    if (declaration.kind !== 'function') return;
    expect(declaration.body).toEqual([
      {
        kind: 'expressionStatement',
        expression: {
          kind: 'collectionOperation',
          operation: 'append',
          collection: { kind: 'variable', name: 'values' },
          arguments: [{ kind: 'integerLiteral', value: 4 }],
        },
      },
      {
        kind: 'expressionStatement',
        expression: {
          kind: 'collectionOperation',
          operation: 'add',
          collection: { kind: 'variable', name: 'positions' },
          arguments: [
            { kind: 'integerLiteral', value: 4 },
            { kind: 'integerLiteral', value: 2 },
          ],
        },
      },
      {
        kind: 'expressionStatement',
        expression: {
          kind: 'collectionOperation',
          operation: 'remove',
          collection: { kind: 'variable', name: 'positions' },
          arguments: [{ kind: 'integerLiteral', value: 4 }],
        },
      },
    ]);
  });

  it('maps C++ aggregate initializers to typed IR map and set literals', () => {
    const result = parser.parse(`
      #include <unordered_map>
      #include <unordered_set>
      void initialize() {
        unordered_map<int, int> positions = {{4, 2}};
        unordered_set<int> seen = {4, 2};
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const declaration = result.program.declarations[0];
    expect(declaration.kind).toBe('function');
    if (declaration.kind !== 'function') return;
    expect(declaration.body).toEqual([
      {
        kind: 'variableDeclaration',
        name: 'positions',
        type: {
          kind: 'map',
          keyType: { kind: 'integer' },
          valueType: { kind: 'integer' },
        },
        initializer: {
          kind: 'mapLiteral',
          entries: [
            {
              key: { kind: 'integerLiteral', value: 4 },
              value: { kind: 'integerLiteral', value: 2 },
            },
          ],
          keyType: { kind: 'integer' },
          valueType: { kind: 'integer' },
        },
      },
      {
        kind: 'variableDeclaration',
        name: 'seen',
        type: { kind: 'set', elementType: { kind: 'integer' } },
        initializer: {
          kind: 'setLiteral',
          elements: [
            { kind: 'integerLiteral', value: 4 },
            { kind: 'integerLiteral', value: 2 },
          ],
          elementType: { kind: 'integer' },
        },
      },
    ]);
  });

  it('parses both branches of an if/else statement', () => {
    const result = parser.parse(`
      bool choose(bool ready) {
        if (ready) {
          return true;
        } else {
          return false;
        }
      }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program.declarations[0]).toMatchObject({
      kind: 'function',
      body: [
        {
          kind: 'if',
          thenBody: [
            { kind: 'return', value: { kind: 'booleanLiteral', value: true } },
          ],
          elseBody: [
            { kind: 'return', value: { kind: 'booleanLiteral', value: false } },
          ],
        },
      ],
    });
  });

  it('preserves named function calls in the shared IR', () => {
    const result = parser.parse(`
      int identity(int value) { return value; }
      int use(int value) { return identity(value); }
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program.declarations[1]).toMatchObject({
      kind: 'function',
      name: 'use',
      body: [
        {
          kind: 'return',
          value: {
            kind: 'call',
            functionName: 'identity',
            arguments: [{ kind: 'variable', name: 'value' }],
          },
        },
      ],
    });
  });

  it('emits readable C++ from the shared two-sum IR', () => {
    const { code } = emitter.emit(twoSumProgram);

    expect(code).toContain('#include <unordered_map>');
    expect(code).toContain('#include <vector>');
    expect(code).toContain(
      'std::vector<int> twoSum(std::vector<int>& numbers, int target)',
    );
    expect(code).toContain('std::unordered_map<int, int> seen = {};');
    expect(code).toContain('seen.find(complement) != seen.end()');
    expect(code).toContain('return {seen[complement], index};');
  });

  it('emits vector and unordered_set IR as standard C++ containers', () => {
    const { code } = emitter.emit(containsDuplicateProgram);

    expect(code).toContain('#include <unordered_set>');
    expect(code).toContain('std::unordered_set<int> seen = {};');
    expect(code).toContain('for (int number : numbers)');
    expect(code).toContain('seen.insert(number);');
  });

  it('returns a controlled diagnostic for unsupported syntax', () => {
    const result = parser.parse(
      'class Solution { public: int f(int* value) { return *value; } };',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0].message).toBe(
      'Pointer types are not supported.',
    );
    expect(result.diagnostics[0].location).toEqual({ line: 1, column: 30 });
  });

  it('returns a location for malformed C++', () => {
    const result = parser.parse('int broken( {');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0].message).toBe('Invalid C++ syntax.');
    expect(result.diagnostics[0].location?.line).toBe(1);
  });
});
