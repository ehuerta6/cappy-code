import type { CappyEmitter, EmitResult } from '../contracts';
import type {
  CappyType,
  Declaration,
  Expression,
  Program,
  Statement,
} from '../ir';

type TypeScope = Map<string, CappyType>;

function unsupported(message: string): never {
  throw new Error(`Cannot emit C++: ${message}`);
}

function cppType(type: CappyType): string {
  switch (type.kind) {
    case 'integer':
      return 'int';
    case 'boolean':
      return 'bool';
    case 'string':
      return 'std::string';
    case 'void':
      return 'void';
    case 'array':
      return `std::vector<${cppType(type.elementType)}>`;
    case 'map':
      return `std::unordered_map<${cppType(type.keyType)}, ${cppType(type.valueType)}>`;
    case 'set':
      return `std::unordered_set<${cppType(type.elementType)}>`;
    case 'unknown':
      return unsupported('the IR contains an unknown type.');
  }
}

function collectHeaders(program: Program): Set<string> {
  const headers = new Set<string>();
  const visitType = (type: CappyType): void => {
    if (type.kind === 'string') headers.add('#include <string>');
    if (type.kind === 'array') {
      headers.add('#include <vector>');
      visitType(type.elementType);
    }
    if (type.kind === 'map') {
      headers.add('#include <unordered_map>');
      visitType(type.keyType);
      visitType(type.valueType);
    }
    if (type.kind === 'set') {
      headers.add('#include <unordered_set>');
      visitType(type.elementType);
    }
  };
  const visitExpression = (expression: Expression): void => {
    switch (expression.kind) {
      case 'arrayLiteral':
        headers.add('#include <vector>');
        visitType(expression.elementType);
        expression.elements.forEach(visitExpression);
        break;
      case 'mapLiteral':
        headers.add('#include <unordered_map>');
        visitType(expression.keyType);
        visitType(expression.valueType);
        expression.entries.forEach(({ key, value }) => {
          visitExpression(key);
          visitExpression(value);
        });
        break;
      case 'setLiteral':
        headers.add('#include <unordered_set>');
        visitType(expression.elementType);
        expression.elements.forEach(visitExpression);
        break;
      case 'binary':
        visitExpression(expression.left);
        visitExpression(expression.right);
        break;
      case 'unary':
        visitExpression(expression.operand);
        break;
      case 'call':
        expression.arguments.forEach(visitExpression);
        break;
      case 'index':
        visitExpression(expression.collection);
        visitExpression(expression.index);
        break;
      case 'collectionOperation':
        visitExpression(expression.collection);
        expression.arguments.forEach(visitExpression);
        break;
      case 'integerLiteral':
      case 'booleanLiteral':
      case 'stringLiteral':
      case 'variable':
        if (expression.kind === 'stringLiteral')
          headers.add('#include <string>');
        break;
    }
  };
  const visitStatement = (statement: Statement): void => {
    switch (statement.kind) {
      case 'variableDeclaration':
        visitType(statement.type);
        if (statement.initializer) visitExpression(statement.initializer);
        break;
      case 'assignment':
        visitExpression(statement.target);
        visitExpression(statement.value);
        break;
      case 'if':
        visitExpression(statement.condition);
        statement.thenBody.forEach(visitStatement);
        statement.elseBody?.forEach(visitStatement);
        break;
      case 'forEach':
        visitType(statement.variable.type);
        visitExpression(statement.iterable);
        statement.body.forEach(visitStatement);
        break;
      case 'for':
        if (statement.initializer) visitStatement(statement.initializer);
        if (statement.condition) visitExpression(statement.condition);
        if (statement.update) visitStatement(statement.update);
        statement.body.forEach(visitStatement);
        break;
      case 'while':
        visitExpression(statement.condition);
        statement.body.forEach(visitStatement);
        break;
      case 'return':
        if (statement.value) visitExpression(statement.value);
        break;
      case 'expressionStatement':
        visitExpression(statement.expression);
        break;
    }
  };
  const visitFunction = (
    fn: Extract<Declaration, { kind: 'function' }>,
  ): void => {
    visitType(fn.returnType);
    fn.parameters.forEach(({ type }) => visitType(type));
    fn.body.forEach(visitStatement);
  };
  program.declarations.forEach((declaration) => {
    if (declaration.kind === 'function') visitFunction(declaration);
    else declaration.methods.forEach(visitFunction);
  });
  return headers;
}

