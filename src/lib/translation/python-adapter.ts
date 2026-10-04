import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import type {
  AssignmentStatement,
  CappyType,
  Expression,
  FunctionDeclaration,
  Parameter,
  Program,
  Statement,
} from './ir';
import type {
  CappyEmitter,
  CappyParser,
  EmitResult,
  ParseDiagnostic,
  ParseResult,
} from './contracts';

const integerType: CappyType = { kind: 'integer' };
const booleanType: CappyType = { kind: 'boolean' };
const stringType: CappyType = { kind: 'string' };
const unknownType: CappyType = { kind: 'unknown' };

class UnsupportedPythonSyntax extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, node: Parser.SyntaxNode) {
    super(message);
    this.name = 'UnsupportedPythonSyntax';
    this.line = node.startPosition.row + 1;
    this.column = node.startPosition.column + 1;
  }
}

export class PythonParser implements CappyParser {
  readonly language = 'python' as const;
  private readonly parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Python);
  }

  parse(source: string): ParseResult {
    const tree = this.parser.parse(source);
    const root = tree.rootNode;
    const syntaxError = findSyntaxError(root);
    if (syntaxError) {
      return {
        ok: false,
        diagnostics: [diagnosticAt(syntaxError, 'Invalid Python syntax.')],
      };
    }

    try {
      const declarations = root.namedChildren
        .filter(isNotComment)
        .map((node) => {
          if (node.type === 'function_definition') {
            return parseFunction(node, false);
          }
          if (node.type === 'class_definition') {
            return parseClass(node);
          }
          throw new UnsupportedPythonSyntax(
            `Top-level ${node.type.replaceAll('_', ' ')} is not supported.`,
            node,
          );
        });
      return { ok: true, program: { kind: 'program', declarations } };
    } catch (error) {
      if (error instanceof UnsupportedPythonSyntax) {
        return {
          ok: false,
          diagnostics: [
            {
              message: error.message,
              location: { line: error.line, column: error.column },
            },
          ],
        };
      }
      throw error;
    }
  }
}

export class PythonEmitter implements CappyEmitter {
  readonly language = 'python' as const;

  emit(program: Program): EmitResult {
    return {
      code: program.declarations
        .map((declaration) => {
          if (declaration.kind === 'function') {
            return emitFunction(declaration, 0, false).join('\n');
          }
          return [
            `class ${declaration.name}:`,
            ...(declaration.methods.length === 0
              ? ['    pass']
              : declaration.methods.flatMap((method, index) => [
                  ...(index === 0 ? [] : ['']),
                  ...emitFunction(method, 1, true),
                ])),
          ].join('\n');
        })
        .join('\n\n'),
    };
  }
}

function parseClass(node: Parser.SyntaxNode) {
  const name = fieldText(node, 'name');
  const body = node.childForFieldName('body');
  if (!name || !body) throw unsupported(node, 'Malformed class definition.');
  const methods = body.namedChildren.filter(isNotComment).map((child) => {
    if (child.type !== 'function_definition') {
      throw unsupported(
        child,
        `Class member ${child.type.replaceAll('_', ' ')} is not supported.`,
      );
    }
    return parseFunction(child, true);
  });
  return { kind: 'class' as const, name, methods };
}

function parseFunction(
  node: Parser.SyntaxNode,
  isMethod: boolean,
): FunctionDeclaration {
  const name = fieldText(node, 'name');
  const parameterNode = node.childForFieldName('parameters');
  const body = node.childForFieldName('body');
  if (!name || !parameterNode || !body) {
    throw unsupported(node, 'Malformed function definition.');
  }

  const parameters: Parameter[] = [];
  for (const parameterNodeChild of parameterNode.namedChildren) {
    const parsed = parseParameter(parameterNodeChild);
    if (isMethod && parameters.length === 0 && parsed.name === 'self') continue;
    parameters.push(parsed);
  }

  const names = new Set(parameters.map((parameter) => parameter.name));
  const statements = parseStatements(body.namedChildren, names);
  const returnAnnotation = node.childForFieldName('return_type');
  return {
    kind: 'function',
    name,
    parameters,
    returnType: returnAnnotation ? parseType(returnAnnotation) : unknownType,
    body: statements,
  };
}

