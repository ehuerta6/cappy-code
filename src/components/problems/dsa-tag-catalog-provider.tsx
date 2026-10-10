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
  ready: boolean;
  refresh: () => Promise<void>;
}>({ tags: [], ready: true, refresh: async () => {} });

export function DsaTagCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<DsaTag[]>([]);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    const tags = await listDsaTags(true);
    setCatalog(tags);
    setReady(true);
  }, []);
  useEffect(() => {
    let active = true;
    listDsaTags(true).then(
      (tags) => {
        if (active) {
          setCatalog(tags);
          setReady(true);
        }
      },
      () => {
        if (active) {
          setCatalog([]);
          setReady(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <DsaTagCatalogContext.Provider value={{ tags: catalog, ready, refresh }}>
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
  return useContext(DsaTagCatalogContext).ready;
}