function indent(level: number): string {
  return '  '.repeat(level);
}

function emitParameters(
  parameters: { name: string; type: CappyType }[],
): string {
  return parameters
    .map(({ name, type }) => {
      const passByReference =
        type.kind === 'array' || type.kind === 'map' || type.kind === 'set';
      return `${cppType(type)}${passByReference ? '&' : ''} ${name}`;
    })
    .join(', ');
}

function emitDeclaration(declaration: Declaration): string {
  if (declaration.kind === 'function')
    return emitFunction(declaration, 0, new Map());
  const methods = declaration.methods
    .map((method) => emitFunction(method, 1, new Map()))
    .join('\n\n');
  return `class ${declaration.name} {\npublic:${methods ? `\n${methods}` : ''}\n};`;
}

function emitFunction(
  fn: Extract<Declaration, { kind: 'function' }>,
  level: number,
  parentScope: TypeScope,
): string {
  const scope = new Map(parentScope);
  fn.parameters.forEach(({ name, type }) => scope.set(name, type));
  const signature = `${indent(level)}${cppType(fn.returnType)} ${fn.name}(${emitParameters(fn.parameters)})`;
  const body = fn.body
    .map((statement) => emitStatement(statement, level + 1, scope))
    .join('\n');
  return `${signature} {${body ? `\n${body}\n${indent(level)}` : ''}}`;
}

function emitStatement(
  statement: Statement,
  level: number,
  scope: TypeScope,
): string {
  const pad = indent(level);
  switch (statement.kind) {
    case 'variableDeclaration': {
      scope.set(statement.name, statement.type);
      const initializer = statement.initializer
        ? emitExpression(statement.initializer, scope)
        : statement.type.kind === 'array' ||
            statement.type.kind === 'map' ||
            statement.type.kind === 'set'
          ? '{}'
          : unsupported(`variable ${statement.name} has no initializer.`);
      return `${pad}${cppType(statement.type)} ${statement.name} = ${initializer};`;
    }
    case 'assignment':
      return `${pad}${emitExpression(statement.target, scope)} = ${emitExpression(statement.value, scope)};`;
    case 'if': {
      const thenBody = emitBody(statement.thenBody, level + 1, scope);
      const elseBody = statement.elseBody
        ? ` else {\n${emitBody(statement.elseBody, level + 1, scope)}\n${pad}}`
        : '';
      return `${pad}if (${emitExpression(statement.condition, scope)}) {\n${thenBody}\n${pad}}${elseBody}`;
    }
    case 'forEach': {
      const loopScope = new Map(scope);
      loopScope.set(statement.variable.name, statement.variable.type);
      const body = emitBody(statement.body, level + 1, loopScope);
      return `${pad}for (${cppType(statement.variable.type)} ${statement.variable.name} : ${emitExpression(statement.iterable, scope)}) {\n${body}\n${pad}}`;
    }
    case 'for': {
      const loopScope = new Map(scope);
      const initializer = statement.initializer
        ? emitForInitializer(statement.initializer, loopScope)
        : '';
      const condition = statement.condition
        ? emitExpression(statement.condition, loopScope)
        : '';
      const update = statement.update
        ? emitForUpdate(statement.update, loopScope)
        : '';
      const body = emitBody(statement.body, level + 1, loopScope);
      return `${pad}for (${initializer}; ${condition}; ${update}) {\n${body}\n${pad}}`;
    }
    case 'while':
      return `${pad}while (${emitExpression(statement.condition, scope)}) {\n${emitBody(statement.body, level + 1, new Map(scope))}\n${pad}}`;
    case 'return':
      return `${pad}return${statement.value ? ` ${emitExpression(statement.value, scope)}` : ''};`;
    case 'expressionStatement':
      return `${pad}${emitExpression(statement.expression, scope)};`;
  }
}