function parseParameter(node: Parser.SyntaxNode): Parameter {
  if (node.type === 'identifier') {
    return { name: node.text, type: unknownType };
  }
  if (node.type === 'typed_parameter') {
    const name = node.namedChildren.find(
      (child) => child.type === 'identifier',
    );
    const type = node.childForFieldName('type');
    if (!name || !type)
      throw unsupported(node, 'Unsupported parameter syntax.');
    return { name: name.text, type: parseType(type) };
  }
  throw unsupported(
    node,
    'Default, keyword-only, and variadic parameters are not supported.',
  );
}

function parseType(node: Parser.SyntaxNode): CappyType {
  const name = node.type === 'type' ? node.namedChildren[0] : node;
  if (!name) return unknownType;
  if (name.type === 'generic_type') {
    const base = name.namedChildren[0]?.text;
    const parameters = name.namedChildren.find(
      (child) => child.type === 'type_parameter',
    )?.namedChildren;
    if (base === 'list' || base === 'List') {
      return {
        kind: 'array',
        elementType: parameters?.[0] ? parseType(parameters[0]) : unknownType,
      };
    }
    if (base === 'set' || base === 'Set') {
      return {
        kind: 'set',
        elementType: parameters?.[0] ? parseType(parameters[0]) : unknownType,
      };
    }
    if (base === 'dict' || base === 'Dict') {
      return {
        kind: 'map',
        keyType: parameters?.[0] ? parseType(parameters[0]) : unknownType,
        valueType: parameters?.[1] ? parseType(parameters[1]) : unknownType,
      };
    }
    return unknownType;
  }
  switch (name.text) {
    case 'int':
      return integerType;
    case 'bool':
      return booleanType;
    case 'str':
      return stringType;
    case 'None':
      return { kind: 'void' };
    default:
      return unknownType;
  }
}

function parseStatements(
  nodes: Parser.SyntaxNode[],
  names: Set<string>,
): Statement[] {
  return nodes.filter(isNotComment).map((node) => parseStatement(node, names));
}

function parseStatement(
  node: Parser.SyntaxNode,
  names: Set<string>,
): Statement {
  switch (node.type) {
    case 'expression_statement': {
      const expression = node.namedChildren[0];
      if (!expression) throw unsupported(node, 'Empty expression statement.');
      if (expression.type === 'assignment')
        return parseAssignment(expression, names);
      if (expression.type === 'typed_assignment')
        return parseTypedAssignment(expression, names);
      if (expression.type === 'augmented_assignment')
        return parseAugmentedAssignment(expression);
      return {
        kind: 'expressionStatement',
        expression: parseExpression(expression),
      };
    }
    case 'return_statement': {
      const value = node.namedChildren[0];
      return {
        kind: 'return',
        ...(value ? { value: parseExpression(value) } : {}),
      };
    }
    case 'assignment':
      return parseAssignment(node, names);
    case 'typed_assignment':
      return parseTypedAssignment(node, names);
    case 'augmented_assignment':
      return parseAugmentedAssignment(node);
    case 'if_statement':
      return parseIf(node, names);
    case 'for_statement':
      return parseFor(node, names);
    case 'while_statement': {
      const condition = node.childForFieldName('condition');
      const body = node.childForFieldName('body');
      if (!condition || !body) throw unsupported(node, 'Malformed while loop.');
      return {
        kind: 'while',
        condition: parseExpression(condition),
        body: parseStatements(body.namedChildren, names),
      };
    }
    case 'pass_statement':
      throw unsupported(node, 'pass statements are not supported.');
    default:
      throw unsupported(
        node,
        `Python ${node.type.replaceAll('_', ' ')} is not supported.`,
      );
  }
}

function parseAssignment(
  node: Parser.SyntaxNode,
  names: Set<string>,
): Statement {
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  if (!left || !right) throw unsupported(node, 'Malformed assignment.');
  const value = parseExpression(right);
  if (left.type === 'identifier' && !names.has(left.text)) {
    names.add(left.text);
    return {
      kind: 'variableDeclaration',
      name: left.text,
      type: inferType(value),
      initializer: value,
    };
  }
  return {
    kind: 'assignment',
    target: parseAssignable(left),
    value,
  };
}

