/**
 * === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
 * Tests du moteur de compatibilité d'attribution.
 */
import { describe, expect, it } from 'vitest';
import { AlertRecord, ConflictDeclaration, InvolvedPerson, UserProfile, Witness } from '../types';
import { computeCandidates } from './assignmentEngine';
import { WorkloadRow } from './workloadCalc';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    name: 'Test Investigator',
    email: 't@example.com',
    username: 'test.investigator',
    role: 'investigator',
    roleTitle: 'Investigateur',
    entity: 'ACTIVA Assurances',
    country: 'Cameroun',
    countries: ['CM'],
    entities: ['cm_assurances'],
    active: true,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id: 'alt-1',
    trackingNumber: 'ACT-2026-0001',
    accessCodeHash: 'x',
    accessCodeSalt: 'y',
    channel: 'web',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    whistleblower: { isAnonymous: true },
    category: 'Fraude',
    subCategory: 'Fraude sur les sinistres',
    detailedDescription: 'x',
    incidentDates: '2026-01-01',
    incidentLocation: 'x',
    concernedEntity: 'ACTIVA Assurances',
    country: 'Cameroun',
    countryId: 'CM',
    entityId: 'cm_assurances',
    riskEvaluation: {
      financialImpact: 1,
      hierarchyLevel: 1,
      recidivism: 1,
      reputationRisk: 1,
      totalScore: 4,
      nocaThreshold: 'NOCA 1',
      priority: 'faible',
      expectedTreatment: 'x',
    },
    impactType: 'x',
    involvedPersons: [],
    witnesses: [],
    evidences: [],
    status: 'new',
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
    ...overrides,
  };
}

function noWorkload(u: UserProfile): WorkloadRow {
  return { investigator: u, active: 0, overdue: 0, critical: 0 };
}

describe('computeCandidates — scope buckets', () => {
  it('puts a same-country-same-entity investigator in compatible', () => {
    const alert = makeAlert();
    const user = makeUser({ countries: ['CM'], entities: ['cm_assurances'] });
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible.map((c) => c.user.id)).toEqual(['u-1']);
    expect(result.groupAuthorized).toEqual([]);
  });

  it('puts a globally-scoped investigator (empty countries/entities) in groupAuthorized, not compatible', () => {
    const alert = makeAlert();
    const user = makeUser({ role: 'senior_investigator', countries: [], entities: [] });
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
    expect(result.groupAuthorized.map((c) => c.user.id)).toEqual(['u-1']);
  });

  it('excludes an investigator scoped to a different country entirely from both lists', () => {
    const alert = makeAlert({ countryId: 'GH', entityId: 'gh_activa' });
    const user = makeUser({ countries: ['CM'], entities: ['cm_assurances'] });
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
    expect(result.groupAuthorized).toEqual([]);
  });

  it('excludes an investigator scoped to the right country but wrong entity', () => {
    const alert = makeAlert({ countryId: 'CM', entityId: 'cm_vie' });
    const user = makeUser({ countries: ['CM'], entities: ['cm_assurances'] });
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
    expect(result.groupAuthorized).toEqual([]);
  });

  it('treats a country-only scope (no entity restriction) as a local match on country', () => {
    const alert = makeAlert({ countryId: 'CM', entityId: 'cm_vie' });
    const user = makeUser({ countries: ['CM'], entities: [] });
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible.map((c) => c.user.id)).toEqual(['u-1']);
  });
});

describe('computeCandidates — non-scope exclusions', () => {
  it('excludes a role without cases.edit (e.g. consultation)', () => {
    const alert = makeAlert();
    const user = makeUser({ role: 'consultation', countries: [], entities: [] });
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
    expect(result.groupAuthorized).toEqual([]);
  });

  it('excludes an inactive/unavailable investigator even if otherwise compatible', () => {
    const alert = makeAlert();
    const user = makeUser({ active: false });
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
  });

  it('excludes an investigator with insufficient sensitivity clearance', () => {
    const alert = makeAlert({ confidentialityLevel: 'highly_confidential' });
    const user = makeUser({ role: 'investigator' }); // role ceiling: confidential
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
  });

  it('excludes an investigator with a declared conflict of interest on this case', () => {
    const declaration: ConflictDeclaration = {
      id: 'cd-1',
      userId: 'u-1',
      userName: 'Test Investigator',
      declaredAt: '2026-01-01T00:00:00Z',
      outcome: 'conflict_identified',
    };
    const alert = makeAlert({ conflictDeclarations: [declaration] });
    const user = makeUser();
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
  });

  it('does not exclude an investigator whose own conflict declaration says no_conflict', () => {
    const declaration: ConflictDeclaration = {
      id: 'cd-1',
      userId: 'u-1',
      userName: 'Test Investigator',
      declaredAt: '2026-01-01T00:00:00Z',
      outcome: 'no_conflict',
    };
    const alert = makeAlert({ conflictDeclarations: [declaration] });
    const user = makeUser();
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible.map((c) => c.user.id)).toEqual(['u-1']);
  });
});

// === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
describe('computeCandidates — routage indépendant (§57)', () => {
  it('excludes a candidate linked as the accused on this case', () => {
    const person: InvolvedPerson = { id: 'per-1', name: 'x', position: 'x', hierarchyRole: 'Cadre', linkedUserId: 'u-1' };
    const alert = makeAlert({ involvedPersons: [person] });
    const user = makeUser();
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
    expect(result.groupAuthorized).toEqual([]);
  });

  it('excludes a candidate linked as a witness on this case, not just the accused', () => {
    const witness: Witness = { id: 'wit-1', name: 'x', position: 'x', hierarchyRole: 'Employé', linkedUserId: 'u-1' };
    const alert = makeAlert({ witnesses: [witness] });
    const user = makeUser();
    const result = computeCandidates(alert, [user], [noWorkload(user)]);
    expect(result.compatible).toEqual([]);
  });
});

describe('computeCandidates — sorting by workload', () => {
  it('sorts compatible candidates by ascending active case count', () => {
    const alert = makeAlert();
    const busy = makeUser({ id: 'busy', countries: ['CM'], entities: ['cm_assurances'] });
    const free = makeUser({ id: 'free', countries: ['CM'], entities: ['cm_assurances'] });
    const workload: WorkloadRow[] = [
      { investigator: busy, active: 5, overdue: 1, critical: 0 },
      { investigator: free, active: 0, overdue: 0, critical: 0 },
    ];
    const result = computeCandidates(alert, [busy, free], workload);
    expect(result.compatible.map((c) => c.user.id)).toEqual(['free', 'busy']);
  });
});
