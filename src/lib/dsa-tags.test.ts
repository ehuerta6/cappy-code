import { describe, expect, it } from 'vitest';
import { solutionApproachSchema } from './domain';
import {
  normalizeDsaTagId,
  orderDsaTagIds,
  resolveDsaTag,
  type DsaTag,
} from './dsa-tags';

const catalog: DsaTag[] = [
  { id: 'arrays', label: 'Arrays', family: 'data', order: 0, active: true },
  {
    id: 'two-pointers',
    label: 'Two Pointers',
    family: 'data',
    order: 1,
    active: true,
  },
];

describe('DSA tag catalog values', () => {
  it('keeps IDs stable while display labels and families remain catalog metadata', () => {
    const renamed = { ...catalog[0], label: 'Sequence' };
    expect(resolveDsaTag('arrays', [renamed]).label).toBe('Sequence');
    expect(resolveDsaTag('arrays', [renamed]).id).toBe('arrays');
  });

  it('normalizes current labels for a lossless legacy data migration', () => {
    expect(normalizeDsaTagId('Dynamic Programming')).toBe(
      'dynamic-programming',
    );
    expect(normalizeDsaTagId('Previously Custom Tag')).toBe(
      'previously-custom-tag',
    );
  });

  it('makes selected tags unique and deterministically follows catalog ordering', () => {
    expect(
      orderDsaTagIds(['two-pointers', 'arrays', 'arrays'], catalog),
    ).toEqual(['arrays', 'two-pointers']);
    expect(
      solutionApproachSchema.safeParse({
        id: 'a',
        name: 'A',
        tags: ['arrays', 'arrays'],
        order: 0,
      }).success,
    ).toBe(false);
    expect(
      solutionApproachSchema.safeParse({
        id: 'a',
        name: 'A',
        tags: ['bad id'],
        order: 0,
      }).success,
    ).toBe(false);
  });

  it('retains archived tag metadata for existing references', () => {
    const archived = { ...catalog[0], active: false };
    expect(resolveDsaTag('arrays', [archived])).toEqual(archived);
  });
});