function parseTypedAssignment(
  node: Parser.SyntaxNode,
  names: Set<string>,
): Statement {
  const left = node.childForFieldName('left');
  const typeNode = node.childForFieldName('type');
  const right = node.childForFieldName('right');
  if (!left || left.type !== 'identifier' || !typeNode) {
    throw unsupported(node, 'Only named variables can use type annotations.');
  }
  if (!right)
    throw unsupported(node, 'Annotated declarations must have an initializer.');
  names.add(left.text);
  return {
    kind: 'variableDeclaration',
    name: left.text,
    type: parseType(typeNode),
    initializer: parseExpression(right),
  };
}

function parseAugmentedAssignment(
  node: Parser.SyntaxNode,
): AssignmentStatement {
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  const operator = node.children.find((child) =>
    child.type.endsWith('='),
  )?.type;
  if (
    !left ||
    !right ||
    !operator ||
    !['+=', '-=', '*=', '/=', '%='].includes(operator)
  ) {
    throw unsupported(
      node,
      'Only arithmetic augmented assignments are supported.',
    );
  }
  const operation = operator.slice(0, -1);
  const binaryOperator = binaryOperatorFor(operation, node);
  const target = parseAssignable(left);
  return {
    kind: 'assignment',
    target,
    value: {
      kind: 'binary',
      operator: binaryOperator,
      left: target,
      right: parseExpression(right),
    },
  };
}

function parseIf(node: Parser.SyntaxNode, names: Set<string>): Statement {
  const condition = node.childForFieldName('condition');
  const consequence = node.childForFieldName('consequence');
  const alternative = node.childForFieldName('alternative');
  if (!condition || !consequence)
    throw unsupported(node, 'Malformed if statement.');
  const elseBody = alternative
    ? alternative.type === 'elif_clause'
      ? [parseIf(alternative, names)]
      : parseStatements(alternative.namedChildren, names)
    : undefined;
  return {
    kind: 'if',
    condition: parseExpression(condition),
    thenBody: parseStatements(consequence.namedChildren, names),
    ...(elseBody ? { elseBody } : {}),
  };
}

function parseFor(node: Parser.SyntaxNode, names: Set<string>): Statement {
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  const body = node.childForFieldName('body');
  if (!left || !right || !body || left.type !== 'identifier') {
    throw unsupported(
      node,
      'Only a single loop variable is supported in for loops.',
    );
  }
  const forRange = parseRangeLoop(left.text, right);
  if (forRange) {
    names.add(left.text);
    return { ...forRange, body: parseStatements(body.namedChildren, names) };
  }
  names.add(left.text);
  return {
    kind: 'forEach',
    variable: { name: left.text, type: unknownType },
    iterable: parseExpression(right),
    body: parseStatements(body.namedChildren, names),
  };
}

function parseRangeLoop(
  variableName: string,
  iterable: Parser.SyntaxNode,
): Omit<Extract<Statement, { kind: 'for' }>, 'body'> | undefined {
  if (
    iterable.type !== 'call' ||
    iterable.childForFieldName('function')?.text !== 'range'
  ) {
    return undefined;
  }
  const argumentsNode = iterable.childForFieldName('arguments');
  const arguments_ = argumentsNode?.namedChildren ?? [];
  if (arguments_.length < 1 || arguments_.length > 2) {
    throw unsupported(iterable, 'range() loops support one or two arguments.');
  }
  const start =
    arguments_.length === 2
      ? parseExpression(arguments_[0])
      : { kind: 'integerLiteral' as const, value: 0 };
  const stop = parseExpression(arguments_[arguments_.length - 1]);
  const variable: Expression = { kind: 'variable', name: variableName };
  return {
    kind: 'for',
    initializer: {
      kind: 'variableDeclaration',
      name: variableName,
      type: integerType,
      initializer: start,
    },
    condition: {
      kind: 'binary',
      operator: 'lessThan',
      left: variable,
      right: stop,
    },
    update: {
      kind: 'assignment',
      target: variable,
      value: {
        kind: 'binary',
        operator: 'add',
        left: variable,
        right: { kind: 'integerLiteral', value: 1 },
      },
    },
  };
}

