/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5) ===
 */
import { describe, expect, it } from 'vitest';

import { AlertStatusBucket, getAlertStatusBucket } from './alertStatusBuckets';
import { Case } from './caseTypes';
import { caseSummaryId, caseToAlertSummary } from './caseToAlertSummary';

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    caseId: 'case-1',
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
    updatedAt: '2026-01-02T00:00:00Z',
    updatedBy: 'system',
    ...overrides,
  };
}

describe('caseSummaryId', () => {
  it('préfixe toujours "case-" pour ne jamais collisionner avec un id legacy ("alt-...")', () => {
    expect(caseSummaryId('abc123')).toBe('case-abc123');
  });
});

describe('caseToAlertSummary — champs fidèles', () => {
  it('copie fidèlement les champs scalaires présents sur Case', () => {
    const summary = caseToAlertSummary(makeCase());
    expect(summary.trackingNumber).toBe('CASE-2026-000001');
    expect(summary.category).toBe('Fraude');
    expect(summary.subCategory).toBe('Détournement');
    expect(summary.concernedEntity).toBe('ACTIVA Assurances');
    expect(summary.country).toBe('Cameroun');
    expect(summary.detailedDescription).toBe('Test');
    expect(summary.riskEvaluation.totalScore).toBe(4);
  });

  it('id toujours préfixé "case-", jamais un id brut susceptible de collisionner avec le legacy', () => {
    const summary = caseToAlertSummary(makeCase({ caseId: 'xyz' }));
    expect(summary.id).toBe('case-xyz');
  });

  it("dérive isAnonymous de reportingMode (jamais l'inverse)", () => {
    expect(caseToAlertSummary(makeCase({ reportingMode: 'anonymous' })).whistleblower.isAnonymous).toBe(true);
    expect(caseToAlertSummary(makeCase({ reportingMode: 'identified' })).whistleblower.isAnonymous).toBe(false);
  });
});

describe('caseToAlertSummary — tableaux/sous-collections toujours vides, jamais undefined', () => {
  it('remplit chaque champ tableau avec [] plutôt que de le laisser undefined (évite tout crash .length/.flatMap en aval)', () => {
    const summary = caseToAlertSummary(makeCase());
    expect(summary.involvedPersons).toEqual([]);
    expect(summary.witnesses).toEqual([]);
    expect(summary.evidences).toEqual([]);
    expect(summary.messages).toEqual([]);
    expect(summary.internalNotes).toEqual([]);
    expect(summary.correctiveMeasures).toEqual([]);
    expect(summary.tasks).toEqual([]);
    expect(summary.interviews).toEqual([]);
    expect(summary.conflictDeclarations).toEqual([]);
    expect(summary.assignedInvestigatorNames).toEqual([]);
  });
});

describe('caseToAlertSummary — mapping de priorité (inverse de PRIORITY_MAP, migrateLegacy.ts)', () => {
  it.each([
    ['low', 'faible', 'NOCA 1'],
    ['high', 'elevee', 'NOCA 2'],
    ['very_high', 'tres_elevee', 'NOCA 3'],
    ['critical', 'critique', 'NOCA 4'],
  ] as const)('priority=%s -> %s / %s', (casePriority, legacyPriority, noca) => {
    const summary = caseToAlertSummary(makeCase({ priority: casePriority }));
    expect(summary.riskEvaluation.priority).toBe(legacyPriority);
    expect(summary.riskEvaluation.nocaThreshold).toBe(noca);
  });
});

describe('caseToAlertSummary — mapping de statut vers un panier KPI sensé (getAlertStatusBucket)', () => {
  const EXPECTED: Record<Case['status'], AlertStatusBucket> = {
    new: 'a_traiter',
    triage: 'a_traiter',
    under_review: 'en_cours',
    assigned: 'en_cours',
    investigation: 'en_cours',
    pending_information: 'en_cours',
    escalated: 'en_cours',
    conclusion_pending: 'en_attente',
    functional_review: 'en_attente',
    closed: 'clotures',
    reopened: 'en_cours',
    archived: 'clotures',
    duplicate: 'clotures',
    out_of_scope: 'clotures',
  };

  for (const [status, bucket] of Object.entries(EXPECTED)) {
    it(`${status} atterrit dans le panier ${bucket}`, () => {
      const summary = caseToAlertSummary(makeCase({ status: status as Case['status'] }));
      expect(getAlertStatusBucket(summary.status)).toBe(bucket);
    });
  }
});
