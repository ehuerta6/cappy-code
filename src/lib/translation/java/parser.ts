import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import type {
  AssignableExpression,
  CappyType,
  Expression,
  FunctionDeclaration,
  Program,
  Statement,
} from '../ir';
import type { CappyParser, ParseDiagnostic, ParseResult } from '../contracts';

type Node = Parser.SyntaxNode;

class UnsupportedSyntax extends Error {
  constructor(
    message: string,
    readonly node: Node,
  ) {
    super(message);
  }
}

const INTEGER: CappyType = { kind: 'integer' };
const BOOLEAN: CappyType = { kind: 'boolean' };
const STRING: CappyType = { kind: 'string' };
const VOID: CappyType = { kind: 'void' };
const UNKNOWN: CappyType = { kind: 'unknown' };

const binaryOperators: Record<
  string,
  Extract<Expression, { kind: 'binary' }>['operator']
> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '%': 'remainder',
  '==': 'equal',
  '!=': 'notEqual',
  '<': 'lessThan',
  '<=': 'lessThanOrEqual',
  '>': 'greaterThan',
  '>=': 'greaterThanOrEqual',
  '&&': 'and',
  '||': 'or',
};

function namedChildren(node: Node): Node[] {
  return node.namedChildren.filter((child) => !child.isExtra);
}

function child(node: Node, field: string): Node {
  const result = node.childForFieldName(field);
  if (!result) throw new UnsupportedSyntax(`Missing ${field}.`, node);
  return result;
}

function typeFromNode(node: Node): CappyType {
  if (node.type === 'array_type') {
    const element = node.childForFieldName('element');
    if (!element || node.childForFieldName('dimensions')?.text !== '[]') {
      throw new UnsupportedSyntax(
        'Only one-dimensional arrays are supported.',
        node,
      );
    }
    return { kind: 'array', elementType: typeFromNode(element) };
  }

  if (node.type === 'generic_type') {
    const [base, ...arguments_] = namedChildren(node);
    if (!base) throw new UnsupportedSyntax('Unsupported generic type.', node);
    const name = base.text.split('.').at(-1);
    const types = arguments_.flatMap((argument) => namedChildren(argument));

    if (
      ['List', 'ArrayList', 'Collection'].includes(name ?? '') &&
      types.length === 1
    ) {
      return { kind: 'array', elementType: typeFromNode(types[0]) };
    }
    if (['Map', 'HashMap'].includes(name ?? '') && types.length === 2) {
      return {
        kind: 'map',
        keyType: typeFromNode(types[0]),
        valueType: typeFromNode(types[1]),
      };
    }
    if (['Set', 'HashSet'].includes(name ?? '') && types.length === 1) {
      return { kind: 'set', elementType: typeFromNode(types[0]) };
    }
    throw new UnsupportedSyntax(
      `Unsupported Java generic type: ${node.text}.`,
      node,
    );
  }

  switch (node.text) {
    case 'int':
    case 'Integer':
    case 'short':
    case 'byte':
    case 'long':
      return INTEGER;
    case 'boolean':
    case 'Boolean':
      return BOOLEAN;
    case 'String':
      return STRING;
    case 'void':
      return VOID;
    default:
      throw new UnsupportedSyntax(`Unsupported Java type: ${node.text}.`, node);
  }
}

function parameterFromNode(node: Node) {
  return {
    name: child(node, 'name').text,
    type: typeFromNode(child(node, 'type')),
  };
}

function parseMethod(node: Node): FunctionDeclaration {
  const returnTypeNode = child(node, 'type');
  const params = child(node, 'parameters');
  const body = node.childForFieldName('body');
  if (!body) throw new UnsupportedSyntax('Methods must have a body.', node);

  return {
    kind: 'function',
    name: child(node, 'name').text,
    parameters: namedChildren(params).map(parameterFromNode),
    returnType: typeFromNode(returnTypeNode),
    body: parseBlock(body),
  };
}

function parseVariableDeclaration(node: Node): Statement[] {
  const type = typeFromNode(child(node, 'type'));
  return namedChildren(node)
    .filter((item) => item.type === 'variable_declarator')
    .map((declarator) => {
      const value = declarator.childForFieldName('value');
      const initializer = value ? parseExpression(value) : undefined;
      if (
        initializer &&
        ((type.kind === 'array' && initializer.kind !== 'arrayLiteral') ||
          (type.kind === 'map' && initializer.kind !== 'mapLiteral') ||
          (type.kind === 'set' && initializer.kind !== 'setLiteral'))
      ) {
        throw new UnsupportedSyntax(
          'Collection declarations must use a matching collection initializer.',
          declarator,
        );
      }
      return {
        kind: 'variableDeclaration' as const,
        name: child(declarator, 'name').text,
        type,
        ...(initializer ? { initializer } : {}),
      };
    });
}

