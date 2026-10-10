'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  archiveDsaTag,
  countDsaTagReferences,
  createDsaTag,
  deleteUnusedDsaTag,
  reorderDsaTags,
  updateDsaTag,
} from '@/lib/firebase/dsa-tags';
import {
  dsaTagFamilies,
  orderDsaTagIds,
  resolveDsaTag,
  type DsaTag,
  type DsaTagFamily,
} from '@/lib/dsa-tags';
import {
  useDsaTagCatalog,
  useDsaTagCatalogReady,
  useDsaTagCatalogRefresh,
  useDsaTagCatalogState,
} from './dsa-tag-catalog-provider';
import { DsaTagBadge } from './problem-bank-metadata';

const familyLabels: Record<DsaTagFamily, string> = {
  data: 'Data structures',
  search: 'Search',
  graph: 'Graphs',
  strategy: 'Strategy',
};

export default function DsaTagPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const catalog = useDsaTagCatalog();
  const catalogReady = useDsaTagCatalogReady();
  const refreshCatalog = useDsaTagCatalogRefresh();
  const catalogState = useDsaTagCatalogState();
  const [search, setSearch] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [family, setFamily] = useState<DsaTagFamily>('data');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasManageOpen = useRef(false);
  useEffect(() => {
    if (manageOpen) {
      wasManageOpen.current = true;
      closeButtonRef.current?.focus();
    } else if (wasManageOpen.current) {
      wasManageOpen.current = false;
      manageButtonRef.current?.focus();
    }
  }, [manageOpen]);
  const ordered = useMemo(
    () => orderDsaTagIds(selected, catalog),
    [selected, catalog],
  );
  const suggestions = catalog
    .filter(
      (tag) =>
        tag.active &&
        tag.label.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await refreshCatalog();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update DSA tags.',
      );
    } finally {
      setBusy(false);
    }
  }

  function openEditor(tag?: DsaTag) {
    setTagEditorOpen(true);
    setEditingId(tag?.id ?? null);
    setLabel(tag?.label ?? '');
    setFamily(tag?.family ?? 'data');
    setError('');
  }

  return (
    <div className="grid min-w-0 gap-3" aria-label="DSA / algorithm tags">
      <div className="flex flex-wrap gap-2">
        {ordered.map((id) => (
          <span className="inline-flex max-w-full items-center gap-1" key={id}>
            <DsaTagBadge id={id} />
            <button
              aria-label={`Remove ${resolveDsaTag(id, catalog).label}`}
              className="ui-icon-button h-8 w-8"
              onClick={() => onChange(ordered.filter((tag) => tag !== id))}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        {ordered.length === 0 ? (
          <span className="text-sm text-muted">No tags selected</span>
        ) : null}
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Search tags
        <input
          className="ui-field"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tags…"
          type="search"
          value={search}
        />
      </label>
      <div
        className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-border-soft p-1"
        aria-label="Tag suggestions"
      >
        {catalogState.status === 'error' ? (
          <div className="m-2 grid gap-2 text-sm" role="alert">
            <p className="m-0">
              Could not load DSA tags
              {catalogState.error ? `: ${catalogState.error}` : '.'}
            </p>
            <button
              className="min-h-10 justify-self-start rounded border border-border-strong px-3"
              onClick={() => void refreshCatalog().catch(() => {})}
              type="button"
            >
              Retry loading tags
            </button>
          </div>
        ) : !catalogReady ? (
          <p className="m-2 text-sm text-muted">Loading DSA tags…</p>
        ) : suggestions.length ? (
          suggestions.map((tag) => {
            const isSelected = ordered.includes(tag.id);
            return (
              <button
                aria-pressed={isSelected}
                className="flex min-h-11 items-center justify-between gap-3 rounded px-3 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                key={tag.id}
                onClick={() =>
                  onChange(
                    orderDsaTagIds(
                      isSelected
                        ? ordered.filter((id) => id !== tag.id)
                        : [...ordered, tag.id],
                      catalog,
                    ),
                  )
                }
                type="button"
              >
                <span>{tag.label}</span>
                <span aria-hidden="true">{isSelected ? '✓' : '+'}</span>
              </button>
            );
          })
        ) : (
          <p className="m-2 text-sm text-muted">No matching tags.</p>
        )}
      </div>
      <div>
        <button
          ref={manageButtonRef}
          className="min-h-11 text-sm text-accent underline underline-offset-4"
          disabled={!catalogReady}
          onClick={() => setManageOpen((open) => !open)}
          type="button"
          aria-expanded={manageOpen}
        >
          {manageOpen ? 'Close tag catalog' : 'Manage DSA tags'}
        </button>
      </div>
      {manageOpen && typeof document !== 'undefined'
        ? createPortal(
            <section
              aria-labelledby="dsa-tag-catalog-title"
              className="fixed left-1/2 top-1/2 z-40 grid max-h-[min(60vh,28rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-xl border border-border-strong bg-surface p-3 shadow-xl"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setManageOpen(false);
                }
              }}
              role="dialog"
              style={{ width: 'min(28rem, calc(100vw - 2rem))' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  className="m-0 text-sm font-semibold"
                  id="dsa-tag-catalog-title"
                >
                  DSA tag catalog
                </h3>
                <button
                  aria-label="Close DSA tag catalog"
                  className="min-h-10 rounded border border-border-strong px-3 text-sm"
                  onClick={() => setManageOpen(false)}
                  ref={closeButtonRef}
                  type="button"
                >
                  Close
                </button>
                <button
                  className="min-h-10 rounded border border-border-strong px-3 text-sm"
                  onClick={() => openEditor()}
                  type="button"
                >
                  Add tag
                </button>
              </div>
              {catalog.map((tag, index) => (
                <div
                  className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border-soft pt-2"
                  key={tag.id}
                >
                  <DsaTagBadge id={tag.id} />
                  <span className="flex-1 text-xs text-muted">
                    {tag.active ? familyLabels[tag.family] : 'Archived'}
                  </span>
                  <button
                    aria-label={`Edit ${tag.label}`}
                    className="min-h-10 rounded px-2 text-sm underline"
                    onClick={() => openEditor(tag)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    aria-label={`Move ${tag.label} earlier`}
                    className="min-h-10 rounded px-2 text-sm"
                    disabled={busy || index === 0}
                    onClick={() =>
                      run(() =>
                        reorderDsaTags(
                          catalog.map((entry, i) =>
                            i === index
                              ? catalog[index - 1]
                              : i === index - 1
                                ? catalog[index]
                                : entry,
                          ),
                        ),
                      )
                    }
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${tag.label} later`}
                    className="min-h-10 rounded px-2 text-sm"
                    disabled={busy || index === catalog.length - 1}
                    onClick={() =>
                      run(() =>
                        reorderDsaTags(
                          catalog.map((entry, i) =>
                            i === index
                              ? catalog[index + 1]
                              : i === index + 1
                                ? catalog[index]
                                : entry,
                          ),
                        ),
                      )
                    }
                    type="button"
                  >
                    ↓
                  </button>
                  {tag.active ? (
                    <button
                      className="min-h-10 rounded px-2 text-sm text-danger underline"
                      disabled={busy}
                      onClick={() => run(() => archiveDsaTag(tag))}
                      type="button"
                    >
                      Archive
                    </button>
                  ) : (
                    <button
                      className="min-h-10 rounded px-2 text-sm text-danger underline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const count = await countDsaTagReferences(tag.id);
                          if (count)
                            throw new Error(
                              `This archived tag is used by ${count} existing Approach${count === 1 ? '' : 'es'}; it must remain available for historical display.`,
                            );
                          if (
                            !window.confirm(
                              `Permanently delete unused tag “${tag.label}”?`,
                            )
                          )
                            return;
                          await deleteUnusedDsaTag(tag.id);
                        })
                      }
                      type="button"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
              {tagEditorOpen ? (
                <div
                  className="grid gap-3 rounded-lg border border-border-soft p-3"
                  aria-label={editingId ? 'Edit DSA tag' : 'Add DSA tag'}
                >
                  <label className="grid gap-1 text-sm">
                    Tag name
                    <input
                      autoFocus
                      className="ui-field"
                      maxLength={512}
                      onChange={(event) => setLabel(event.target.value)}
                      value={label}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Color family
                    <select
                      className="ui-field"
                      onChange={(event) =>
                        setFamily(event.target.value as DsaTagFamily)
                      }
                      value={family}
                    >
                      {dsaTagFamilies.map((entry) => (
                        <option key={entry} value={entry}>
                          {familyLabels[entry]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="min-h-11 rounded bg-accent px-3 text-sm text-white"
                      onClick={() => {
                        const original = catalog.find(
                          (tag) => tag.id === editingId,
                        );
                        if (original)
                          void run(() =>
                            updateDsaTag({
                              ...original,
                              label: label.trim(),
                              family,
                            }),
                          );
                        else
                          void run(() =>
                            createDsaTag({
                              label,
                              family,
                              order: catalog.length,
                            }),
                          );
                        setEditingId(null);
                        setLabel('');
                        setTagEditorOpen(false);
                      }}
                      disabled={busy || !label.trim()}
                      type="button"
                    >
                      Save tag
                    </button>
                    <button
                      className="min-h-11 rounded border border-border-strong px-3 text-sm"
                      onClick={() => {
                        setEditingId(null);
                        setLabel('');
                        setTagEditorOpen(false);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="m-0 text-sm text-danger">
                  {error}
                </p>
              ) : null}
            </section>,
            document.body,
          )
        : null}
    </div>
  );
}
