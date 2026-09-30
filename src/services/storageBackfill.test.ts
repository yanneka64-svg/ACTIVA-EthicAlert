/**
 * === AMÉLIORATION AJOUTÉE (Refactor storage.ts — extraction par section) ===
 *
 * Tests des fonctions pures de rattrapage extraites de StorageService
 * (voir storageBackfill.ts). Jusqu'ici non testables isolément (méthodes
 * privées du singleton) : le point clé vérifié ici est le contrat « même
 * référence renvoyée quand il n'y a rien à rattraper », sur lequel
 * storage.ts s'appuie pour ne réécrire localStorage qu'en cas de besoin.
 */
import { describe, expect, it } from 'vitest';
import type { AlertRecord } from '../types';
import type { CategoryDef, EntityDef } from '../data/activaConfig';
import { backfillCategoryDefaults, backfillEntityDefaults, seedCaseNumberCountersFromAlerts } from './storageBackfill';

const entity = (name: string, code?: string) => ({ id: name, name, code } as unknown as EntityDef);
const category = (name: string, code?: string, active?: boolean) => ({ id: name, name, subCategories: [], code, active } as unknown as CategoryDef);
const alertWith = (trackingNumber: string | undefined) => ({ trackingNumber } as unknown as AlertRecord);

describe('backfillEntityDefaults', () => {
  it('returns the very same array when every entity already has a code', () => {
    const defs = [entity('ACTIVA Vie', 'AVIE'), entity('ACTIVA Ré', 'ARE')];
    expect(backfillEntityDefaults(defs)).toBe(defs);
  });

  it('derives a code from the first 4 letters of the name, uppercased, letters only', () => {
    const out = backfillEntityDefaults([entity('ACTIVA Vie'), entity('ab-cd 12 ef')]);
    expect(out.map((e) => e.code)).toEqual(['ACTI', 'ABCD']);
  });

  it('falls back to GRP when the name has no letter, and never overwrites an existing code', () => {
    const out = backfillEntityDefaults([entity('1234'), entity('Keep', 'KEEP')]);
    expect(out.map((e) => e.code)).toEqual(['GRP', 'KEEP']);
  });

  it('never mutates its input', () => {
    const defs = [entity('ACTIVA Vie')];
    backfillEntityDefaults(defs);
    expect(defs[0].code).toBeUndefined();
  });
});

describe('seedCaseNumberCountersFromAlerts', () => {
  it('returns the very same object when no existing case number is higher', () => {
    const counters = { 'AACMR-2609': 5 };
    expect(seedCaseNumberCountersFromAlerts(counters, [alertWith('AACMR-26-09-0003')])).toBe(counters);
  });

  it('raises a counter to the highest sequence already used per entity+month', () => {
    const out = seedCaseNumberCountersFromAlerts({ 'AACMR-2609': 1 }, [
      alertWith('AACMR-26-09-0007'),
      alertWith('AACMR-26-09-0004'),
      alertWith('AACIV-26-08-0002'),
    ]);
    expect(out).toEqual({ 'AACMR-2609': 7, 'AACIV-2608': 2 });
  });

  it('never lowers a counter and ignores non-official or missing tracking numbers', () => {
    const counters = { 'AACMR-2609': 9 };
    const out = seedCaseNumberCountersFromAlerts(counters, [
      alertWith('AACMR-26-09-0002'),
      alertWith('ACT-2026-1234'),
      alertWith(undefined),
    ]);
    expect(out).toBe(counters);
  });

  it('never mutates its input', () => {
    const counters = {};
    seedCaseNumberCountersFromAlerts(counters, [alertWith('AACMR-26-09-0001')]);
    expect(counters).toEqual({});
  });
});

describe('backfillCategoryDefaults', () => {
  it('returns the very same array when every category has a code and an active flag', () => {
    const cats = [category('Fraude', 'CAT-001', true), category('RH', 'CAT-002', false)];
    expect(backfillCategoryDefaults(cats)).toBe(cats);
  });

  it('fills a positional CAT-00N code and active=true only where missing', () => {
    const out = backfillCategoryDefaults([category('A'), category('B', 'X-9'), category('C', undefined, false)]);
    expect(out.map((c) => [c.code, c.active])).toEqual([
      ['CAT-001', true],
      ['X-9', true],
      ['CAT-003', false],
    ]);
  });
});