function parseBlock(node: Node): Statement[] {
  return namedChildren(node).flatMap(parseStatement);
}

function parseBody(node: Node): Statement[] {
  if (node.type === 'else_clause') {
    const alternative = namedChildren(node)[0];
    return alternative ? parseBody(alternative) : [];
  }
  return node.type === 'block' ? parseBlock(node) : parseStatement(node);
}

function parseStatement(node: Node): Statement[] {
  switch (node.type) {
    case 'block':
      return parseBlock(node);
    case 'local_variable_declaration':
      return parseVariableDeclaration(node);
    case 'expression_statement': {
      const expression = namedChildren(node)[0];
      if (expression?.type === 'assignment_expression') {
        return [parseAssignment(expression)];
      }
      if (expression?.type === 'update_expression') {
        return [parseUpdate(expression)];
      }
      if (!expression)
        throw new UnsupportedSyntax('Empty expression statement.', node);
      return [
        {
          kind: 'expressionStatement',
          expression: parseExpression(expression),
        },
      ];
    }
    case 'return_statement': {
      const value = namedChildren(node)[0];
      return [
        { kind: 'return', ...(value ? { value: parseExpression(value) } : {}) },
      ];
    }
    case 'if_statement': {
      const condition = child(node, 'condition');
      const consequence = child(node, 'consequence');
      const alternative = node.childForFieldName('alternative');
      return [
        {
          kind: 'if',
          condition: parseExpression(condition),
          thenBody: parseBody(consequence),
          ...(alternative ? { elseBody: parseBody(alternative) } : {}),
        },
      ];
    }
    case 'while_statement':
      return [
        {
          kind: 'while',
          condition: parseExpression(child(node, 'condition')),
          body: parseBody(child(node, 'body')),
        },
      ];
    case 'enhanced_for_statement': {
      const local = node.childForFieldName('name');
      const typeNode = node.childForFieldName('type');
      const iterable = node.childForFieldName('value');
      const body = node.childForFieldName('body');
      if (!local || !typeNode || !iterable || !body) {
        throw new UnsupportedSyntax('Unsupported enhanced for loop.', node);
      }
      return [
        {
          kind: 'forEach',
          variable: { name: local.text, type: typeFromNode(typeNode) },
          iterable: parseExpression(iterable),
          body: parseBody(body),
        },
      ];
    }
    case 'for_statement':
      return [parseForStatement(node)];
    default:
      throw new UnsupportedSyntax(
        `Unsupported Java statement: ${node.type}.`,
        node,
      );
  }
}

function parseForStatement(node: Node): Statement {
  const initializerNode = node.childForFieldName('init');
  const conditionNode = node.childForFieldName('condition');
  const updateNode = node.childForFieldName('update');
  const bodyNode = node.childForFieldName('body');
  let initializer: Statement | undefined;
  if (initializerNode) {
    const parsed = parseStatement(initializerNode);
    if (parsed.length !== 1)
      throw new UnsupportedSyntax(
        'For loops support one initializer.',
        initializerNode,
      );
    initializer = parsed[0];
  }

  return {
    kind: 'for',
    ...(initializer ? { initializer } : {}),
    ...(conditionNode ? { condition: parseExpression(conditionNode) } : {}),
    ...(updateNode ? { update: parseUpdate(updateNode) } : {}),
    body: bodyNode ? parseBody(bodyNode) : [],
  };
}

function parseUpdate(node: Node): Extract<Statement, { kind: 'assignment' }> {
  if (node.type === 'update_expression') {
    const expression = namedChildren(node)[0];
    const target = parseAssignable(expression);
    const operator =
      node.text.startsWith('--') || node.text.endsWith('--')
        ? 'subtract'
        : 'add';
    return {
      kind: 'assignment',
      target,
      value: {
        kind: 'binary',
        operator,
        left: target,
        right: { kind: 'integerLiteral', value: 1 },
      },
    };
  }
  if (node.type === 'assignment_expression') return parseAssignment(node);
  throw new UnsupportedSyntax('Unsupported for-loop update.', node);
}

