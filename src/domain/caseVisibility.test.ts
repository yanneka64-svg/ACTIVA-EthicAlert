/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 1 : listCases) ===
 *
 * Tests de `filterVisibleCases` (caseVisibility.ts), la logique partagée
 * désormais réutilisée par `LocalCaseRepository.listCases`,
 * `scripts/firestoreAdminRepository.ts`'s `listCases`, et la nouvelle Cloud
 * Function `listCases` (functions/src/index.ts). Même convention
 * `user()`/helpers que `permissions.test.ts` — `can()` lui-même est déjà
 * entièrement testé là-bas, donc ces tests se concentrent sur ce que
 * `filterVisibleCases` ajoute par-dessus : les filtres optionnels et la
 * pagination.
 */
import { describe, expect, it } from 'vitest';

import { AppUser, Case, Person } from './caseTypes';
import { filterVisibleCases } from './caseVisibility';

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    userId: 'u-1',
    name: 'Test User',
    email: 't@example.com',
    roleId: 'functional_admin',
    countries: [],
    entities: [],
    active: true,
    mfaEnabled: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    caseId: 'c-1',
    caseNumber: 'CASE-2026-000001',
    status: 'new',
    category: 'Fraude',
    subcategory: 'Détournement',
    country: 'Cameroun',
    entity: 'ACTIVA Assurances',
    reportingMode: 'anonymous',
    priority: 'low',
    riskScore: 4,
    confidentialityLevel: 'restricted',
    additionalInvestigators: [],
    implicatedUserIds: [],
    slaStatus: 'ok',
    receivedAt: '2026-01-01T00:00:00Z',
    incidentDateUnknown: true,
    description: 'Test',
    legalHold: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'system',
    ...overrides,
  };
}

function subjectPerson(caseId: string, linkedUserId: string): Person {
  return {
    personId: `p-${linkedUserId}`,
    caseId,
    kind: 'subject',
    name: 'Personne mise en cause',
    linkedUserId,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 'system',
  } as Person;
}

describe('filterVisibleCases — reuses can() precedence', () => {
  it('excludes a case the caller is implicated in, even with global visibility', () => {
    const kase = makeCase({ caseId: 'c-1' });
    const persons = new Map([['c-1', [subjectPerson('c-1', 'u-1')]]]);
    const result = filterVisibleCases([kase], persons, {}, user());
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('includes a case in scope for a global-visibility role with no persons entry at all', () => {
    const kase = makeCase({ caseId: 'c-1' });
    const result = filterVisibleCases([kase], new Map(), {}, user());
    expect(result.items.map((c) => c.caseId)).toEqual(['c-1']);
  });

  it('excludes a case outside a scoped investigator\'s country/entity', () => {
    const kase = makeCase({ caseId: 'c-1', country: 'Ghana' });
    const investigator = user({ roleId: 'investigator', countries: ['Cameroun'], entities: ['ACTIVA Assurances'] });
    const result = filterVisibleCases([kase], new Map(), {}, investigator);
    expect(result.items).toHaveLength(0);
  });
});

describe('filterVisibleCases — optional filters', () => {
  const cases = [
    makeCase({ caseId: 'c-1', status: 'new', country: 'Cameroun', priority: 'low' }),
    makeCase({ caseId: 'c-2', status: 'investigation', country: 'Cameroun', priority: 'critical' }),
    makeCase({ caseId: 'c-3', status: 'new', country: 'Ghana', priority: 'low' }),
  ];

  it('filters by status', () => {
    const result = filterVisibleCases(cases, new Map(), { status: 'investigation' }, user());
    expect(result.items.map((c) => c.caseId)).toEqual(['c-2']);
  });

  it('filters by country', () => {
    const result = filterVisibleCases(cases, new Map(), { country: 'Ghana' }, user());
    expect(result.items.map((c) => c.caseId)).toEqual(['c-3']);
  });

  it('filters by priority', () => {
    const result = filterVisibleCases(cases, new Map(), { priority: 'critical' }, user());
    expect(result.items.map((c) => c.caseId)).toEqual(['c-2']);
  });

  it('combines multiple filters (AND, not OR)', () => {
    const result = filterVisibleCases(cases, new Map(), { status: 'new', country: 'Cameroun' }, user());
    expect(result.items.map((c) => c.caseId)).toEqual(['c-1']);
  });

  it('filters by assignee', () => {
    const assigned = [makeCase({ caseId: 'c-4', assignee: 'inv-1' }), makeCase({ caseId: 'c-5', assignee: 'inv-2' })];
    const result = filterVisibleCases(assigned, new Map(), { assignee: 'inv-1' }, user());
    expect(result.items.map((c) => c.caseId)).toEqual(['c-4']);
  });
});

describe('filterVisibleCases — pagination', () => {
  const cases = Array.from({ length: 10 }, (_, i) => makeCase({ caseId: `c-${i}` }));

  it('returns total across the full visible set, not just the current page', () => {
    const result = filterVisibleCases(cases, new Map(), {}, user(), 3, 0);
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(10);
  });

  it('sets nextOffset when more items remain', () => {
    const result = filterVisibleCases(cases, new Map(), {}, user(), 3, 0);
    expect(result.nextOffset).toBe(3);
  });

  it('omits nextOffset on the last page', () => {
    const result = filterVisibleCases(cases, new Map(), {}, user(), 3, 9);
    expect(result.items).toHaveLength(1);
    expect(result.nextOffset).toBeUndefined();
  });

  it('returns an empty page with the correct total when offset exceeds the visible set', () => {
    const result = filterVisibleCases(cases, new Map(), {}, user(), 3, 100);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(10);
    expect(result.nextOffset).toBeUndefined();
  });
});