function parseAssignable(node: Parser.SyntaxNode) {
  if (node.type === 'identifier')
    return { kind: 'variable' as const, name: node.text };
  if (node.type === 'subscript') {
    const collection = node.childForFieldName('value');
    const index = node.childForFieldName('subscript');
    if (collection && index) {
      return {
        kind: 'index' as const,
        collection: parseExpression(collection),
        index: parseExpression(index),
      };
    }
  }
  throw unsupported(
    node,
    'Only variables and collection indexes can be assigned.',
  );
}

function parseExpression(node: Parser.SyntaxNode): Expression {
  switch (node.type) {
    case 'integer':
      return {
        kind: 'integerLiteral',
        value: Number(node.text.replaceAll('_', '')),
      };
    case 'true':
      return { kind: 'booleanLiteral', value: true };
    case 'false':
      return { kind: 'booleanLiteral', value: false };
    case 'string':
      return { kind: 'stringLiteral', value: parseStringLiteral(node) };
    case 'identifier':
      return { kind: 'variable', name: node.text };
    case 'list':
      return {
        kind: 'arrayLiteral',
        elements: node.namedChildren.map(parseExpression),
        elementType: inferElements(node.namedChildren),
      };
    case 'set':
      return {
        kind: 'setLiteral',
        elements: node.namedChildren.map(parseExpression),
        elementType: inferElements(node.namedChildren),
      };
    case 'dictionary':
      return parseDictionary(node);
    case 'subscript': {
      const collection = node.childForFieldName('value');
      const index = node.childForFieldName('subscript');
      if (!collection || !index)
        throw unsupported(node, 'Malformed index expression.');
      return {
        kind: 'index',
        collection: parseExpression(collection),
        index: parseExpression(index),
      };
    }
    case 'call':
      return parseCall(node);
    case 'binary_operator':
      return parseBinary(node);
    case 'boolean_operator':
      return parseBoolean(node);
    case 'comparison_operator':
      return parseComparison(node);
    case 'not_operator':
      return {
        kind: 'unary',
        operator: 'not',
        operand: parseExpression(node.namedChildren[0]),
      };
    case 'unary_operator':
      if (node.children[0]?.type !== '-')
        throw unsupported(node, 'Unary plus is not supported.');
      return {
        kind: 'unary',
        operator: 'negate',
        operand: parseExpression(node.namedChildren[0]),
      };
    case 'parenthesized_expression':
      if (node.namedChildren.length !== 1)
        throw unsupported(node, 'Tuple expressions are not supported.');
      return parseExpression(node.namedChildren[0]);
    default:
      throw unsupported(
        node,
        `Python ${node.type.replaceAll('_', ' ')} expressions are not supported.`,
      );
  }
}

function parseDictionary(node: Parser.SyntaxNode): Expression {
  const pairs = node.namedChildren;
  if (pairs.length > 0 && pairs.some((pair) => pair.type !== 'pair')) {
    throw unsupported(node, 'Dictionary unpacking is not supported.');
  }
  if (pairs.length === 0) {
    return {
      kind: 'mapLiteral',
      entries: [],
      keyType: unknownType,
      valueType: unknownType,
    };
  }
  return {
    kind: 'mapLiteral',
    entries: pairs.map((pair) => {
      const key = pair.childForFieldName('key');
      const value = pair.childForFieldName('value');
      if (!key || !value)
        throw unsupported(pair, 'Malformed dictionary entry.');
      return { key: parseExpression(key), value: parseExpression(value) };
    }),
    keyType: inferElements(
      pairs.map((pair) => pair.childForFieldName('key')).filter(isNode),
    ),
    valueType: inferElements(
      pairs.map((pair) => pair.childForFieldName('value')).filter(isNode),
    ),
  };
}

