'use client';

import Editor, { type BeforeMount } from '@monaco-editor/react';
import { useEffect, useId, useState } from 'react';
import type { Language, Solution } from '@/lib/domain';
import styles from './solutions.module.css';

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
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const name = languageNames[language];
  return (
    <section className={styles.panel} aria-labelledby={`${id}-heading`}>
      <h3 className={styles.header} id={`${id}-heading`}>
        {name}
      </h3>
      <div className={styles.editor}>
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
      <div className={styles.output}>
        <label
          id={`${id}-output`}
          htmlFor={mode === 'officer' ? `${id}-field` : undefined}
        >
          Output
        </label>
        {props.mode === 'officer' ? (
          <textarea
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
          <pre aria-labelledby={`${id}-output`}>{solution.output}</pre>
        ) : (
          <p className={styles.hint}>No prepared output</p>
        )}
      </div>
    </section>
  );
}
