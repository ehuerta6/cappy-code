export type CappyType =
  | { kind: 'integer' }
  | { kind: 'boolean' }
  | { kind: 'string' }
  | { kind: 'void' }
  | { kind: 'unknown' }
  | { kind: 'array'; elementType: CappyType }
  | { kind: 'map'; keyType: CappyType; valueType: CappyType }
  | { kind: 'set'; elementType: CappyType };

export interface Program {
  kind: 'program';
  declarations: Declaration[];
}

export type Declaration = FunctionDeclaration | ClassDeclaration;

export interface FunctionDeclaration {
  kind: 'function';
  name: string;
  parameters: Parameter[];
  returnType: CappyType;
  body: Statement[];
}

export interface ClassDeclaration {
  kind: 'class';
  name: string;
  methods: FunctionDeclaration[];
}

export interface Parameter {
  name: string;
  type: CappyType;
}

export type Statement =
  | VariableDeclaration
  | AssignmentStatement
  | IfStatement
  | ForEachStatement
  | ForStatement
  | WhileStatement
  | ReturnStatement
  | ExpressionStatement;

export interface VariableDeclaration {
  kind: 'variableDeclaration';
  name: string;
  type: CappyType;
  initializer?: Expression;
}

export interface AssignmentStatement {
  kind: 'assignment';
  target: AssignableExpression;
  value: Expression;
}

export type AssignableExpression = VariableExpression | IndexExpression;

export interface IfStatement {
  kind: 'if';
  condition: Expression;
  thenBody: Statement[];
  elseBody?: Statement[];
}

export interface ForEachStatement {
  kind: 'forEach';
  variable: Parameter;
  iterable: Expression;
  body: Statement[];
}

export interface ForStatement {
  kind: 'for';
  initializer?: Statement;
  condition?: Expression;
  update?: AssignmentStatement;
  body: Statement[];
}

export interface WhileStatement {
  kind: 'while';
  condition: Expression;
  body: Statement[];
}

export interface ReturnStatement {
  kind: 'return';
  value?: Expression;
}

export interface ExpressionStatement {
  kind: 'expressionStatement';
  expression: Expression;
}

export type Expression =
  | IntegerLiteral
  | BooleanLiteral
  | StringLiteral
  | VariableExpression
  | ArrayLiteral
  | MapLiteral
  | SetLiteral
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | IndexExpression
  | CollectionOperationExpression;

export interface IntegerLiteral {
  kind: 'integerLiteral';
  value: number;
}

export interface BooleanLiteral {
  kind: 'booleanLiteral';
  value: boolean;
}

export interface StringLiteral {
  kind: 'stringLiteral';
  value: string;
}

export interface VariableExpression {
  kind: 'variable';
  name: string;
}

export interface ArrayLiteral {
  kind: 'arrayLiteral';
  elements: Expression[];
  elementType: CappyType;
}

export interface MapLiteral {
  kind: 'mapLiteral';
  entries: { key: Expression; value: Expression }[];
  keyType: CappyType;
  valueType: CappyType;
}

export interface SetLiteral {
  kind: 'setLiteral';
  elements: Expression[];
  elementType: CappyType;
}

export type BinaryOperator =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'remainder'
  | 'equal'
  | 'notEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'and'
  | 'or';

export interface BinaryExpression {
  kind: 'binary';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  kind: 'unary';
  operator: 'not' | 'negate';
  operand: Expression;
}

export interface CallExpression {
  kind: 'call';
  functionName: string;
  arguments: Expression[];
}

export interface IndexExpression {
  kind: 'index';
  collection: Expression;
  index: Expression;
}

export interface CollectionOperationExpression {
  kind: 'collectionOperation';
  operation: 'length' | 'contains' | 'add' | 'remove' | 'append' | 'get';
  collection: Expression;
  arguments: Expression[];
}
