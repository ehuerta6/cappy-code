import type { Language } from '@/lib/domain';
import type { ProblemSolutions } from '@/lib/firebase/solutions';

const EDITOR_LINE_HEIGHT = 23;
const EDITOR_VERTICAL_PADDING = 32;
const MIN_EDITOR_LINES = 4;
const MAX_EDITOR_LINES = 14;

export function getSharedEditorHeight(
  solutions: Pick<ProblemSolutions, Language>,
) {
  const tallest = Math.max(
    ...Object.values(solutions).map((solution) => lineCount(solution.code)),
  );
  const lines = Math.min(MAX_EDITOR_LINES, Math.max(MIN_EDITOR_LINES, tallest));
  return lines * EDITOR_LINE_HEIGHT + EDITOR_VERTICAL_PADDING;
}

function lineCount(value: string) {
  return value.split('\n').length;
}
