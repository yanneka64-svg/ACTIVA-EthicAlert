/**
 * === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER dans Firebase) ===
 */
import { describe, expect, it } from 'vitest';
import type { AlertRecord } from '../types';
import { buildBackfillSubmission, buildReporterCaseDetails, clampReporterCore, isLocalOnlyPublicReport } from './alertToReporterSubmission';
import { REPORTER_INPUT_LIMITS, parseReporterCaseInput } from './reporterCaseInput';

function makeAlert(overrides: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id: 'alt-1759650000000',
    trackingNumber: 'AACMR-26-10-0001',
    accessCodeHash: `pbkdf2_sha256$600000$${'c'.repeat(64)}`,
    accessCodeSalt: '00112233445566778899aabbccddeeff',
    channel: 'web',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    targetCompletionDate: '2026-10-31T08:00:00.000Z',
    confidentialityLevel: 'confidential',
    whistleblower: { isAnonymous: false, fullName: 'Marie N.', email: 'marie@example.com', declarantType: 'Employé', declarantCountry: 'Cameroun' },
    category: 'Fraude',
    subCategory: 'Détournement',
    detailedDescription: 'Des primes ont été détournées.',
    incidentDates: '2026-09-12',
    incidentLocation: 'Douala',
    concernedEntity: 'ACTIVA Assurances Cameroun',
    country: 'Cameroun',
    isOngoing: true,
    impactType: 'Financier',
    estimatedImpactValue: '5 000 000 XAF',
    riskEvaluation: { financialImpact: 3, hierarchyLevel: 2, recidivism: 1, reputationRisk: 2, totalScore: 8, nocaThreshold: 'NOCA 2', priority: 'elevee', expectedTreatment: '' },
    involvedPersons: [{ id: 'p1', name: 'J. Dupont', position: 'Chef comptable', hierarchyRole: 'Cadre' }],
    witnesses: [{ id: 'w1', name: 'A. Martin', position: '', hierarchyRole: 'Employé' }],
    evidences: [{ id: 'e1', name: 'facture.pdf', size: 2048, type: 'application/pdf', uploadedAt: '2026-10-01T08:00:00.000Z', dataUrl: 'data:...' }],
    status: 'new',
    assignedInvestigators: [],
    assignedInvestigatorNames: [],
    internalNotes: [],
    messages: [],
    correctiveMeasures: [],
    ...overrides,
  } as AlertRecord;
}

describe('buildReporterCaseDetails', () => {
  it('reprend tout le contenu du formulaire', () => {
    const d = buildReporterCaseDetails(makeAlert());
    expect(d).toMatchObject({
      incidentDates: '2026-09-12',
      incidentLocation: 'Douala',
      isOngoing: true,
      impactType: 'Financier',
      estimatedImpactValue: '5 000 000 XAF',
      slaDueAt: '2026-10-31T08:00:00.000Z',
      risk: { financialImpact: 3, hierarchicalLevel: 2, recurrence: 1, reputationRisk: 2, totalScore: 8, priority: 'high' },
      persons: [
        { kind: 'subject', name: 'J. Dupont', position: 'Chef comptable', hierarchyLevel: 'manager' },
        { kind: 'witness', name: 'A. Martin', hierarchyLevel: 'employee' },
      ],
      identity: { fullName: 'Marie N.', email: 'marie@example.com', declarantType: 'Employé', country: 'Cameroun' },
      evidence: [{ name: 'facture.pdf', type: 'application/pdf', size: 2048 }],
    });
  });

  it("n'envoie jamais le contenu des fichiers ni l'identité d'un déclarant anonyme", () => {
    const d = buildReporterCaseDetails(makeAlert({ whistleblower: { isAnonymous: true } }));
    expect(d.identity).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain('data:');
  });

  it('est accepté tel quel par la validation du serveur', () => {
    const d = buildReporterCaseDetails(makeAlert());
    const r = parseReporterCaseInput({ category: 'Fraude', country: 'Cameroun', entity: 'X', description: 'Y', reportingMode: 'identified', details: d });
    expect(r.ok && r.value.details).toEqual(d);
  });
});

describe('clampReporterCore', () => {
  it('ramène les textes aux tailles acceptées et ne laisse aucun champ requis vide', () => {
    const c = clampReporterCore({ category: '', country: ' ', entity: 'e'.repeat(500), description: 'd'.repeat(30000), subcategory: '' });
    expect(c.entity).toHaveLength(REPORTER_INPUT_LIMITS.entity);
    expect(c.description).toHaveLength(REPORTER_INPUT_LIMITS.description);
    expect(c.category).toBe('Non précisé');
    expect(c.country).toBe('Non précisé');
    expect('subcategory' in c).toBe(false);
    expect(parseReporterCaseInput(c).ok).toBe(true);
  });
});

describe('rattrapage des signalements restés sur l’appareil', () => {
  it('repère uniquement les dépôts publics jamais transmis', () => {
    expect(isLocalOnlyPublicReport(makeAlert())).toBe(true);
    expect(isLocalOnlyPublicReport(makeAlert({ mirroredCaseId: 'case-1' }))).toBe(false);
    expect(isLocalOnlyPublicReport(makeAlert({ cloudImported: true }))).toBe(false);
    expect(isLocalOnlyPublicReport(makeAlert({ channel: 'direct' }))).toBe(false);
    expect(isLocalOnlyPublicReport(makeAlert({ id: 'alt-001' }))).toBe(false); // dossier de démonstration
  });

  it('conserve le numéro de suivi et l’empreinte du code, sans doublon possible', () => {
    const alert = makeAlert();
    const b = buildBackfillSubmission(alert);
    expect(b.externalReference).toBe('AACMR-26-10-0001');
    expect(b.submissionId).toBe('backfill-alt-1759650000000');
    expect(b.accessCodeHash).toBe(alert.accessCodeHash);
    expect(b.reportingMode).toBe('identified');
    const r = parseReporterCaseInput(b);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.accessCodeHash).toBe(alert.accessCodeHash);
    expect(r.ok && r.value.details?.persons).toHaveLength(2);
  });
});
