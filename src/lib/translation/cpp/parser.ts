import Parser from 'tree-sitter';
import Cpp from 'tree-sitter-cpp';
import type { CappyParser, ParseDiagnostic, ParseResult } from '../contracts';
import type {
  AssignmentStatement,
  BinaryOperator,
  CappyType,
  Declaration,
  Expression,
  FunctionDeclaration,
  Parameter,
  Program,
  Statement,
} from '../ir';

type SyntaxNode = Parser.SyntaxNode;

class UnsupportedCppSyntax extends Error {
  constructor(
    message: string,
    readonly node?: SyntaxNode,
  ) {
    super(message);
  }
}

const primitiveTypes: Record<string, CappyType> = {
  int: { kind: 'integer' },
  long: { kind: 'integer' },
  'long long': { kind: 'integer' },
  bool: { kind: 'boolean' },
  string: { kind: 'string' },
  'std::string': { kind: 'string' },
  void: { kind: 'void' },
};

const binaryOperators: Record<string, BinaryOperator> = {
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

function fail(message: string, node?: SyntaxNode): never {
  throw new UnsupportedCppSyntax(message, node);
}

function requiredField(node: SyntaxNode, fieldName: string): SyntaxNode {
  const field = node.childForFieldName(fieldName);
  if (!field) fail(`Expected ${fieldName} in ${node.type}.`, node);
  return field;
}

function childrenOfType(node: SyntaxNode, type: string): SyntaxNode[] {
  return node.namedChildren.filter((child) => child.type === type);
}

function unwrapDeclarator(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (
    current.type === 'reference_declarator' ||
    current.type === 'pointer_declarator' ||
    current.type === 'parenthesized_declarator'
  ) {
    const next = current.namedChildren.find(
      (child) => child.type !== 'type_qualifier',
    );
    if (!next) break;
    current = next;
  }
  return current;
}

function containsPointer(node: SyntaxNode): boolean {
  return (
    node.type === 'pointer_declarator' ||
    node.namedChildren.some(containsPointer)
  );
}

function parseType(typeNode: SyntaxNode): CappyType {
  const spelling = typeNode.text
    .replace(/\bconst\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = spelling.replace(/\bstd\s*::\s*/g, '');
  const direct = primitiveTypes[normalized];
  if (direct) return direct;

  const match = normalized.match(
    /^(vector|unordered_map|unordered_set)\s*<(.+)>$/,
  );
  if (!match) return fail(`Unsupported C++ type: ${spelling}.`, typeNode);

  const templateArguments = splitTemplateArguments(match[2]);
  if (match[1] === 'vector' && templateArguments.length === 1) {
    return {
      kind: 'array',
      elementType: typeFromSpelling(templateArguments[0], typeNode),
    };
  }
  if (match[1] === 'unordered_set' && templateArguments.length === 1) {
    return {
      kind: 'set',
      elementType: typeFromSpelling(templateArguments[0], typeNode),
    };
  }
  if (match[1] === 'unordered_map' && templateArguments.length === 2) {
    return {
      kind: 'map',
      keyType: typeFromSpelling(templateArguments[0], typeNode),
      valueType: typeFromSpelling(templateArguments[1], typeNode),
    };
  }
  return fail(`Unsupported template type: ${spelling}.`, typeNode);
}

function splitTemplateArguments(spelling: string): string[] {
  const argumentsFound: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of spelling) {
    if (character === '<') depth += 1;
    if (character === '>') depth -= 1;
    if (character === ',' && depth === 0) {
      argumentsFound.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) argumentsFound.push(current.trim());
  return argumentsFound;
}

function typeFromSpelling(spelling: string, node: SyntaxNode): CappyType {
  const normalized = spelling
    .replace(/\bconst\b/g, '')
    .replace(/\bstd\s*::\s*/g, '')
    .trim();
  const result = primitiveTypes[normalized];
  if (!result || result.kind === 'void')
    return fail(`Unsupported C++ type: ${spelling}.`, node);
  return result;
}

function parameterName(declarator: SyntaxNode): string {
  const identifier = unwrapDeclarator(declarator);
  if (identifier.type !== 'identifier') {
    return fail('Only named parameters are supported.', declarator);
  }
  return identifier.text;
}

function parseParameters(parameterList: SyntaxNode): Parameter[] {
  return childrenOfType(parameterList, 'parameter_declaration').map(
    (parameter) => {
      const type = parseType(requiredField(parameter, 'type'));
      const declarator = parameter.childForFieldName('declarator');
      if (!declarator) fail('Parameters must have a name.', parameter);
      if (containsPointer(declarator))
        fail('Pointer types are not supported.', declarator);
      return { name: parameterName(declarator), type };
    },
  );
}

function parseFunction(node: SyntaxNode): FunctionDeclaration {
  const declarator = requiredField(node, 'declarator');
  if (declarator.type !== 'function_declarator') {
    return fail(
      'Only ordinary function declarations are supported.',
      declarator,
    );
  }
  if (containsPointer(declarator))
    return fail('Pointer types are not supported.', declarator);
  const nameNode = unwrapDeclarator(requiredField(declarator, 'declarator'));
  if (nameNode.type !== 'identifier' && nameNode.type !== 'field_identifier') {
    return fail('Only named functions and methods are supported.', nameNode);
  }
  const parameters = parseParameters(requiredField(declarator, 'parameters'));
  const returnType = parseType(requiredField(node, 'type'));
  const body = parseBlock(requiredField(node, 'body'), parameters, returnType);
  return {
    kind: 'function',
    name: nameNode.text,
    parameters,
    returnType,
    body,
  };
}

function parseDeclaration(node: SyntaxNode): Declaration {
  if (node.type === 'function_definition') return parseFunction(node);
  if (node.type !== 'class_specifier') {
    return fail(`Unsupported top-level C++ syntax: ${node.type}.`, node);
  }

  const name = node.namedChildren.find(
    (child) => child.type === 'type_identifier' || child.type === 'identifier',
  );
  const body = childrenOfType(node, 'field_declaration_list')[0];
  if (!name || !body) return fail('Classes must have a name and a body.', node);
  const methods: FunctionDeclaration[] = [];
  for (const member of body.namedChildren) {
    if (member.type === 'access_specifier' || member.type === 'comment')
      continue;
    if (member.type === 'function_definition')
      methods.push(parseFunction(member));
    else fail(`Unsupported class member: ${member.type}.`, member);
  }
  return { kind: 'class', name: name.text, methods };
}

function parseBlock(
  node: SyntaxNode,
  parameters: Parameter[],
  returnType: CappyType,
): Statement[] {
  const scope = new Map(
    parameters.map((parameter) => [parameter.name, parameter.type]),
  );
  return node.namedChildren
    .filter((child) => child.type !== 'comment')
    .map((child) => parseStatement(child, scope, returnType));
}

function parseStatement(
  node: SyntaxNode,
  scope: Map<string, CappyType>,
  returnType: CappyType,
): Statement {
  switch (node.type) {
    case 'compound_statement':
      return fail('Unexpected nested block.', node);
    case 'declaration': {
      const typeNode = node.namedChildren.find(
        (child) =>
          child.type === 'primitive_type' ||
          child.type === 'type_identifier' ||
          child.type === 'template_type',
      );
      const declarators = childrenOfType(node, 'init_declarator');
      const plainName = node.namedChildren.find(
        (child) => child.type === 'identifier',
      );
      if (!typeNode || declarators.length > 1)
        return fail('Declarations must define one supported variable.', node);
      const type = parseType(typeNode);
      const init = declarators[0];
      const nameNode = init?.childForFieldName('declarator') ?? plainName;
      if (nameNode && containsPointer(nameNode))
        return fail('Pointer types are not supported.', nameNode);
      if (!nameNode || nameNode.type !== 'identifier')
        return fail('Only simple variable names are supported.', node);
      const initializerNode = init?.childForFieldName('value');
      const statement: Statement = {
        kind: 'variableDeclaration',
        name: nameNode.text,
        type,
        ...(initializerNode
          ? { initializer: parseExpression(initializerNode, scope, type) }
          : {}),
      };
      scope.set(nameNode.text, type);
      return statement;
    }
    case 'for_statement':
      return parseFor(node, scope, returnType);
    case 'for_range_loop': {
      const declarationType = requiredField(node, 'type');
      const variable = requiredField(node, 'declarator');
      if (variable.type !== 'identifier')
        return fail('Range loop variables must be simple names.', variable);
      const iterableNode = requiredField(node, 'right');
      const iterable = parseExpression(iterableNode, scope);
      const variableType = parseType(declarationType);
      const bodyNode = requiredField(node, 'body');
      const loopScope = new Map(scope);
      loopScope.set(variable.text, variableType);
      return {
        kind: 'forEach',
        variable: { name: variable.text, type: variableType },
        iterable,
        body: parseBlock(
          bodyNode,
          [...loopScope].map(([name, type]) => ({ name, type })),
          returnType,
        ),
      };
    }
    case 'while_statement':
      return {
        kind: 'while',
        condition: parseExpression(requiredField(node, 'condition'), scope),
        body: parseBlock(
          requiredField(node, 'body'),
          [...scope].map(([name, type]) => ({ name, type })),
          returnType,
        ),
      };
    case 'if_statement': {
      const consequence = requiredField(node, 'consequence');
      const alternative = node.childForFieldName('alternative');
      const condition = requiredField(node, 'condition');
      const conditionExpression =
        condition.type === 'condition_clause'
          ? parseExpression(requiredField(condition, 'value'), scope)
          : parseExpression(condition, scope);
      return {
        kind: 'if',
        condition: conditionExpression,
        thenBody: parseBody(consequence, scope, returnType),
        ...(alternative
          ? { elseBody: parseBody(alternative, scope, returnType) }
          : {}),
      };
    }
    case 'return_statement': {
      const value = node.namedChildren[0];
      return {
        kind: 'return',
        ...(value ? { value: parseExpression(value, scope, returnType) } : {}),
      };
    }
    case 'expression_statement': {
      const expressionNode = node.namedChildren[0];
      if (!expressionNode)
        return fail('Empty expression statements are not supported.', node);
      if (expressionNode.type === 'assignment_expression')
        return parseAssignment(expressionNode, scope);
      return {
        kind: 'expressionStatement',
        expression: parseExpression(expressionNode, scope),
      };
    }
    default:
      return fail(`Unsupported C++ statement: ${node.type}.`, node);
  }
}

function parseBody(
  node: SyntaxNode,
  scope: Map<string, CappyType>,
  returnType: CappyType,
): Statement[] {
  if (node.type === 'else_clause') {
    const alternative = node.namedChildren[0];
    if (!alternative)
      return fail('Else clauses must contain a statement.', node);
    return parseBody(alternative, scope, returnType);
  }
  if (node.type === 'compound_statement') {
    const local = new Map(scope);
    return node.namedChildren
      .filter((child) => child.type !== 'comment')
      .map((child) => parseStatement(child, local, returnType));
  }
  return [parseStatement(node, new Map(scope), returnType)];
}

function parseFor(
  node: SyntaxNode,
  outerScope: Map<string, CappyType>,
  returnType: CappyType,
): Statement {
  const initializerNode = node.childForFieldName('initializer');
  const conditionNode = node.childForFieldName('condition');
  const updateNode = node.childForFieldName('update');
  const bodyNode = requiredField(node, 'body');
  const loopScope = new Map(outerScope);
  const initializer = initializerNode
    ? parseStatement(initializerNode, loopScope, returnType)
    : undefined;
  const condition = conditionNode
    ? parseExpression(conditionNode, loopScope)
    : undefined;
  const update = updateNode ? parseForUpdate(updateNode, loopScope) : undefined;
  return {
    kind: 'for',
    ...(initializer ? { initializer } : {}),
    ...(condition ? { condition } : {}),
    ...(update ? { update } : {}),
    body: parseBody(bodyNode, loopScope, returnType),
  };
}

function parseForUpdate(
  node: SyntaxNode,
  scope: Map<string, CappyType>,
): AssignmentStatement {
  if (node.type === 'update_expression') {
    const operand = requiredField(node, 'argument');
    const variable = parseExpression(operand, scope);
    if (variable.kind !== 'variable')
      return fail('Counted loop updates must target a variable.', operand);
    const operator = node.text.includes('--') ? 'subtract' : 'add';
    return {
      kind: 'assignment',
      target: variable,
      value: {
        kind: 'binary',
        operator,
        left: variable,
        right: { kind: 'integerLiteral', value: 1 },
      },
    };
  }
  if (node.type !== 'assignment_expression')
    return fail('Counted loop updates must be assignments.', node);
  return parseAssignment(node, scope);
}

function parseExpression(
  node: SyntaxNode,
  scope: Map<string, CappyType>,
  expectedType?: CappyType,
): Expression {
  switch (node.type) {
    case 'number_literal': {
      const value = Number(node.text.replace(/[uUlL]+$/, ''));
      if (!Number.isSafeInteger(value))
        return fail('Only integer numeric literals are supported.', node);
      return { kind: 'integerLiteral', value };
    }
    case 'true':
      return { kind: 'booleanLiteral', value: true };
    case 'false':
      return { kind: 'booleanLiteral', value: false };
    case 'string_literal':
      return { kind: 'stringLiteral', value: decodeCppString(node.text, node) };
    case 'identifier':
    case 'field_identifier':
      return { kind: 'variable', name: node.text };
    case 'binary_expression': {
      const operator = node.childForFieldName('operator')?.text;
      const irOperator = operator ? binaryOperators[operator] : undefined;
      if (!irOperator)
        return fail(
          `Unsupported binary operator: ${operator ?? 'unknown'}.`,
          node,
        );
      return {
        kind: 'binary',
        operator: irOperator,
        left: parseExpression(requiredField(node, 'left'), scope),
        right: parseExpression(requiredField(node, 'right'), scope),
      };
    }
    case 'unary_expression': {
      const operator = requiredField(node, 'operator').text;
      if (operator !== '!' && operator !== '-')
        return fail(`Unsupported unary operator: ${operator}.`, node);
      return {
        kind: 'unary',
        operator: operator === '!' ? 'not' : 'negate',
        operand: parseExpression(requiredField(node, 'argument'), scope),
      };
    }
    case 'subscript_expression': {
      const indices = requiredField(node, 'indices');
      const index = indices.namedChildren[0];
      if (!index || indices.namedChildCount !== 1)
        return fail('Only single-index collection access is supported.', node);
      return {
        kind: 'index',
        collection: parseExpression(requiredField(node, 'argument'), scope),
        index: parseExpression(index, scope),
      };
    }
    case 'call_expression':
      return parseCall(node, scope);
    case 'initializer_list': {
      const elements = node.namedChildren.map((child) =>
        parseExpression(child, scope),
      );
      if (expectedType?.kind === 'map') {
        const entries = node.namedChildren.map((entry) => {
          if (
            entry.type !== 'initializer_list' ||
            entry.namedChildCount !== 2
          ) {
            return fail(
              'Map initializers must contain key/value pairs.',
              entry,
            );
          }
          return {
            key: parseExpression(
              entry.namedChildren[0],
              scope,
              expectedType.keyType,
            ),
            value: parseExpression(
              entry.namedChildren[1],
              scope,
              expectedType.valueType,
            ),
          };
        });
        return {
          kind: 'mapLiteral',
          entries,
          keyType: expectedType.keyType,
          valueType: expectedType.valueType,
        };
      }
      if (expectedType?.kind === 'set') {
        return {
          kind: 'setLiteral',
          elements: node.namedChildren.map((child) =>
            parseExpression(child, scope, expectedType.elementType),
          ),
          elementType: expectedType.elementType,
        };
      }
      const elementType =
        expectedType?.kind === 'array'
          ? expectedType.elementType
          : inferElementType(elements);
      return { kind: 'arrayLiteral', elements, elementType };
    }
    case 'assignment_expression':
      return fail(
        'Assignment expressions are only supported as statements.',
        node,
      );
    case 'parenthesized_expression':
      return parseExpression(node.namedChildren[0], scope, expectedType);
    default:
      return fail(`Unsupported C++ expression: ${node.type}.`, node);
  }
}

function parseAssignment(
  node: SyntaxNode,
  scope: Map<string, CappyType>,
): AssignmentStatement {
  const target = parseExpression(requiredField(node, 'left'), scope);
  if (target.kind !== 'variable' && target.kind !== 'index') {
    return fail(
      'Assignments must target a variable or collection index.',
      node,
    );
  }
  if (node.childForFieldName('operator')?.text !== '=') {
    return fail('Only simple assignments are supported.', node);
  }
  return {
    kind: 'assignment',
    target,
    value: parseExpression(requiredField(node, 'right'), scope),
  };
}

function parseCall(
  node: SyntaxNode,
  scope: Map<string, CappyType>,
): Expression {
  const callee = requiredField(node, 'function');
  const argumentList = requiredField(node, 'arguments');
  const args = argumentList.namedChildren.map((child) =>
    parseExpression(child, scope),
  );
  if (callee.type === 'field_expression') {
    const collectionNode = requiredField(callee, 'argument');
    const collection = parseExpression(collectionNode, scope);
    const operation = requiredField(callee, 'field').text;
    const collectionType =
      collection.kind === 'variable' ? scope.get(collection.name) : undefined;
    if (operation === 'size' && args.length === 0) {
      return {
        kind: 'collectionOperation',
        operation: 'length',
        collection,
        arguments: [],
      };
    }
    if (operation === 'count' && args.length === 1) {
      return {
        kind: 'collectionOperation',
        operation: 'contains',
        collection,
        arguments: args,
      };
    }
    if (operation === 'contains' && args.length === 1) {
      return {
        kind: 'collectionOperation',
        operation: 'contains',
        collection,
        arguments: args,
      };
    }
    if (
      operation === 'push_back' &&
      collectionType?.kind === 'array' &&
      args.length === 1
    ) {
      return {
        kind: 'collectionOperation',
        operation: 'append',
        collection,
        arguments: args,
      };
    }
    if (operation === 'insert' && collectionType?.kind === 'map') {
      return fail(
        'unordered_map.insert is insert-only and cannot be represented by the neutral map add operation.',
        callee,
      );
    }
    if (
      operation === 'insert' &&
      collectionType?.kind === 'set' &&
      args.length === 1
    ) {
      return {
        kind: 'collectionOperation',
        operation: 'add',
        collection,
        arguments: args,
      };
    }
    if (
      operation === 'erase' &&
      (collectionType?.kind === 'set' || collectionType?.kind === 'map') &&
      args.length === 1
    ) {
      return {
        kind: 'collectionOperation',
        operation: 'remove',
        collection,
        arguments: args,
      };
    }
    return fail(
      `Unsupported C++ collection operation: .${operation}().`,
      callee,
    );
  }
  if (callee.type === 'identifier') {
    return { kind: 'call', functionName: callee.text, arguments: args };
  }
  return fail('Only supported collection operations may be called.', callee);
}

function inferElementType(elements: Expression[]): CappyType {
  if (elements.length === 0) return { kind: 'unknown' };
  const first = elements[0];
  if (first.kind === 'integerLiteral') return { kind: 'integer' };
  if (first.kind === 'booleanLiteral') return { kind: 'boolean' };
  if (first.kind === 'stringLiteral') return { kind: 'string' };
  return { kind: 'unknown' };
}

function decodeCppString(spelling: string, node: SyntaxNode): string {
  const quote = spelling.indexOf('"');
  if (quote < 0 || !spelling.endsWith('"'))
    return fail('Only ordinary string literals are supported.', node);
  try {
    return JSON.parse(spelling.slice(quote));
  } catch {
    return fail('Unsupported escape sequence in string literal.', node);
  }
}

function diagnosticFor(node: SyntaxNode, message: string): ParseDiagnostic {
  return {
    message,
    location: {
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
    },
  };
}

function validatePreamble(node: SyntaxNode): void {
  if (node.type === 'preproc_include') {
    const include = node.namedChildren[0]?.text;
    const accepted = new Set([
      '<vector>',
      '<unordered_map>',
      '<unordered_set>',
      '<string>',
      '<bits/stdc++.h>',
    ]);
    if (!include || !accepted.has(include))
      fail(`Unsupported C++ include: ${include ?? 'unknown'}.`, node);
    return;
  }
  if (
    node.type === 'using_declaration' &&
    /^using\s+namespace\s+std\s*;$/.test(node.text)
  )
    return;
  if (node.type === 'comment') return;
  if (node.type === 'class_specifier' || node.type === 'function_definition')
    return;
  fail(`Unsupported top-level C++ syntax: ${node.type}.`, node);
}

export class CppParser implements CappyParser {
  readonly language = 'cpp' as const;

  parse(source: string): ParseResult {
    const parser = new Parser();
    parser.setLanguage(Cpp);
    const tree = parser.parse(source);
    const errorNode = findSyntaxError(tree.rootNode);
    if (errorNode)
      return {
        ok: false,
        diagnostics: [diagnosticFor(errorNode, 'Invalid C++ syntax.')],
      };

    try {
      tree.rootNode.namedChildren.forEach(validatePreamble);
      const declarations = tree.rootNode.namedChildren
        .filter(
          (node) =>
            node.type === 'class_specifier' ||
            node.type === 'function_definition',
        )
        .map(parseDeclaration);
      if (declarations.length === 0)
        fail(
          'Expected a supported function or class declaration.',
          tree.rootNode,
        );
      const program: Program = { kind: 'program', declarations };
      return { ok: true, program };
    } catch (error) {
      if (error instanceof UnsupportedCppSyntax) {
        return {
          ok: false,
          diagnostics: [
            diagnosticFor(error.node ?? tree.rootNode, error.message),
          ],
        };
      }
      throw error;
    }
  }
}

function findSyntaxError(node: SyntaxNode): SyntaxNode | undefined {
  if (node.isError || node.isMissing) return node;
  for (const child of node.namedChildren) {
    const found = findSyntaxError(child);
    if (found) return found;
  }
  return undefined;
}
