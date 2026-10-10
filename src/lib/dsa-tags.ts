export const dsaTagFamilies = ['data', 'search', 'graph', 'strategy'] as const;
export type DsaTagFamily = (typeof dsaTagFamilies)[number];

export interface DsaTag {
  id: string;
  label: string;
  family: DsaTagFamily;
  order: number;
  active: boolean;
}

export function normalizeDsaTagId(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(16).padStart(8, '0');
  if (!slug) return `legacy-${suffix}`;
  if (slug.length <= 64) return slug;
  return `${slug.slice(0, 55)}-${suffix}`;
}

export function orderDsaTagIds(ids: string[], catalog: DsaTag[]): string[] {
  const order = new Map(catalog.map((tag) => [tag.id, tag.order]));
  return [...new Set(ids.map(normalizeDsaTagId))].sort(
    (a, b) =>
      (order.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b) ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b),
  );
}

export function resolveDsaTag(id: string, catalog: DsaTag[]): DsaTag {
  const normalized = normalizeDsaTagId(id);
  return (
    catalog.find((tag) => tag.id === normalized) ?? {
      id: normalized,
      label: id,
      family: 'strategy',
      order: Number.MAX_SAFE_INTEGER,
      active: false,
    }
  );
}
