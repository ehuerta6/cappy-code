'use client';

import Editor, { type BeforeMount } from '@monaco-editor/react';
import { useId } from 'react';
import type { Language, Solution } from '@/lib/domain';
import { useColorTheme } from '@/components/theme-provider';

export const languageNames: Record<Language, string> = {
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
};

const defineThemes: BeforeMount = (monaco) => {
  for (const dark of [false, true]) {
    monaco.editor.defineTheme(dark ? 'cappy-dark' : 'cappy-light', {
      base: dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: dark ? '9DBBFF' : '1D4ED8' },
        { token: 'string', foreground: dark ? 'A3C998' : '326647' },
        { token: 'number', foreground: dark ? 'D8B780' : '805514' },
        { token: 'comment', foreground: dark ? 'A0AAB5' : '65717D' },
      ],
      colors: {
        'editor.background': dark ? '#12171D' : '#FAFBFC',
        'editor.foreground': dark ? '#E6EBF0' : '#18212B',
        'editorLineNumber.foreground': dark ? '#A0AAB5' : '#65717D',
        'editorCursor.foreground': dark ? '#E6EBF0' : '#18212B',
        'editor.selectionBackground': dark ? '#354E72' : '#C8DDFF',
      },
    });
  }
};

type Props = {
  language: Language;
  solution: Solution;
  modelPath: string;
  editorHeight: number | string;
} & (
  | { mode: 'member'; onChange?: never; disabled?: never }
  | {
      mode: 'officer';
      onChange: (solution: Solution) => void;
      disabled?: boolean;
    }
);

export default function SolutionPanel(props: Props) {
  const {
    language,
    solution,
    modelPath,
    mode,
    editorHeight: editorHeightValue,
  } = props;
  const id = useId();
  const theme = useColorTheme()?.theme;
  const dark = theme === 'dark';
  const name = languageNames[language];
  const editorHeight =
    typeof editorHeightValue === 'number'
      ? `${editorHeightValue}px`
      : editorHeightValue;
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden bg-surface text-ink"
      aria-labelledby={`${id}-heading`}
    >
      <h3
        className={
          mode === 'member'
            ? 'sr-only'
            : 'm-0 flex min-h-10 items-center px-3 py-2 text-[15px] font-semibold leading-[22px]'
        }
        id={`${id}-heading`}
      >
        {name}
      </h3>
      {mode === 'member' && !solution.code.trim() ? (
        <p className="m-0 min-h-32 px-3 py-5 text-sm text-muted" role="status">
          {name} solution not prepared.
        </p>
      ) : (
        <div
          className="bg-monaco transition-[height] duration-150 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-accent"
          style={{ height: editorHeight }}
        >
          <Editor
            height={editorHeight}
            language={language}
            path={modelPath}
            value={solution.code}
            beforeMount={defineThemes}
            theme={dark ? 'cappy-dark' : 'cappy-light'}
            loading={<p role="status">Loading {name} editor…</p>}
            onChange={(code) => {
              if (props.mode === 'officer' && !props.disabled)
                props.onChange({ ...solution, code: code ?? '' });
            }}
            options={{
              readOnly: mode === 'member' || props.disabled === true,
              domReadOnly: mode === 'member' || props.disabled === true,
              ariaLabel: `${name} Solution, ${mode === 'member' ? 'read-only' : props.disabled ? 'temporarily read-only' : 'editable'}`,
              automaticLayout: true,
              fontSize: 15,
              lineHeight: 23,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: mode === 'member' ? 'on' : 'off',
              wrappingIndent: mode === 'member' ? 'indent' : 'none',
              scrollbar: {
                horizontal: mode === 'member' ? 'hidden' : 'auto',
                vertical: 'auto',
              },
              tabSize: 4,
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>
      )}
      {mode === 'officer' ? (
        <ComplexityEditor
          solution={solution}
          disabled={props.disabled}
          onChange={props.onChange}
        />
      ) : (
        <ComplexitySummary solution={solution} />
      )}
    </section>
  );
}

function ComplexityEditor({
  solution,
  disabled,
  onChange,
}: {
  solution: Solution;
  disabled?: boolean;
  onChange: (solution: Solution) => void;
}) {
  return (
    <div className="grid gap-3 border-t border-border-soft p-3">
      <h4 className="m-0 text-sm font-semibold">Complexity analysis</h4>
      <label className="grid gap-1 text-sm font-medium">
        Time Complexity
        <input
          className="min-h-10 rounded border border-border-strong bg-surface px-3 font-normal text-ink"
          value={solution.timeComplexity ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...solution, timeComplexity: event.target.value })
          }
          placeholder="e.g. O(n)"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Time explanation
        <textarea
          className="min-h-16 rounded border border-border-strong bg-surface px-3 py-2 font-normal text-ink"
          value={solution.timeComplexityReason ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...solution, timeComplexityReason: event.target.value })
          }
          rows={2}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Space Complexity
        <input
          className="min-h-10 rounded border border-border-strong bg-surface px-3 font-normal text-ink"
          value={solution.spaceComplexity ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...solution, spaceComplexity: event.target.value })
          }
          placeholder="e.g. O(n)"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Space explanation
        <textarea
          className="min-h-16 rounded border border-border-strong bg-surface px-3 py-2 font-normal text-ink"
          value={solution.spaceComplexityReason ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...solution, spaceComplexityReason: event.target.value })
          }
          rows={2}
        />
      </label>
    </div>
  );
}

function ComplexitySummary({ solution }: { solution: Solution }) {
  const hasTime = solution.timeComplexity || solution.timeComplexityReason;
  const hasSpace = solution.spaceComplexity || solution.spaceComplexityReason;
  if (!hasTime && !hasSpace) return null;
  return (
    <dl className="grid gap-2 border-t border-border-soft p-3 text-sm">
      {hasTime ? (
        <div className="grid gap-0.5">
          {solution.timeComplexity ? (
            <dt className="font-semibold">Time: {solution.timeComplexity}</dt>
          ) : (
            <dt className="font-semibold">Time</dt>
          )}
          {solution.timeComplexityReason ? (
            <dd className="m-0 text-muted">{solution.timeComplexityReason}</dd>
          ) : null}
        </div>
      ) : null}
      {hasSpace ? (
        <div className="grid gap-0.5">
          {solution.spaceComplexity ? (
            <dt className="font-semibold">Space: {solution.spaceComplexity}</dt>
          ) : (
            <dt className="font-semibold">Space</dt>
          )}
          {solution.spaceComplexityReason ? (
            <dd className="m-0 text-muted">{solution.spaceComplexityReason}</dd>
          ) : null}
        </div>
      ) : null}
    </dl>
  );
}
