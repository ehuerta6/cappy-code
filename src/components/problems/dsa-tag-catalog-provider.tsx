'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { listDsaTags } from '@/lib/firebase/dsa-tags';
import type { DsaTag } from '@/lib/dsa-tags';

const DsaTagCatalogContext = createContext<{
  tags: DsaTag[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  refresh: () => Promise<void>;
}>({ tags: [], status: 'ready', error: null, refresh: async () => {} });

export function DsaTagCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<DsaTag[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const tags = await listDsaTags(true);
      setCatalog(tags);
      setStatus('ready');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not load the DSA tag catalog.',
      );
      setStatus('error');
      throw cause;
    }
  }, []);
  useEffect(() => {
    let active = true;
    listDsaTags(true).then(
      (tags) => {
        if (active) {
          setCatalog(tags);
          setStatus('ready');
        }
      },
      (cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load the DSA tag catalog.',
          );
          setStatus('error');
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <DsaTagCatalogContext.Provider
      value={{ tags: catalog, status, error, refresh }}
    >
      {children}
    </DsaTagCatalogContext.Provider>
  );
}

export function useDsaTagCatalog() {
  return useContext(DsaTagCatalogContext).tags;
}

export function useDsaTagCatalogRefresh() {
  return useContext(DsaTagCatalogContext).refresh;
}

export function useDsaTagCatalogReady() {
  return useContext(DsaTagCatalogContext).status === 'ready';
}

export function useDsaTagCatalogState() {
  const { status, error, refresh } = useContext(DsaTagCatalogContext);
  return { status, error, refresh };
}
