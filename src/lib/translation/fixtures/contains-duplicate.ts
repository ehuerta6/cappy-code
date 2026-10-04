import type { CappyType, Program } from '../ir';

const integer: CappyType = { kind: 'integer' };
const integerArray: CappyType = { kind: 'array', elementType: integer };
const integerSet: CappyType = { kind: 'set', elementType: integer };

export const containsDuplicateProgram = {
  kind: 'program',
  declarations: [
    {
      kind: 'function',
      name: 'containsDuplicate',
      parameters: [{ name: 'numbers', type: integerArray }],
      returnType: { kind: 'boolean' },
      body: [
        {
          kind: 'variableDeclaration',
          name: 'seen',
          type: integerSet,
          initializer: {
            kind: 'setLiteral',
            elements: [],
            elementType: integer,
          },
        },
        {
          kind: 'forEach',
          variable: { name: 'number', type: integer },
          iterable: { kind: 'variable', name: 'numbers' },
          body: [
            {
              kind: 'if',
              condition: {
                kind: 'collectionOperation',
                operation: 'contains',
                collection: { kind: 'variable', name: 'seen' },
                arguments: [{ kind: 'variable', name: 'number' }],
              },
              thenBody: [
                {
                  kind: 'return',
                  value: { kind: 'booleanLiteral', value: true },
                },
              ],
              elseBody: [
                {
                  kind: 'expressionStatement',
                  expression: {
                    kind: 'collectionOperation',
                    operation: 'add',
                    collection: { kind: 'variable', name: 'seen' },
                    arguments: [{ kind: 'variable', name: 'number' }],
                  },
                },
              ],
            },
          ],
        },
        { kind: 'return', value: { kind: 'booleanLiteral', value: false } },
      ],
    },
  ],
} satisfies Program;
