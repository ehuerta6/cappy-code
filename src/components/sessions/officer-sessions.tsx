'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createSession,
  listSessions,
  type SessionRecord,
} from '@/lib/firebase/sessions';
import { todayCalendarDate } from '@/lib/session-metadata';
import SessionEditor from './session-editor';

export default function OfficerSessions() {
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const openAfterLoad = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSessions().then(
      (sessions) => {
        if (cancelled) return;
        setRecords(sessions);
        setLoading(false);
        if (
          openAfterLoad.current &&
          sessions.some((record) => record.id === openAfterLoad.current)
        ) {
          setSelectedId(openAfterLoad.current);
        }
        openAfterLoad.current = null;
      },
      () => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [revision]);

  function reload() {
    setLoading(true);
    setLoadError(false);
    setRevision((value) => value + 1);
  }

  async function create() {
    setCreating(true);
    setCreateError(false);
    try {
      const id = await createSession({
        title: 'Untitled Session',
        date: todayCalendarDate(),
      });
      openAfterLoad.current = id;
      reload();
    } catch {
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  }

  const selected = records.find((record) => record.id === selectedId);
  if (selected) {
    return (
      <SessionEditor
        key={selected.id}
        record={selected}
        onClose={() => {
          setSelectedId(null);
          reload();
        }}
      />
    );
  }

  const groups = [
    {
      label: 'Live',
      records: records
        .filter((record) => record.session.status === 'live')
        .sort((a, b) => a.session.date.localeCompare(b.session.date)),
    },
    {
      label: 'Upcoming',
      records: records
        .filter((record) => record.session.status === 'draft')
        .sort((a, b) => a.session.date.localeCompare(b.session.date)),
    },
    {
      label: 'Past',
      records: records
        .filter((record) => record.session.status === 'ended')
        .sort((a, b) => b.session.date.localeCompare(a.session.date)),
    },
  ];

  return (
    <section
      className="mx-auto w-full max-w-[1440px] text-base leading-relaxed"
      aria-label="Officer sessions"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        <h1 className="m-0 text-[28px] font-semibold leading-9 tracking-tight">
          Sessions
        </h1>
        <button
          className="min-h-11 rounded border border-accent bg-accent px-3 py-2 font-semibold text-accent-contrast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-default disabled:bg-raised disabled:text-muted"
          onClick={() => void create()}
          disabled={creating || loading || loadError}
        >
          {creating ? 'Creating…' : '+ New session'}
        </button>
      </div>
      {createError && (
        <p role="alert">
          Session could not be created. Check your connection and try New
          session again.
        </p>
      )}
      {loading ? (
        <p role="status">Loading sessions…</p>
      ) : loadError ? (
        <div role="alert">
          <p>Sessions could not be loaded. Check your connection and retry.</p>
          <button
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 hover:bg-hover"
            onClick={reload}
          >
            Retry loading sessions
          </button>
        </div>
      ) : records.length === 0 ? (
        <p>No Sessions yet</p>
      ) : (
        groups.map(
          ({ label, records: groupRecords }) =>
            groupRecords.length > 0 && (
              <section key={label} aria-label={label}>
                <h2 className="mb-2 mt-7 text-lg font-semibold leading-[26px]">
                  {label}
                </h2>
                <ul className="m-0 max-w-5xl list-none p-0">
                  {groupRecords.map((record) => (
                    <li className="border-b border-border-soft" key={record.id}>
                      <button
                        className="flex min-h-14 w-full max-w-5xl flex-wrap items-center justify-start gap-x-4 gap-y-1 rounded px-2 py-3 text-left text-ink hover:bg-hover focus-visible:relative focus-visible:z-10 disabled:cursor-default disabled:bg-raised disabled:text-muted max-sm:items-start max-sm:flex-col"
                        onClick={() => setSelectedId(record.id)}
                        disabled={creating}
                      >
                        <time
                          className="w-[4.5rem] shrink-0 text-sm text-muted"
                          dateTime={record.session.date}
                        >
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            timeZone: 'UTC',
                          }).format(
                            new Date(`${record.session.date}T00:00:00Z`),
                          )}
                        </time>
                        <span className="min-w-0 max-w-[40ch] break-words font-semibold">
                          {record.session.title}
                        </span>
                        <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted max-sm:pl-0">
                          <span>
                            {record.problemCount === null
                              ? 'Problem count unavailable'
                              : `${record.problemCount} ${record.problemCount === 1 ? 'Problem' : 'Problems'}`}
                          </span>
                        </span>
                        <span
                          className={`inline-flex min-h-7 shrink-0 items-center rounded border border-border-soft px-2.5 py-0.5 text-sm font-semibold capitalize leading-5 ${record.session.status === 'live' ? 'border-success/50 bg-success-surface text-success' : record.session.status === 'draft' ? 'border-warning/50 text-warning' : 'text-muted'}`}
                        >
                          {record.session.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )
      )}
    </section>
  );
}