function parseCall(node: Parser.SyntaxNode): Expression {
  const fn = node.childForFieldName('function');
  const argsNode = node.childForFieldName('arguments');
  if (!fn || !argsNode) throw unsupported(node, 'Malformed call expression.');
  const args = argsNode.namedChildren.map(parseExpression);
  if (fn.type === 'identifier') {
    if (fn.text === 'len' && args.length === 1) {
      return {
        kind: 'collectionOperation',
        operation: 'length',
        collection: args[0],
        arguments: [],
      };
    }
    if (fn.text === 'set' && args.length === 0) {
      return { kind: 'setLiteral', elements: [], elementType: unknownType };
    }
    if (fn.text === 'list' && args.length === 0) {
      return { kind: 'arrayLiteral', elements: [], elementType: unknownType };
    }
    return { kind: 'call', functionName: fn.text, arguments: args };
  }
  if (fn.type === 'attribute') {
    const object = fn.childForFieldName('object');
    const method = fn.childForFieldName('attribute');
    if (!object || !method) throw unsupported(fn, 'Unsupported method call.');
    const collection = parseExpression(object);
    const operation = collectionOperationFor(method.text, args.length);
    if (operation)
      return {
        kind: 'collectionOperation',
        operation,
        collection,
        arguments: args,
      };
  }
  throw unsupported(
    fn,
    'Only named functions and supported collection methods can be called.',
  );
}

function collectionOperationFor(
  method: string,
  argumentCount: number,
): 'add' | 'remove' | 'append' | 'get' | undefined {
  if (method === 'add' && argumentCount === 1) return 'add';
  if (method === 'remove' && argumentCount === 1) return 'remove';
  if (method === 'append' && argumentCount === 1) return 'append';
  if (method === 'get' && argumentCount >= 1 && argumentCount <= 2)
    return 'get';
  return undefined;
}

function parseBinary(node: Parser.SyntaxNode): Expression {
  const left = node.childForFieldName('left');
  const right = node.childForFieldName('right');
  const operator = node.children.find((child) => !child.isNamed)?.type;
  if (!left || !right || !operator)
    throw unsupported(node, 'Malformed binary expression.');
  return {
    kind: 'binary',
    operator: binaryOperatorFor(operator, node),
    left: parseExpression(left),
    right: parseExpression(right),
  };
}

function parseBoolean(node: Parser.SyntaxNode): Expression {
  const [left, right] = node.namedChildren;
  const operator = node.children.find((child) => !child.isNamed)?.type;
  if (!left || !right || !operator || !['and', 'or'].includes(operator)) {
    throw unsupported(node, 'Malformed boolean expression.');
  }
  return {
    kind: 'binary',
    operator: operator === 'and' ? 'and' : 'or',
    left: parseExpression(left),
    right: parseExpression(right),
  };
}

function parseComparison(node: Parser.SyntaxNode): Expression {
  const [leftNode, rightNode] = node.namedChildren;
  const operators = node.children
    .filter((child) => !child.isNamed)
    .map((child) => child.text);
  if (!leftNode || !rightNode || node.namedChildren.length !== 2) {
    throw unsupported(node, 'Chained comparisons are not supported.');
  }
  const left = parseExpression(leftNode);
  const right = parseExpression(rightNode);
  const operator = operators.join(' ');
  if (operator === 'in' || operator === 'not in') {
    const contains: Expression = {
      kind: 'collectionOperation',
      operation: 'contains',
      collection: right,
      arguments: [left],
    };
    return operator === 'not in'
      ? { kind: 'unary', operator: 'not', operand: contains }
      : contains;
  }
  if (operator === '==')
    return { kind: 'binary', operator: 'equal', left, right };
  if (operator === '!=')
    return { kind: 'binary', operator: 'notEqual', left, right };
  return {
    kind: 'binary',
    operator: binaryOperatorFor(operator, node),
    left,
    right,
  };
}

function binaryOperatorFor(
  operator: string,
  node: Parser.SyntaxNode,
): Extract<Expression, { kind: 'binary' }>['operator'] {
  switch (operator) {
    case '+':
      return 'add';
    case '-':
      return 'subtract';
    case '*':
      return 'multiply';
    case '/':
      return 'divide';
    case '%':
      return 'remainder';
    case '==':
      return 'equal';
    case '!=':
      return 'notEqual';
    case '<':
      return 'lessThan';
    case '<=':
      return 'lessThanOrEqual';
    case '>':
      return 'greaterThan';
    case '>=':
      return 'greaterThanOrEqual';
    default:
      throw unsupported(
        node,
        `Python operator '${operator}' is not supported.`,
      );
  }
}

function inferElements(nodes: Parser.SyntaxNode[]): CappyType {
  if (nodes.length === 0) return unknownType;
  return inferType(parseExpression(nodes[0]));
}

