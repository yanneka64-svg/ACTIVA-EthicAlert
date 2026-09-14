/**
 * === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
 */
import { describe, expect, it } from 'vitest';
import { AlertRecord, UserProfile } from '../types';
import { evaluateEscalationCriteria, getGroupEscalationOwners } from './escalationCriteria';

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
    category: 'Intégrité des affaires et relation client',
    subCategory: 'x',
    detailedDescription: 'x',
    incidentDates: '2026-01-01',
    incidentLocation: 'x',
    concernedEntity: 'ACTIVA Assurances',
    country: 'Cameroun',
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

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    name: 'Test',
    email: 't@example.com',
    role: 'investigator',
    roleTitle: 'x',
    entity: 'x',
    country: 'x',
    ...overrides,
  };
}

describe('evaluateEscalationCriteria', () => {
  it('returns nothing for a low-risk, standard case', () => {
    expect(evaluateEscalationCriteria(makeAlert())).toEqual([]);
  });

  it('flags senior management implication', () => {
    const alert = makeAlert({
      involvedPersons: [{ id: 'p1', name: 'x', position: 'x', hierarchyRole: 'Directeur+' }],
    });
    const result = evaluateEscalationCriteria(alert);
    expect(result.map((c) => c.key)).toContain('senior_management');
  });

  it('flags a corruption category', () => {
    const alert = makeAlert({ category: 'Fraude, Corruption et pots-de-vin' });
    expect(evaluateEscalationCriteria(alert).map((c) => c.key)).toContain('corruption');
  });

  it('flags highest sensitivity', () => {
    const alert = makeAlert({ confidentialityLevel: 'highly_confidential' });
    expect(evaluateEscalationCriteria(alert).map((c) => c.key)).toContain('highest_sensitivity');
  });

  it('flags maximal financial impact', () => {
    const alert = makeAlert({
      riskEvaluation: { financialImpact: 4, hierarchyLevel: 1, recidivism: 1, reputationRisk: 1, totalScore: 7, nocaThreshold: 'NOCA 2', priority: 'elevee', expectedTreatment: 'x' },
    });
    expect(evaluateEscalationCriteria(alert).map((c) => c.key)).toContain('financial_threshold');
  });

  it('flags a whistleblower entity different from the case entity', () => {
    const alert = makeAlert({ whistleblower: { isAnonymous: false, entity: 'ACTIVA Vie' } });
    expect(evaluateEscalationCriteria(alert).map((c) => c.key)).toContain('multi_entity');
  });

  it('flags a whistleblower country different from the case country', () => {
    const alert = makeAlert({ whistleblower: { isAnonymous: true, declarantCountry: 'Ghana' } });
    expect(evaluateEscalationCriteria(alert).map((c) => c.key)).toContain('multi_country');
  });
});

describe('getGroupEscalationOwners', () => {
  it('includes only globally-scoped senior_investigator/darc_compliance accounts', () => {
    const groupSenior = makeUser({ id: 'g1', role: 'senior_investigator', countries: [], entities: [] });
    const groupDarc = makeUser({ id: 'g2', role: 'darc_compliance', countries: [], entities: [] });
    const scopedSenior = makeUser({ id: 'g3', role: 'senior_investigator', countries: ['CM'], entities: ['cm_assurances'] });
    const wrongRole = makeUser({ id: 'g4', role: 'functional_admin', countries: [], entities: [] });
    const inactive = makeUser({ id: 'g5', role: 'darc_compliance', countries: [], entities: [], active: false });

    const result = getGroupEscalationOwners([groupSenior, groupDarc, scopedSenior, wrongRole, inactive]);
    expect(result.map((u) => u.id).sort()).toEqual(['g1', 'g2']);
  });
});