function emitBody(
  statements: Statement[],
  level: number,
  scope: TypeScope,
): string {
  const local = new Map(scope);
  return statements
    .map((statement) => emitStatement(statement, level, local))
    .join('\n');
}

function emitForInitializer(statement: Statement, scope: TypeScope): string {
  if (statement.kind !== 'variableDeclaration')
    return unsupported('for-loop initializers must be declarations.');
  scope.set(statement.name, statement.type);
  const initializer = statement.initializer
    ? emitExpression(statement.initializer, scope)
    : '{}';
  return `${cppType(statement.type)} ${statement.name} = ${initializer}`;
}

function emitForUpdate(
  statement: Extract<Statement, { kind: 'assignment' }>,
  scope: TypeScope,
): string {
  return `${emitExpression(statement.target, scope)} = ${emitExpression(statement.value, scope)}`;
}

function emitExpression(expression: Expression, scope: TypeScope): string {
  switch (expression.kind) {
    case 'integerLiteral':
      return String(expression.value);
    case 'booleanLiteral':
      return expression.value ? 'true' : 'false';
    case 'stringLiteral':
      return JSON.stringify(expression.value);
    case 'variable':
      return expression.name;
    case 'arrayLiteral':
      return `{${expression.elements.map((item) => emitExpression(item, scope)).join(', ')}}`;
    case 'mapLiteral':
      return `{${expression.entries.map(({ key, value }) => `{${emitExpression(key, scope)}, ${emitExpression(value, scope)}}`).join(', ')}}`;
    case 'setLiteral':
      return `{${expression.elements.map((item) => emitExpression(item, scope)).join(', ')}}`;
    case 'binary': {
      const operators: Record<typeof expression.operator, string> = {
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
        and: '&&',
        or: '||',
      };
      return `(${emitExpression(expression.left, scope)} ${operators[expression.operator]} ${emitExpression(expression.right, scope)})`;
    }
    case 'unary':
      return expression.operator === 'not'
        ? `!(${emitExpression(expression.operand, scope)})`
        : `(-${emitExpression(expression.operand, scope)})`;
    case 'call':
      return `${expression.functionName}(${expression.arguments
        .map((argument) => emitExpression(argument, scope))
        .join(', ')})`;
    case 'index':
      return `${emitExpression(expression.collection, scope)}[${emitExpression(expression.index, scope)}]`;
    case 'collectionOperation': {
      const collection = emitExpression(expression.collection, scope);
      const argumentsText = expression.arguments.map((argument) =>
        emitExpression(argument, scope),
      );
      const type =
        expression.collection.kind === 'variable'
          ? scope.get(expression.collection.name)
          : undefined;
      switch (expression.operation) {
        case 'length':
          return `${collection}.size()`;
        case 'contains':
          if (type?.kind !== 'map' && type?.kind !== 'set')
            return unsupported('membership requires a map or set.');
          return `${collection}.find(${argumentsText[0]}) != ${collection}.end()`;
        case 'add':
          if (type?.kind === 'map')
            return `${collection}.insert({${argumentsText.join(', ')}})`;
          if (type?.kind === 'set')
            return `${collection}.insert(${argumentsText[0]})`;
          return unsupported('add requires a map or set.');
        case 'remove':
          if (type?.kind !== 'map' && type?.kind !== 'set')
            return unsupported('remove requires a map or set.');
          return `${collection}.erase(${argumentsText[0]})`;
        case 'append':
          if (type?.kind !== 'array')
            return unsupported('append requires a vector.');
          return `${collection}.push_back(${argumentsText[0]})`;
        case 'get':
          if (type?.kind !== 'map') return unsupported('get requires a map.');
          return `${collection}[${argumentsText[0]}]`;
      }
    }
  }
}

export class CppEmitter implements CappyEmitter {
  readonly language = 'cpp' as const;

  emit(program: Program): EmitResult {
    const headers = [...collectHeaders(program)].sort();
    const declarations = program.declarations.map(emitDeclaration).join('\n\n');
    return {
      code: `${headers.length ? `${headers.join('\n')}\n\n` : ''}${declarations}\n`,
    };
  }
}