function inferType(expression: Expression): CappyType {
  switch (expression.kind) {
    case 'integerLiteral':
      return integerType;
    case 'booleanLiteral':
      return booleanType;
    case 'stringLiteral':
      return stringType;
    case 'arrayLiteral':
      return { kind: 'array', elementType: expression.elementType };
    case 'setLiteral':
      return { kind: 'set', elementType: expression.elementType };
    case 'mapLiteral':
      return {
        kind: 'map',
        keyType: expression.keyType,
        valueType: expression.valueType,
      };
    default:
      return unknownType;
  }
}

function parseStringLiteral(node: Parser.SyntaxNode): string {
  const text = node.text;
  const quote = text[0];
  if (
    (quote !== '"' && quote !== "'") ||
    (text[1] === quote && text[2] === quote)
  ) {
    throw unsupported(
      node,
      'Prefixed and triple-quoted strings are not supported.',
    );
  }
  const content = text.slice(1, -1);
  return content.replace(/\\([\\'"nrt])/g, (_match, escaped: string) => {
    switch (escaped) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return escaped;
    }
  });
}

function emitFunction(
  declaration: FunctionDeclaration,
  depth: number,
  isMethod: boolean,
): string[] {
  const indent = '    '.repeat(depth);
  const parameters = [
    ...(isMethod ? ['self'] : []),
    ...declaration.parameters.map(
      (parameter) => `${parameter.name}${emitTypeAnnotation(parameter.type)}`,
    ),
  ];
  const returnType = emitReturnType(declaration.returnType);
  const lines = [
    `${indent}def ${declaration.name}(${parameters.join(', ')})${returnType}:`,
  ];
  const body = declaration.body.flatMap((statement) =>
    emitStatement(statement, depth + 1),
  );
  return [...lines, ...(body.length ? body : [`${indent}    pass`])];
}

function emitStatement(statement: Statement, depth: number): string[] {
  const indent = '    '.repeat(depth);
  if (statement.kind === 'variableDeclaration') {
    return [
      `${indent}${statement.name} = ${statement.initializer ? emitExpression(statement.initializer) : 'None'}`,
    ];
  }
  if (statement.kind === 'assignment') {
    return [
      `${indent}${emitExpression(statement.target)} = ${emitExpression(statement.value)}`,
    ];
  }
  if (statement.kind === 'expressionStatement') {
    const expression = statement.expression;
    if (
      expression.kind === 'collectionOperation' &&
      expression.operation === 'add' &&
      expression.arguments.length === 2
    ) {
      return [
        `${indent}${emitExpression(expression.collection)}[${emitExpression(expression.arguments[0])}] = ${emitExpression(expression.arguments[1])}`,
      ];
    }
    return [`${indent}${emitExpression(expression)}`];
  }
  if (statement.kind === 'return') {
    return [
      `${indent}return${statement.value ? ` ${emitExpression(statement.value)}` : ''}`,
    ];
  }
  if (statement.kind === 'if') {
    const lines = [`${indent}if ${emitExpression(statement.condition)}:`];
    const thenBody = statement.thenBody.flatMap((child) =>
      emitStatement(child, depth + 1),
    );
    lines.push(...(thenBody.length ? thenBody : [`${indent}    pass`]));
    if (statement.elseBody) {
      lines.push(`${indent}else:`);
      const elseBody = statement.elseBody.flatMap((child) =>
        emitStatement(child, depth + 1),
      );
      lines.push(...(elseBody.length ? elseBody : [`${indent}    pass`]));
    }
    return lines;
  }
  if (statement.kind === 'forEach') {
    return emitBlock(
      `${indent}for ${statement.variable.name} in ${emitExpression(statement.iterable)}:`,
      statement.body,
      depth,
    );
  }
  if (statement.kind === 'while') {
    return emitBlock(
      `${indent}while ${emitExpression(statement.condition)}:`,
      statement.body,
      depth,
    );
  }
  return emitCountedFor(statement, depth);
}

