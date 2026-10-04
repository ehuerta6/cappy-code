import type {
  CappyType,
  Expression,
  FunctionDeclaration,
  Program,
  Statement,
} from '../ir';
import type { CappyEmitter, EmitResult } from '../contracts';

function javaType(type: CappyType): string {
  switch (type.kind) {
    case 'integer':
      return 'int';
    case 'boolean':
      return 'boolean';
    case 'string':
      return 'String';
    case 'void':
      return 'void';
    case 'unknown':
      return 'Object';
    case 'array':
      return `List<${javaGenericType(type.elementType)}>`;
    case 'map':
      return `Map<${javaGenericType(type.keyType)}, ${javaGenericType(type.valueType)}>`;
    case 'set':
      return `Set<${javaGenericType(type.elementType)}>`;
  }
}

function javaGenericType(type: CappyType): string {
  switch (type.kind) {
    case 'integer':
      return 'Integer';
    case 'boolean':
      return 'Boolean';
    case 'string':
      return 'String';
    case 'array':
      return javaType(type);
    case 'map':
      return javaType(type);
    case 'set':
      return javaType(type);
    case 'void':
    case 'unknown':
      return 'Object';
  }
}

function collectVariableTypes(
  statements: Statement[],
  types: Map<string, CappyType>,
): void {
  for (const statement of statements) {
    switch (statement.kind) {
      case 'variableDeclaration':
        types.set(statement.name, statement.type);
        break;
      case 'forEach':
        types.set(statement.variable.name, statement.variable.type);
        collectVariableTypes(statement.body, types);
        break;
      case 'for':
        if (statement.initializer?.kind === 'variableDeclaration') {
          types.set(statement.initializer.name, statement.initializer.type);
        }
        collectVariableTypes(statement.body, types);
        break;
      case 'if':
        collectVariableTypes(statement.thenBody, types);
        if (statement.elseBody) collectVariableTypes(statement.elseBody, types);
        break;
      case 'while':
        collectVariableTypes(statement.body, types);
        break;
    }
  }
}

