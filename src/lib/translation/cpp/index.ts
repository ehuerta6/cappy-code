import type { CappyParser, CappyEmitter } from '../contracts';
import { CppEmitter } from './emitter';
import { CppParser } from './parser';

export { CppEmitter, CppParser };

export const cppParser: CappyParser = new CppParser();
export const cppEmitter: CappyEmitter = new CppEmitter();