function emitCountedFor(
  statement: Extract<Statement, { kind: 'for' }>,
  depth: number,
): string[] {
  const range = asRangeLoop(statement);
  if (range)
    return emitBlock(`${'    '.repeat(depth)}${range}`, statement.body, depth);
  const indent = '    '.repeat(depth);
  const lines: string[] = [];
  if (statement.initializer)
    lines.push(...emitStatement(statement.initializer, depth));
  lines.push(
    `${indent}while ${statement.condition ? emitExpression(statement.condition) : 'True'}:`,
  );
  const body = statement.body.flatMap((child) =>
    emitStatement(child, depth + 1),
  );
  lines.push(...(body.length ? body : [`${indent}    pass`]));
  if (statement.update)
    lines.push(...emitStatement(statement.update, depth + 1));
  return lines;
}

function asRangeLoop(
  statement: Extract<Statement, { kind: 'for' }>,
): string | undefined {
  if (
    statement.initializer?.kind !== 'variableDeclaration' ||
    !statement.initializer.initializer ||
    statement.condition?.kind !== 'binary' ||
    statement.condition.operator !== 'lessThan' ||
    statement.update?.target.kind !== 'variable' ||
    statement.update.value.kind !== 'binary' ||
    statement.update.value.operator !== 'add' ||
    statement.update.value.left.kind !== 'variable' ||
    statement.update.value.left.name !== statement.initializer.name ||
    statement.update.value.right.kind !== 'integerLiteral' ||
    statement.update.value.right.value !== 1
  )
    return undefined;
  if (
    statement.condition.left.kind !== 'variable' ||
    statement.condition.left.name !== statement.initializer.name
  )
    return undefined;
  const start = emitExpression(statement.initializer.initializer);
  const stop = emitExpression(statement.condition.right);
  return `for ${statement.initializer.name} in range(${start === '0' ? stop : `${start}, ${stop}`}):`;
}

function emitBlock(header: string, body: Statement[], depth: number): string[] {
  const indent = '    '.repeat(depth);
  const lines = [header];
  const emittedBody = body.flatMap((statement) =>
    emitStatement(statement, depth + 1),
  );
  lines.push(...(emittedBody.length ? emittedBody : [`${indent}    pass`]));
  return lines;
}

function emitExpression(expression: Expression, minimumPrecedence = 0): string {
  if (expression.kind === 'integerLiteral') return String(expression.value);
  if (expression.kind === 'booleanLiteral')
    return expression.value ? 'True' : 'False';
  if (expression.kind === 'stringLiteral')
    return JSON.stringify(expression.value);
  if (expression.kind === 'variable') return expression.name;
  if (expression.kind === 'arrayLiteral')
    return `[${expression.elements.map((element) => emitExpression(element)).join(', ')}]`;
  if (expression.kind === 'mapLiteral') {
    return `{${expression.entries.map(({ key, value }) => `${emitExpression(key)}: ${emitExpression(value)}`).join(', ')}}`;
  }
  if (expression.kind === 'setLiteral') {
    return expression.elements.length === 0
      ? 'set()'
      : `{${expression.elements.map((element) => emitExpression(element)).join(', ')}}`;
  }
  if (expression.kind === 'index')
    return `${emitExpression(expression.collection)}[${emitExpression(expression.index)}]`;
  if (expression.kind === 'call')
    return `${expression.functionName}(${expression.arguments.map((argument) => emitExpression(argument)).join(', ')})`;
  if (expression.kind === 'unary') {
    if (
      expression.operator === 'not' &&
      expression.operand.kind === 'collectionOperation' &&
      expression.operand.operation === 'contains'
    ) {
      const [value] = expression.operand.arguments;
      return `${value ? emitExpression(value) : ''} not in ${emitExpression(expression.operand.collection)}`;
    }
    const operator = expression.operator === 'not' ? 'not ' : '-';
    const operandPrecedence = expression.operator === 'not' ? 3 : 7;
    const rendered = `${operator}${emitExpression(expression.operand, operandPrecedence)}`;
    return expressionPrecedence(expression) < minimumPrecedence
      ? `(${rendered})`
      : rendered;
  }
  if (expression.kind === 'binary') {
    const operator = {
      add: '+',
      subtract: '-',
      multiply: '*',
      divide: '/',
      remainder: '%',
      equal: '==',
      notEqual: '!=',
      lessThan: '<',
      lessThanOrEqual: '<=',
      greaterThan: '>',
      greaterThanOrEqual: '>=',
      and: 'and',
      or: 'or',
    }[expression.operator];
    const precedence = expressionPrecedence(expression);
    const rendered = `${emitExpression(expression.left, precedence)} ${operator} ${emitExpression(expression.right, precedence + 1)}`;
    return precedence < minimumPrecedence ? `(${rendered})` : rendered;
  }
  const rendered = emitCollectionOperation(expression);
  return expressionPrecedence(expression) < minimumPrecedence
    ? `(${rendered})`
    : rendered;
}