function parseAssignable(node: Node): AssignableExpression {
  if (node.type === 'identifier') return { kind: 'variable', name: node.text };
  if (node.type === 'array_access') {
    return {
      kind: 'index',
      collection: parseExpression(child(node, 'array')),
      index: parseExpression(child(node, 'index')),
    };
  }
  throw new UnsupportedSyntax('Unsupported assignment target.', node);
}

function parseAssignment(
  node: Node,
): Extract<Statement, { kind: 'assignment' }> {
  const left = child(node, 'left');
  const right = child(node, 'right');
  const target = parseAssignable(left);
  const operator = node.children.find((item) => !item.isNamed)?.text;
  if (operator === '=')
    return { kind: 'assignment', target, value: parseExpression(right) };
  const binaryOperator = operator?.slice(0, -1);
  const normalized = binaryOperators[binaryOperator ?? ''];
  if (!normalized)
    throw new UnsupportedSyntax(
      `Unsupported assignment operator: ${operator}.`,
      node,
    );
  return {
    kind: 'assignment',
    target,
    value: {
      kind: 'binary',
      operator: normalized,
      left: target,
      right: parseExpression(right),
    },
  };
}

function parseExpression(node: Node): Expression {
  switch (node.type) {
    case 'parenthesized_expression':
      return parseExpression(namedChildren(node)[0]);
    case 'identifier':
      return { kind: 'variable', name: node.text };
    case 'decimal_integer_literal': {
      const value = Number(node.text.replaceAll('_', '').replace(/[lL]$/, ''));
      if (!Number.isSafeInteger(value))
        throw new UnsupportedSyntax(
          'Only safe integer literals are supported.',
          node,
        );
      return { kind: 'integerLiteral', value };
    }
    case 'true':
    case 'false':
      return { kind: 'booleanLiteral', value: node.text === 'true' };
    case 'string_literal':
      return { kind: 'stringLiteral', value: JSON.parse(node.text) as string };
    case 'binary_expression': {
      const left = child(node, 'left');
      const right = child(node, 'right');
      const operator = node.children.find((item) => !item.isNamed)?.text;
      const normalized = binaryOperators[operator ?? ''];
      if (!normalized)
        throw new UnsupportedSyntax(
          `Unsupported binary operator: ${operator}.`,
          node,
        );
      return {
        kind: 'binary',
        operator: normalized,
        left: parseExpression(left),
        right: parseExpression(right),
      };
    }
    case 'unary_expression': {
      const operator = node.children.find((item) => !item.isNamed)?.text;
      if (operator !== '!' && operator !== '-')
        throw new UnsupportedSyntax('Unsupported unary operator.', node);
      return {
        kind: 'unary',
        operator: operator === '!' ? 'not' : 'negate',
        operand: parseExpression(namedChildren(node)[0]),
      };
    }
    case 'array_access':
      return {
        kind: 'index',
        collection: parseExpression(child(node, 'array')),
        index: parseExpression(child(node, 'index')),
      };
    case 'array_initializer': {
      const elements = namedChildren(node).map(parseExpression);
      return {
        kind: 'arrayLiteral',
        elements,
        elementType: inferLiteralType(elements),
      };
    }
    case 'array_creation_expression': {
      const initializer = namedChildren(node).find(
        (item) => item.type === 'array_initializer',
      );
      if (!initializer)
        throw new UnsupportedSyntax(
          'Arrays with explicit lengths are not supported.',
          node,
        );
      const elements = namedChildren(initializer).map(parseExpression);
      return {
        kind: 'arrayLiteral',
        elements,
        elementType: typeFromNode(child(node, 'type')),
      };
    }
    case 'object_creation_expression':
      return parseCollectionCreation(node);
    case 'assignment_expression':
      throw new UnsupportedSyntax(
        'Assignments are supported only as statements and loop updates.',
        node,
      );
    case 'method_invocation':
      return parseInvocation(node);
    case 'field_access': {
      const object = child(node, 'object');
      if (child(node, 'field').text === 'length') {
        return {
          kind: 'collectionOperation',
          operation: 'length',
          collection: parseExpression(object),
          arguments: [],
        };
      }
      throw new UnsupportedSyntax(
        `Unsupported field access: ${node.text}.`,
        node,
      );
    }
    default:
      throw new UnsupportedSyntax(
        `Unsupported Java expression: ${node.type}.`,
        node,
      );
  }
}

function inferLiteralType(elements: Expression[]): CappyType {
  if (elements.length === 0) return UNKNOWN;
  const value = elements[0];
  if (value.kind === 'integerLiteral') return INTEGER;
  if (value.kind === 'booleanLiteral') return BOOLEAN;
  if (value.kind === 'stringLiteral') return STRING;
  return UNKNOWN;
}

