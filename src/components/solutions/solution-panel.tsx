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
} & (
  | { mode: 'member'; onChange?: never; disabled?: never }
  | {
      mode: 'officer';
      onChange: (solution: Solution) => void;
      disabled?: boolean;
    }
);

export default function SolutionPanel(props: Props) {
  const { language, solution, modelPath, mode } = props;
  const id = useId();
  const theme = useColorTheme()?.theme;
  const dark = theme === 'dark';
  const name = languageNames[language];
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-soft bg-surface text-ink"
      aria-labelledby={`${id}-heading`}
    >
      <h3
        className="m-0 flex min-h-10 items-center px-4 py-2 text-[15px] font-semibold leading-[22px]"
        id={`${id}-heading`}
      >
        {name}
      </h3>
      <div className="h-[360px] bg-monaco focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-accent">
        <Editor
          height="360px"
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
            wordWrap: 'off',
            tabSize: 4,
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <label
          className="mb-2 block text-[15px] font-semibold leading-[22px] text-ink"
          id={`${id}-output`}
          htmlFor={mode === 'officer' ? `${id}-field` : undefined}
        >
          Output
        </label>
        {props.mode === 'officer' ? (
          <textarea
            className="max-h-[230px] min-h-[92px] w-full overflow-auto whitespace-pre rounded border border-border-soft bg-raised px-2.5 py-2 font-mono text-[15px] leading-[23px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:text-muted"
            id={`${id}-field`}
            aria-label={`${name} prepared output`}
            value={solution.output}
            disabled={props.disabled}
            onChange={(event) =>
              props.onChange({ ...solution, output: event.target.value })
            }
            spellCheck={false}
            rows={4}
          />
        ) : solution.output ? (
          <pre
            className="m-0 max-h-[230px] min-h-[92px] w-full overflow-auto whitespace-pre rounded border border-border-soft bg-raised px-2.5 py-2 font-mono text-[15px] leading-[23px] text-ink"
            aria-labelledby={`${id}-output`}
          >
            {solution.output}
          </pre>
        ) : (
          <p className="mt-2 text-sm leading-5 text-muted">
            No prepared output
          </p>
        )}
      </div>
    </section>
  );
}