function expressionPrecedence(expression: Expression): number {
  if (expression.kind === 'binary') {
    if (expression.operator === 'or') return 1;
    if (expression.operator === 'and') return 2;
    if (
      [
        'equal',
        'notEqual',
        'lessThan',
        'lessThanOrEqual',
        'greaterThan',
        'greaterThanOrEqual',
      ].includes(expression.operator)
    )
      return 4;
    if (expression.operator === 'add' || expression.operator === 'subtract')
      return 5;
    return 6;
  }
  if (
    expression.kind === 'collectionOperation' &&
    expression.operation === 'contains'
  )
    return 4;
  if (expression.kind === 'unary') return expression.operator === 'not' ? 3 : 7;
  return 8;
}

function emitCollectionOperation(
  expression: Extract<Expression, { kind: 'collectionOperation' }>,
): string {
  const collection = emitExpression(expression.collection);
  const argument = expression.arguments[0]
    ? emitExpression(expression.arguments[0])
    : '';
  switch (expression.operation) {
    case 'length':
      return `len(${collection})`;
    case 'contains':
      return `${argument} in ${collection}`;
    case 'append':
      return `${collection}.append(${argument})`;
    case 'add':
      return `${collection}.add(${expression.arguments.map((argument) => emitExpression(argument)).join(', ')})`;
    case 'remove':
      return `${collection}.remove(${argument})`;
    case 'get':
      return `${collection}.get(${expression.arguments.map((argument) => emitExpression(argument)).join(', ')})`;
  }
}

function emitTypeAnnotation(type: CappyType): string {
  switch (type.kind) {
    case 'integer':
      return ': int';
    case 'boolean':
      return ': bool';
    case 'string':
      return ': str';
    case 'void':
      return ': None';
    case 'unknown':
      return '';
    case 'array':
      return `: list${emitGeneric(type.elementType)}`;
    case 'set':
      return `: set${emitGeneric(type.elementType)}`;
    case 'map':
      return `: dict[${emitTypeName(type.keyType)}, ${emitTypeName(type.valueType)}]`;
  }
}

function emitReturnType(type: CappyType): string {
  return type.kind === 'unknown' ? '' : ` -> ${emitTypeName(type)}`;
}

function emitGeneric(type: CappyType): string {
  return type.kind === 'unknown' ? '' : `[${emitTypeName(type)}]`;
}

function emitTypeName(type: CappyType): string {
  switch (type.kind) {
    case 'integer':
      return 'int';
    case 'boolean':
      return 'bool';
    case 'string':
      return 'str';
    case 'void':
      return 'None';
    case 'unknown':
      return 'object';
    case 'array':
      return `list${emitGeneric(type.elementType)}`;
    case 'set':
      return `set${emitGeneric(type.elementType)}`;
    case 'map':
      return `dict[${emitTypeName(type.keyType)}, ${emitTypeName(type.valueType)}]`;
  }
}

function fieldText(node: Parser.SyntaxNode, field: string): string | undefined {
  return node.childForFieldName(field)?.text;
}

function findSyntaxError(
  node: Parser.SyntaxNode,
): Parser.SyntaxNode | undefined {
  if (node.type === 'ERROR' || node.isMissing) return node;
  for (const child of node.children) {
    const error = findSyntaxError(child);
    if (error) return error;
  }
  return undefined;
}

function diagnosticAt(
  node: Parser.SyntaxNode,
  message: string,
): ParseDiagnostic {
  return {
    message,
    location: {
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
    },
  };
}

function unsupported(
  node: Parser.SyntaxNode,
  message: string,
): UnsupportedPythonSyntax {
  return new UnsupportedPythonSyntax(message, node);
}

function isNode(node: Parser.SyntaxNode | null): node is Parser.SyntaxNode {
  return node !== null;
}

function isNotComment(node: Parser.SyntaxNode): boolean {
  return node.type !== 'comment';
}
