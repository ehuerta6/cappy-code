'use client';

import Editor from '@monaco-editor/react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { languages, type Language } from '@/lib/domain';

const languageNames: Record<Language, string> = {
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
};

const emptySource: Record<Language, string> = {
  python: '',
  java: '',
  cpp: '',
};

export default function CodeWorkspace() {
  const [activeLanguage, setActiveLanguage] = useState<Language>('python');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % languages.length;
    if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + languages.length) % languages.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = languages.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      setActiveLanguage(languages[nextIndex]);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">CappyCode</p>
          <h1>Code workspace</h1>
          <p className="workspace-description">
            View prepared Python, Java, and C++ code in Member Mode.
          </p>
        </div>
        <div className="workspace-controls">
          <Link className="officer-entry" href="/officer">
            Officer Login
          </Link>
        </div>
      </header>

      <section aria-label="Code editor workspace" className="editor-card">
        <div aria-label="Editor views" className="editor-tabs" role="tablist">
          {languages.map((language, index) => (
            <button
              aria-controls="editor-panel"
              aria-selected={activeLanguage === language}
              className={`editor-tab${activeLanguage === language ? ' is-active' : ''}`}
              id={`editor-tab-${language}`}
              key={language}
              onClick={() => setActiveLanguage(language)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              tabIndex={activeLanguage === language ? 0 : -1}
              type="button"
            >
              {languageNames[language]}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`editor-tab-${activeLanguage}`}
          className="editor-panel"
          id="editor-panel"
          role="tabpanel"
          tabIndex={0}
        >
          <Editor
            height="100%"
            language={activeLanguage}
            options={{
              readOnly: true,
              automaticLayout: true,
              fontSize: 14,
              minimap: { enabled: false },
              padding: { top: 20, bottom: 20 },
              scrollBeyondLastLine: false,
              tabSize: 4,
            }}
            path={activeLanguage}
            theme="vs-dark"
            value={emptySource[activeLanguage]}
          />
        </div>
        <footer className="editor-footer">
          <span>{languageNames[activeLanguage]}</span>
          <span>Read-only</span>
        </footer>
      </section>
    </main>
  );
}
