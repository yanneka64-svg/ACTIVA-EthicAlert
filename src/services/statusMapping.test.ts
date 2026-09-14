/**
 * === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
 *
 * Tests des deux nouvelles fonctions de correspondance de statut
 * (`deriveCaseStatus`/`syncLegacyStatus`), en particulier leur
 * "aller-retour" : pour chacune des 7 valeurs existantes d'`AlertStatus`,
 * dériver un `CaseStatus` puis le resynchroniser doit reproduire
 * exactement la valeur `AlertStatus` de départ — c'est ce qui garantit
 * qu'aucun écran existant ne voit son comportement changer une fois
 * `storage.transitionStatus()` utilisé.
 */
import { describe, expect, it } from 'vitest';
import { AlertRecord, AlertStatus } from '../types';
import { CaseStatus } from '../domain/caseTypes';
import { deriveCaseStatus, mapToEnterpriseStatus, syncLegacyStatus } from './statusMapping';

function makeAlert(status: AlertStatus, assignedInvestigators: string[] = []): AlertRecord {
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
    status,
    assignedInvestigators,
    assignedInvestigatorNames: [],
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
  };
}

describe('deriveCaseStatus — round trip with syncLegacyStatus', () => {
  const cases: Array<[AlertStatus, string[]]> = [
    ['new', []],
    ['new', ['inv-1']], // assigned sub-state of legacy 'new'
    ['under_review', []],
    ['investigation', []],
    ['corrective_action', []],
    ['closed', []],
    ['reopened', []],
    ['archived', []],
  ];

  it.each(cases)('AlertStatus %s (assigned=%j) survives derive → sync unchanged', (status, assigned) => {
    const alert = makeAlert(status, assigned);
    const caseStatus = deriveCaseStatus(alert);
    expect(syncLegacyStatus(caseStatus)).toBe(status);
  });

  it('lowercases mapToEnterpriseStatus into a real CaseStatus value', () => {
    const alert = makeAlert('investigation');
    expect(deriveCaseStatus(alert)).toBe(mapToEnterpriseStatus(alert).toLowerCase());
    expect(deriveCaseStatus(alert)).toBe('investigation');
  });
});

describe('syncLegacyStatus — richer CaseStatus values with no exact legacy equivalent', () => {
  it('folds pre-investigation review stages (triage/under_review) to legacy under_review', () => {
    expect(syncLegacyStatus('triage')).toBe('under_review');
    expect(syncLegacyStatus('under_review')).toBe('under_review');
  });

  it('folds active-but-not-yet-classic-investigation states to legacy investigation', () => {
    expect(syncLegacyStatus('pending_information')).toBe('investigation');
    expect(syncLegacyStatus('escalated')).toBe('investigation');
  });

  it('folds post-investigation remediation stages to legacy corrective_action', () => {
    expect(syncLegacyStatus('conclusion_pending')).toBe('corrective_action');
    expect(syncLegacyStatus('functional_review')).toBe('corrective_action');
  });

  it('folds terminal non-substantiated outcomes (duplicate/out_of_scope) to legacy closed', () => {
    expect(syncLegacyStatus('duplicate')).toBe('closed');
    expect(syncLegacyStatus('out_of_scope')).toBe('closed');
  });

  it('every CaseStatus value maps to a defined AlertStatus (no silent undefined)', () => {
    const allCaseStatuses: CaseStatus[] = [
      'new', 'triage', 'under_review', 'assigned', 'investigation', 'pending_information',
      'escalated', 'conclusion_pending', 'functional_review', 'closed', 'reopened', 'archived',
      'duplicate', 'out_of_scope',
    ];
    for (const s of allCaseStatuses) {
      expect(typeof syncLegacyStatus(s)).toBe('string');
    }
  });
});