function parseCollectionCreation(node: Node): Expression {
  const typeNode = child(node, 'type');
  if (namedChildren(child(node, 'arguments')).length > 0) {
    throw new UnsupportedSyntax(
      'Collection constructors must not have arguments.',
      node,
    );
  }
  const typeName = namedChildren(typeNode)[0]?.text ?? typeNode.text;
  if (['ArrayList', 'List'].includes(typeName)) {
    return { kind: 'arrayLiteral', elements: [], elementType: UNKNOWN };
  }
  if (['HashMap', 'Map'].includes(typeName)) {
    return {
      kind: 'mapLiteral',
      entries: [],
      keyType: UNKNOWN,
      valueType: UNKNOWN,
    };
  }
  if (['HashSet', 'Set'].includes(typeName)) {
    return { kind: 'setLiteral', elements: [], elementType: UNKNOWN };
  }
  throw new UnsupportedSyntax(
    `Unsupported object creation: ${typeNode.text}.`,
    node,
  );
}

function argumentsOf(node: Node): Expression[] {
  const args = node.childForFieldName('arguments');
  return args ? namedChildren(args).map(parseExpression) : [];
}

function parseInvocation(node: Node): Expression {
  const methodName = child(node, 'name').text;
  const object = node.childForFieldName('object');
  const args = argumentsOf(node);
  if (!object)
    return { kind: 'call', functionName: methodName, arguments: args };

  const collection = parseExpression(object);
  const operations: Record<
    string,
    'length' | 'contains' | 'add' | 'remove' | 'append' | 'get'
  > = {
    size: 'length',
    contains: 'contains',
    containsKey: 'contains',
    add: 'add',
    put: 'add',
    remove: 'remove',
    get: 'get',
  };
  const operation = operations[methodName];
  if (!operation)
    throw new UnsupportedSyntax(`Unsupported method call: ${node.text}.`, node);
  return {
    kind: 'collectionOperation',
    operation,
    collection,
    arguments: args,
  };
}

function supportedImport(node: Node): boolean {
  const path = node.text.replace(/^import\s+static\s+|^import\s+|;$/g, '');
  return /^java\.util\.(\*|List|ArrayList|Map|HashMap|Set|HashSet|Collection)$/.test(
    path,
  );
}

function diagnostic(node: Node, message: string): ParseDiagnostic {
  return {
    message,
    location: {
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
    },
  };
}

export const javaParser: CappyParser = {
  language: 'java',
  parse(source: string): ParseResult {
    const parser = new Parser();
    parser.setLanguage(Java);
    const tree = parser.parse(source);
    if (tree.rootNode.hasError) {
      const error =
        tree.rootNode.descendantsOfType(['ERROR', 'MISSING'])[0] ??
        tree.rootNode;
      return {
        ok: false,
        diagnostics: [diagnostic(error, 'Invalid or unsupported Java syntax.')],
      };
    }

    try {
      const declarations: Program['declarations'] = [];
      for (const node of namedChildren(tree.rootNode)) {
        if (node.type === 'import_declaration') {
          if (!supportedImport(node))
            throw new UnsupportedSyntax(
              'Only supported java.util collection imports are allowed.',
              node,
            );
          continue;
        }
        if (node.type === 'class_declaration') {
          const classBody = child(node, 'body');
          const methods = namedChildren(classBody)
            .filter((member) => member.type === 'method_declaration')
            .map(parseMethod);
          const members = namedChildren(classBody).filter(
            (member) => member.type !== 'method_declaration',
          );
          if (members.length)
            throw new UnsupportedSyntax(
              'Only methods are supported inside Java classes.',
              members[0],
            );
          declarations.push({
            kind: 'class',
            name: child(node, 'name').text,
            methods,
          });
          continue;
        }
        if (node.type === 'method_declaration') {
          declarations.push(parseMethod(node));
          continue;
        }
        throw new UnsupportedSyntax(
          `Unsupported Java declaration: ${node.type}.`,
          node,
        );
      }
      return { ok: true, program: { kind: 'program', declarations } };
    } catch (error) {
      if (error instanceof UnsupportedSyntax) {
        return {
          ok: false,
          diagnostics: [diagnostic(error.node, error.message)],
        };
      }
      return {
        ok: false,
        diagnostics: [{ message: 'Unable to parse Java source.' }],
      };
    }
  },
};
