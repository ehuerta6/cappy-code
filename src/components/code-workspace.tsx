'use client';

import Editor from '@monaco-editor/react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const languages = ['python', 'java', 'cpp'] as const;

type Language = (typeof languages)[number];
type View = 'source' | Language;

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
  const [sourceLanguage, setSourceLanguage] = useState<Language>('python');
  const [activeView, setActiveView] = useState<View>('source');
  const [sourceCode, setSourceCode] =
    useState<Record<Language, string>>(emptySource);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const views: Array<{ id: View; label: string }> = [
    { id: 'source', label: `${languageNames[sourceLanguage]} source` },
    ...languages
      .filter((language) => language !== sourceLanguage)
      .map((language) => ({ id: language, label: languageNames[language] })),
  ];

  const editorLanguage = activeView === 'source' ? sourceLanguage : activeView;
  const isSourceView = activeView === 'source';

  function selectSourceLanguage(language: Language) {
    setSourceLanguage(language);
    setActiveView('source');
  }

  function clearWorkspace() {
    setSourceCode({ ...emptySource });
    setActiveView('source');
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % views.length;
    if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + views.length) % views.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = views.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      setActiveView(views[nextIndex].id);
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
            Write an interview solution and compare it across languages.
          </p>
        </div>
        <div className="workspace-controls">
          <label className="language-picker">
            <span>Source language</span>
            <select
              value={sourceLanguage}
              onChange={(event) =>
                selectSourceLanguage(event.target.value as Language)
              }
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {languageNames[language]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="clear-button"
            onClick={clearWorkspace}
            type="button"
          >
            Clear all
          </button>
        </div>
      </header>

      <section aria-label="Code editor workspace" className="editor-card">
        <div aria-label="Editor views" className="editor-tabs" role="tablist">
          {views.map((view, index) => (
            <button
              aria-controls="editor-panel"
              aria-selected={activeView === view.id}
              className={`editor-tab${activeView === view.id ? ' is-active' : ''}`}
              id={`editor-tab-${view.id}`}
              key={view.id}
              onClick={() => setActiveView(view.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              tabIndex={activeView === view.id ? 0 : -1}
              type="button"
            >
              {view.label}
              {view.id !== 'source' && (
                <span className="tab-status">Translation</span>
              )}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`editor-tab-${activeView}`}
          className="editor-panel"
          id="editor-panel"
          role="tabpanel"
          tabIndex={0}
        >
          <Editor
            height="100%"
            language={editorLanguage}
            onChange={(value) => {
              if (isSourceView) {
                setSourceCode((current) => ({
                  ...current,
                  [sourceLanguage]: value ?? '',
                }));
              }
            }}
            options={{
              automaticLayout: true,
              fontSize: 14,
              minimap: { enabled: false },
              padding: { top: 20, bottom: 20 },
              readOnly: !isSourceView,
              scrollBeyondLastLine: false,
              tabSize: 4,
            }}
            path={`${isSourceView ? 'source' : 'translation'}-${editorLanguage}`}
            theme="vs-dark"
            value={isSourceView ? sourceCode[sourceLanguage] : ''}
          />
          {!isSourceView && (
            <div className="translation-empty-state">
              <strong>Translation view</strong>
              <span>
                Generated code will appear here when translation is available.
              </span>
              <span className="read-only-label">Read only</span>
            </div>
          )}
        </div>
        <footer className="editor-footer">
          <span>
            {isSourceView
              ? `${languageNames[sourceLanguage]} source`
              : languageNames[activeView]}
          </span>
          <span>{isSourceView ? 'Editable' : 'Read only'}</span>
        </footer>
      </section>
    </main>
  );
}
