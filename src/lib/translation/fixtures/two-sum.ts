import type { CappyType, Program } from '../ir';

const integer: CappyType = { kind: 'integer' };
const integerArray: CappyType = { kind: 'array', elementType: integer };
const integerMap: CappyType = {
  kind: 'map',
  keyType: integer,
  valueType: integer,
};

export const twoSumProgram = {
  kind: 'program',
  declarations: [
    {
      kind: 'class',
      name: 'Solution',
      methods: [
        {
          kind: 'function',
          name: 'twoSum',
          parameters: [
            { name: 'numbers', type: integerArray },
            { name: 'target', type: integer },
          ],
          returnType: integerArray,
          body: [
            {
              kind: 'variableDeclaration',
              name: 'seen',
              type: integerMap,
              initializer: {
                kind: 'mapLiteral',
                entries: [],
                keyType: integer,
                valueType: integer,
              },
            },
            {
              kind: 'for',
              initializer: {
                kind: 'variableDeclaration',
                name: 'index',
                type: integer,
                initializer: { kind: 'integerLiteral', value: 0 },
              },
              condition: {
                kind: 'binary',
                operator: 'lessThan',
                left: { kind: 'variable', name: 'index' },
                right: {
                  kind: 'collectionOperation',
                  operation: 'length',
                  collection: { kind: 'variable', name: 'numbers' },
                  arguments: [],
                },
              },
              update: {
                kind: 'assignment',
                target: { kind: 'variable', name: 'index' },
                value: {
                  kind: 'binary',
                  operator: 'add',
                  left: { kind: 'variable', name: 'index' },
                  right: { kind: 'integerLiteral', value: 1 },
                },
              },
              body: [
                {
                  kind: 'variableDeclaration',
                  name: 'number',
                  type: integer,
                  initializer: {
                    kind: 'index',
                    collection: { kind: 'variable', name: 'numbers' },
                    index: { kind: 'variable', name: 'index' },
                  },
                },
                {
                  kind: 'variableDeclaration',
                  name: 'complement',
                  type: integer,
                  initializer: {
                    kind: 'binary',
                    operator: 'subtract',
                    left: { kind: 'variable', name: 'target' },
                    right: { kind: 'variable', name: 'number' },
                  },
                },
                {
                  kind: 'if',
                  condition: {
                    kind: 'collectionOperation',
                    operation: 'contains',
                    collection: { kind: 'variable', name: 'seen' },
                    arguments: [{ kind: 'variable', name: 'complement' }],
                  },
                  thenBody: [
                    {
                      kind: 'return',
                      value: {
                        kind: 'arrayLiteral',
                        elementType: integer,
                        elements: [
                          {
                            kind: 'collectionOperation',
                            operation: 'get',
                            collection: { kind: 'variable', name: 'seen' },
                            arguments: [
                              { kind: 'variable', name: 'complement' },
                            ],
                          },
                          { kind: 'variable', name: 'index' },
                        ],
                      },
                    },
                  ],
                },
                {
                  kind: 'expressionStatement',
                  expression: {
                    kind: 'collectionOperation',
                    operation: 'add',
                    collection: { kind: 'variable', name: 'seen' },
                    arguments: [
                      { kind: 'variable', name: 'number' },
                      { kind: 'variable', name: 'index' },
                    ],
                  },
                },
              ],
            },
            {
              kind: 'return',
              value: {
                kind: 'arrayLiteral',
                elementType: integer,
                elements: [],
              },
            },
          ],
        },
      ],
    },
  ],
} satisfies Program;
