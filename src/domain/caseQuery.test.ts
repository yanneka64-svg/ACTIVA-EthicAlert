/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : coût et latence de listCases) ===
 */
import { describe, expect, it } from 'vitest';
import { caseQueryEqualities, normalizePagination } from './caseQuery';

describe('caseQueryEqualities', () => {
  it('pushes every non-empty string equality filter, in a stable order', () => {
    expect(caseQueryEqualities({ assignee: 'u1', status: 'triage', country: 'CM', entity: '', priority: undefined })).toEqual([
      ['status', 'triage'],
      ['country', 'CM'],
      ['assignee', 'u1'],
    ]);
  });
  it('pushes nothing for an empty, missing or malformed filter', () => {
    expect(caseQueryEqualities({})).toEqual([]);
    expect(caseQueryEqualities(undefined)).toEqual([]);
    expect(caseQueryEqualities({ status: 3 } as never)).toEqual([]);
  });
});

describe('normalizePagination', () => {
  it('keeps the historical defaults', () => {
    expect(normalizePagination(undefined, undefined)).toEqual({ limit: 25, offset: 0 });
    expect(normalizePagination(10, 20)).toEqual({ limit: 10, offset: 20 });
  });
  it('bounds and sanitises hostile values', () => {
    expect(normalizePagination(1e9, -5)).toEqual({ limit: 500, offset: 0 });
    expect(normalizePagination(NaN, Infinity)).toEqual({ limit: 25, offset: 0 });
    expect(normalizePagination(0, 2.7)).toEqual({ limit: 1, offset: 2 });
    expect(normalizePagination('10', '3')).toEqual({ limit: 25, offset: 0 });
  });
});
