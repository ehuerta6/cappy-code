'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  createSession,
  listSessions,
  type SessionRecord,
} from '@/lib/firebase/sessions';
import { todayCalendarDate } from '@/lib/session-metadata';
import SessionEditor from './session-editor';
import styles from './sessions.module.css';

// Mount from #37's client auth surface; do not pass Firebase User through an RSC boundary.
export default function OfficerSessions({ user }: { user: User | null }) {
  if (!user || user.isAnonymous)
    return <p>Sign in to Officer Mode to manage sessions.</p>;
  return <SessionManagement key={user.uid} />;
}

function SessionManagement() {
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

  return (
    <section className={styles.sessions} aria-label="Officer sessions">
      <div className={styles.heading}>
        <h1>Sessions</h1>
        <button
          className={styles.button}
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
          <button className={styles.button} onClick={reload}>
            Retry loading sessions
          </button>
        </div>
      ) : records.length === 0 ? (
        <p>No Sessions yet</p>
      ) : (
        <ul className={styles.list}>
          {records.map((record) => (
            <li key={record.id}>
              <button
                className={styles.row}
                onClick={() => setSelectedId(record.id)}
                disabled={creating}
              >
                <span>{record.session.title}</span>
                <time dateTime={record.session.date}>
                  {record.session.date}
                </time>
                <span className={styles.status}>{record.session.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
