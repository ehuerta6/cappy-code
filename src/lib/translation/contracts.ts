import type { Program } from './ir';

export type SupportedLanguage = 'python' | 'java' | 'cpp';

export interface SourceLocation {
  line: number;
  column: number;
}

export interface ParseDiagnostic {
  message: string;
  location?: SourceLocation;
}

export type ParseResult =
  | { ok: true; program: Program }
  | { ok: false; diagnostics: ParseDiagnostic[] };

export interface CappyParser {
  readonly language: SupportedLanguage;
  parse(source: string): ParseResult;
}

export interface EmitResult {
  code: string;
}

export interface CappyEmitter {
  readonly language: SupportedLanguage;
  emit(program: Program): EmitResult;
}
