'use client';

import { useRef, useState, type RefObject } from 'react';
import { uploadProblemImage } from '@/lib/firebase/storage';

export default function ProblemImageAuthoring({
  id,
  description,
  textareaRef,
  disabled,
  onDescriptionChange,
  onPendingChange,
}: {
  id: string;
  description: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
  onDescriptionChange: (description: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selection = useRef({ start: 0, end: 0 });

  function clearSelection() {
    setFile(null);
    setAlt('');
    setError(null);
    onPendingChange(false);
  }

  async function uploadAndInsert() {
    if (!file || !alt.trim() || uploading) return;
    setUploading(true);
    onPendingChange(true);
    setError(null);
    try {
      const imageUrl = await uploadProblemImage(file);
      const start = Math.min(selection.current.start, description.length);
      const end = Math.min(selection.current.end, description.length);
      const escapedAlt = alt
        .trim()
        .replaceAll('\\', '\\\\')
        .replaceAll('[', '\\[')
        .replaceAll(']', '\\]');
      const markdown = `![${escapedAlt}](<${imageUrl}>)`;
      onDescriptionChange(
        `${description.slice(0, start)}${markdown}${description.slice(end)}`,
      );
      clearSelection();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(
          start + markdown.length,
          start + markdown.length,
        );
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Image upload failed. Try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp"
          aria-label="Choose image file"
          id={`problem-image-file-${id}`}
          type="file"
          hidden
          disabled={disabled || uploading}
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0] ?? null;
            event.currentTarget.value = '';
            if (!selected) return;
            if (
              !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)
            ) {
              setError('Choose a PNG, JPEG, or WebP image.');
              return;
            }
            if (selected.size === 0 || selected.size > 5 * 1024 * 1024) {
              setError('Choose an image smaller than 5 MB.');
              return;
            }
            const textarea = textareaRef.current;
            if (textarea)
              selection.current = {
                start: textarea.selectionStart,
                end: textarea.selectionEnd,
              };
            setError(null);
            setFile(selected);
            onPendingChange(true);
          }}
        />
        <button
          className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          Add image
        </button>
        {file ? <span className="text-sm text-muted">{file.name}</span> : null}
      </div>
      {file ? (
        <div className="mt-3 flex max-w-3xl flex-col gap-3 rounded border border-border-soft bg-raised p-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`problem-image-alt-${id}`}>Image alt text</label>
            <input
              autoComplete="off"
              aria-describedby={`problem-image-alt-help-${id}`}
              className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-ink"
              id={`problem-image-alt-${id}`}
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              disabled={uploading}
              required
            />
            <span
              className="text-sm text-muted"
              id={`problem-image-alt-help-${id}`}
            >
              Describe the information the image adds to the Problem.
            </span>
          </div>
          <button
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 font-medium text-ink hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => void uploadAndInsert()}
            disabled={!alt.trim() || uploading || disabled}
          >
            {uploading ? 'Uploading image…' : 'Upload and insert'}
          </button>
          <button
            className="min-h-11 rounded px-3 py-2 text-muted underline underline-offset-2 hover:text-ink"
            type="button"
            onClick={clearSelection}
            disabled={uploading}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {uploading ? (
        <p className="mt-2 text-sm text-muted" role="status" aria-live="polite">
          Uploading image. Keep this Problem open until it finishes.
        </p>
      ) : null}
    </>
  );
}
