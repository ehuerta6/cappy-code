import type { Program, SourceLanguage } from './ir';

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

/** A source-language parser converts supported input into language-neutral IR. */
export interface CappyParser {
  readonly language: SourceLanguage;
  parse(source: string): ParseResult;
}

export interface EmitResult {
  code: string;
}

/** A target-language emitter produces code from IR without parsing source text. */
export interface CappyEmitter {
  readonly language: SourceLanguage;
  emit(program: Program): EmitResult;
}