function expression(node: Expression, types: Map<string, CappyType>): string {
  switch (node.kind) {
    case 'integerLiteral':
    case 'booleanLiteral':
      return String(node.value);
    case 'stringLiteral':
      return JSON.stringify(node.value);
    case 'variable':
      return node.name;
    case 'binary': {
      const operators = {
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
      return `(${expression(node.left, types)} ${operators[node.operator]} ${expression(node.right, types)})`;
    }
    case 'unary':
      return `${node.operator === 'not' ? '!' : '-'}${expression(node.operand, types)}`;
    case 'call':
      return `${node.functionName}(${node.arguments.map((argument) => expression(argument, types)).join(', ')})`;
    case 'index':
      return `${expression(node.collection, types)}.get(${expression(node.index, types)})`;
    case 'arrayLiteral':
      return node.elements.length
        ? `new ArrayList<>(Arrays.asList(${node.elements.map((item) => expression(item, types)).join(', ')}))`
        : 'new ArrayList<>()';
    case 'mapLiteral':
      return node.entries.length
        ? `new HashMap<>(Map.ofEntries(${node.entries
            .map(
              (entry) =>
                `Map.entry(${expression(entry.key, types)}, ${expression(entry.value, types)})`,
            )
            .join(', ')}))`
        : 'new HashMap<>()';
    case 'setLiteral':
      return node.elements.length
        ? `new HashSet<>(Arrays.asList(${node.elements.map((item) => expression(item, types)).join(', ')}))`
        : 'new HashSet<>()';
    case 'collectionOperation': {
      const collection = expression(node.collection, types);
      const args = node.arguments.map((argument) =>
        expression(argument, types),
      );
      const collectionType =
        node.collection.kind === 'variable'
          ? types.get(node.collection.name)
          : undefined;
      switch (node.operation) {
        case 'length':
          return `${collection}.size()`;
        case 'contains':
          return `${collection}.${collectionType?.kind === 'map' ? 'containsKey' : 'contains'}(${args[0]})`;
        case 'add':
          return `${collection}.${collectionType?.kind === 'map' ? 'put' : 'add'}(${args.join(', ')})`;
        case 'append':
          return `${collection}.add(${args[0]})`;
        case 'remove':
          return `${collection}.remove(${args[0]})`;
        case 'get':
          return `${collection}.get(${args[0]})`;
      }
    }
  }
}

function assignment(
  target: Extract<Statement, { kind: 'assignment' }>['target'],
  value: Expression,
  types: Map<string, CappyType>,
): string {
  if (target.kind === 'variable') {
    return `${target.name} = ${expression(value, types)}`;
  }
  return `${expression(target.collection, types)}.set(${expression(target.index, types)}, ${expression(value, types)})`;
}

function statement(
  node: Statement,
  types: Map<string, CappyType>,
  depth: number,
): string[] {
  const indent = '  '.repeat(depth);
  switch (node.kind) {
    case 'variableDeclaration':
      return [
        `${indent}${javaType(node.type)} ${node.name}${node.initializer ? ` = ${expression(node.initializer, types)}` : ''};`,
      ];
    case 'assignment': {
      return [`${indent}${assignment(node.target, node.value, types)};`];
    }
    case 'expressionStatement':
      return [`${indent}${expression(node.expression, types)};`];
    case 'return':
      return [
        `${indent}return${node.value ? ` ${expression(node.value, types)}` : ''};`,
      ];
    case 'if': {
      const lines = [`${indent}if (${expression(node.condition, types)}) {`];
      for (const item of node.thenBody)
        lines.push(...statement(item, types, depth + 1));
      if (node.elseBody) {
        lines.push(`${indent}} else {`);
        for (const item of node.elseBody)
          lines.push(...statement(item, types, depth + 1));
      }
      lines.push(`${indent}}`);
      return lines;
    }
    case 'while': {
      const lines = [`${indent}while (${expression(node.condition, types)}) {`];
      for (const item of node.body)
        lines.push(...statement(item, types, depth + 1));
      lines.push(`${indent}}`);
      return lines;
    }
    case 'forEach': {
      const lines = [
        `${indent}for (${javaType(node.variable.type)} ${node.variable.name} : ${expression(node.iterable, types)}) {`,
      ];
      for (const item of node.body)
        lines.push(...statement(item, types, depth + 1));
      lines.push(`${indent}}`);
      return lines;
    }
    case 'for': {
      const initializer = node.initializer
        ? inlineStatement(node.initializer, types)
        : '';
      const condition = node.condition ? expression(node.condition, types) : '';
      const update = node.update
        ? assignment(node.update.target, node.update.value, types)
        : '';
      const lines = [
        `${indent}for (${initializer}; ${condition}; ${update}) {`,
      ];
      for (const item of node.body)
        lines.push(...statement(item, types, depth + 1));
      lines.push(`${indent}}`);
      return lines;
    }
  }
}

function inlineStatement(
  node: Statement,
  types: Map<string, CappyType>,
): string {
  if (node.kind === 'variableDeclaration') {
    return `${javaType(node.type)} ${node.name}${node.initializer ? ` = ${expression(node.initializer, types)}` : ''}`;
  }
  if (node.kind === 'assignment') {
    return assignment(node.target, node.value, types);
  }
  return '';
}

function method(
  name: string,
  parameters: FunctionDeclaration['parameters'],
  returnType: CappyType,
  body: Statement[],
  isStatic: boolean,
): string[] {
  const types = new Map(
    parameters.map(({ name: parameterName, type }) => [parameterName, type]),
  );
  collectVariableTypes(body, types);
  const signature = `${isStatic ? 'public static' : 'public'} ${javaType(returnType)} ${name}(${parameters
    .map(
      ({ name: parameterName, type }) => `${javaType(type)} ${parameterName}`,
    )
    .join(', ')}) {`;
  const lines = [`  ${signature}`];
  for (const item of body) lines.push(...statement(item, types, 2));
  lines.push('  }');
  return lines;
}

export const javaEmitter: CappyEmitter = {
  language: 'java',
  emit(program: Program): EmitResult {
    const lines = [
      'import java.util.ArrayList;',
      'import java.util.Arrays;',
      'import java.util.HashMap;',
      'import java.util.HashSet;',
      'import java.util.List;',
      'import java.util.Map;',
      'import java.util.Set;',
      '',
    ];
    for (const declaration of program.declarations) {
      if (declaration.kind === 'class') {
        lines.push(`class ${declaration.name} {`);
        for (const item of declaration.methods) {
          lines.push(
            ...method(
              item.name,
              item.parameters,
              item.returnType,
              item.body,
              false,
            ),
            '',
          );
        }
        if (lines.at(-1) === '') lines.pop();
        lines.push('}', '');
      }
    }

    const functions = program.declarations.filter(
      (declaration) => declaration.kind === 'function',
    );
    if (functions.length) {
      lines.push('class Solution {');
      for (const item of functions) {
        lines.push(
          ...method(
            item.name,
            item.parameters,
            item.returnType,
            item.body,
            true,
          ),
          '',
        );
      }
      if (lines.at(-1) === '') lines.pop();
      lines.push('}', '');
    }

    return { code: lines.join('\n').trimEnd() };
  },
};
