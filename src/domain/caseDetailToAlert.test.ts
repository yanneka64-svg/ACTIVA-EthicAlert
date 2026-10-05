/**
 * === AMÉLIORATION AJOUTÉE (lecture des dossiers Firebase par le portail) ===
 */
import { describe, expect, it } from 'vitest';

import { AlertRecord, EvidenceFile } from '../types';
import { Case } from './caseTypes';
import { CaseDetail, caseDetailToAlertRecord } from './caseDetailToAlert';

const audit = { createdAt: '2026-10-01T10:00:00Z', createdBy: 'uid-op', updatedAt: '2026-10-01T10:00:00Z', updatedBy: 'uid-op' };

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    caseId: 'c1',
    caseNumber: 'CASE-2026-000001',
    externalReference: 'AV-26-10-0001',
    status: 'assigned',
    category: 'Fraude',
    subcategory: 'Détournement',
    country: 'Cameroun',
    entity: 'ACTIVA Assurances',
    reportingMode: 'anonymous',
    priority: 'high',
    riskScore: 9,
    confidentialityLevel: 'confidential',
    assignee: 'uid-inv',
    additionalInvestigators: [],
    implicatedUserIds: [],
    slaStatus: 'ok',
    receivedAt: '2026-10-01T09:00:00Z',
    incidentDateUnknown: true,
    description: 'Description du signalement',
    legalHold: false,
    createdAt: '2026-10-01T09:00:00Z',
    createdBy: 'reporter',
    updatedAt: '2026-10-02T09:00:00Z',
    updatedBy: 'uid-op',
    ...overrides,
  };
}

function makeDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    case: makeCase(),
    persons: [
      { ...audit, personId: 'p1', caseId: 'c1', kind: 'subject', name: 'M. Dupont', position: 'Chef comptable', hierarchyLevel: 'manager', linkedUserId: 'uid-x' },
      { ...audit, personId: 'p2', caseId: 'c1', kind: 'witness', name: 'Mme Martin', hierarchyLevel: 'employee' },
    ],
    tasks: [
      { ...audit, taskId: 't1', caseId: 'c1', title: 'Collecter les pièces', owner: 'uid-inv', priority: 'very_high', dueDate: '2026-10-10', status: 'in_progress' },
      { ...audit, taskId: 't2', caseId: 'c1', title: 'Annulée', owner: 'uid-inv', priority: 'low', dueDate: '2026-10-10', status: 'cancelled' },
    ],
    interviews: [{ ...audit, interviewId: 'i1', caseId: 'c1', intervieweeLabel: 'Mme Martin', conductedBy: 'uid-inv', status: 'planned' }],
    notes: [{ ...audit, noteId: 'n1', caseId: 'c1', authorId: 'uid-inv', content: 'Note interne' }],
    communications: [
      { ...audit, messageId: 'm1', caseId: 'c1', sender: 'reporter', senderDisplayName: 'Déclarant', content: 'Bonjour' },
      { ...audit, messageId: 'm2', caseId: 'c1', sender: 'investigator', senderDisplayName: 'Enquêteur', content: 'Merci' },
    ],
    correctiveActions: [
      { ...audit, actionId: 'a1', caseId: 'c1', description: 'Former l’équipe — Session sur les achats', owner: 'RH', dueDate: '2026-11-01', priority: 'high', status: 'open' },
      { ...audit, actionId: 'a2', caseId: 'c1', description: 'Audit fournisseurs', owner: 'Audit', dueDate: '2026-11-01', priority: 'high', status: 'overdue' },
    ],
    riskAssessment: {
      ...audit,
      assessmentId: 'r1',
      caseId: 'c1',
      financialImpact: 3,
      hierarchicalLevel: 2,
      recurrence: 1,
      reputationRisk: 4,
      totalScore: 10,
      priority: 'very_high',
      isOverride: false,
      active: true,
    },
    coiDeclarations: [{ caseId: 'c1', userId: 'uid-inv', declaredAt: '2026-10-01T11:00:00Z', outcome: 'no_conflict' }],
    evidence: [
      { ...audit, evidenceId: 'e1', caseId: 'c1', fileName: 'facture.pdf', fileType: 'application/pdf', fileSize: 1200, version: 1, confidentiality: 'standard', status: 'active' },
    ],
    ...overrides,
  };
}

const names: Record<string, string> = { 'uid-inv': 'Jean Enquêteur', 'uid-op': 'Awa Opératrice' };
const nameOf = (id: string) => names[id];

describe('caseDetailToAlertRecord — nouveau dossier', () => {
  const alert = caseDetailToAlertRecord(makeDetail(), undefined, nameOf);

  it('identité, lien Firebase et numéro de suivi du déclarant', () => {
    expect(alert.id).toBe('case-c1');
    expect(alert.trackingNumber).toBe('AV-26-10-0001');
    expect(alert.mirroredCaseId).toBe('c1');
    expect(alert.mirroredCaseNumber).toBe('CASE-2026-000001');
    expect(alert.cloudImported).toBe(true);
    expect(alert.channel).toBe('web');
    expect(alert.workflowStatus).toBe('assigned');
  });

  it('sans référence externe, le numéro Firebase sert de numéro de suivi ; dossier créé par le personnel = canal direct', () => {
    const a = caseDetailToAlertRecord(makeDetail({ case: makeCase({ externalReference: undefined, createdBy: 'uid-op' }) }), undefined, nameOf);
    expect(a.trackingNumber).toBe('CASE-2026-000001');
    expect(a.channel).toBe('direct');
  });

  it('attribution avec noms résolus par l’annuaire', () => {
    expect(alert.assignedInvestigators).toEqual(['uid-inv']);
    expect(alert.assignedInvestigatorNames).toEqual(['Jean Enquêteur']);
  });

  it('personnes mises en cause et témoins', () => {
    expect(alert.involvedPersons).toEqual([{ id: 'p1', name: 'M. Dupont', position: 'Chef comptable', hierarchyRole: 'Cadre', linkedUserId: 'uid-x' }]);
    expect(alert.witnesses).toEqual([{ id: 'p2', name: 'Mme Martin', position: '', hierarchyRole: 'Employé' }]);
  });

  it('évaluation de risque active (sous-scores réels)', () => {
    expect(alert.riskEvaluation).toMatchObject({ financialImpact: 3, hierarchyLevel: 2, recidivism: 1, reputationRisk: 4, totalScore: 10, priority: 'tres_elevee' });
  });

  it('tâches (annulées omises), entretiens, notes, messages, conflits', () => {
    expect(alert.tasks).toEqual([
      expect.objectContaining({ id: 't1', title: 'Collecter les pièces', priority: 'high', status: 'in_progress', owner: 'uid-inv' }),
    ]);
    expect(alert.interviews).toEqual([expect.objectContaining({ id: 'i1', intervieweeName: 'Mme Martin', status: 'planned' })]);
    expect(alert.internalNotes).toEqual([expect.objectContaining({ id: 'n1', authorName: 'Jean Enquêteur', content: 'Note interne' })]);
    expect(alert.messages.map((m) => m.sender)).toEqual(['whistleblower', 'investigator']);
    expect(alert.conflictDeclarations).toEqual([expect.objectContaining({ userId: 'uid-inv', userName: 'Jean Enquêteur', outcome: 'no_conflict' })]);
  });

  it('mesures correctives : titre/description séparés, statuts sans équivalent ramenés au plus proche', () => {
    expect(alert.correctiveMeasures[0]).toMatchObject({ title: 'Former l’équipe', description: 'Session sur les achats', status: 'planned' });
    expect(alert.correctiveMeasures[1]).toMatchObject({ title: 'Audit fournisseurs', description: '', status: 'in_progress' });
  });

  it('pièces : métadonnées, sans contenu', () => {
    expect(alert.evidences).toEqual([{ id: 'e1', name: 'facture.pdf', size: 1200, type: 'application/pdf', uploadedAt: audit.createdAt, uploadedBy: 'Awa Opératrice' }]);
  });

  it('sans évaluation de risque : valeurs plancher du résumé, jamais devinées', () => {
    const a = caseDetailToAlertRecord(makeDetail({ riskAssessment: null }), undefined, nameOf);
    expect(a.riskEvaluation).toMatchObject({ financialImpact: 1, totalScore: 9, priority: 'elevee' });
  });
});

describe('caseDetailToAlertRecord — fusion avec la copie locale', () => {
  const localEvidence: EvidenceFile = { id: 'loc-1', name: 'photo.jpg', size: 10, type: 'image/jpeg', uploadedAt: '2026-10-03', dataUrl: 'data:image/jpeg;base64,AAAA' };
  const existing = {
    ...caseDetailToAlertRecord(makeDetail(), undefined, nameOf),
    status: 'new',
    escalatedAt: '2026-10-03T08:00:00Z',
    escalatedReason: 'Sensibilité',
    investigationReport: 'Rapport local',
    evidences: [localEvidence],
  } as AlertRecord;

  const merged = caseDetailToAlertRecord(makeDetail(), existing, nameOf);

  it('Firebase fait référence pour les champs synchronisés', () => {
    expect(merged.status).toBe(caseDetailToAlertRecord(makeDetail(), undefined, nameOf).status);
    expect(merged.tasks).toHaveLength(1);
  });

  it('les champs propres au navigateur sont conservés', () => {
    expect(merged.escalatedAt).toBe('2026-10-03T08:00:00Z');
    expect(merged.escalatedReason).toBe('Sensibilité');
    expect(merged.investigationReport).toBe('Rapport local');
  });

  it('les pièces locales (avec contenu) s’ajoutent à celles connues de Firebase', () => {
    expect(merged.evidences.map((e) => e.id)).toEqual(['e1', 'loc-1']);
    expect(merged.evidences[1].dataUrl).toBe(localEvidence.dataUrl);
  });
});

// === AMÉLIORATION AJOUTÉE (vérification de bout en bout) ===
describe('caseDetailToAlertRecord — statut enregistré par le portail', () => {
  it('le statut détaillé suit le statut affiché (attribution → en investigation)', () => {
    const d = makeDetail();
    const r = caseDetailToAlertRecord({ ...d, case: { ...d.case, status: 'new', portal: { status: 'investigation' } } }, undefined, nameOf);
    expect(r.status).toBe('investigation');
    expect(r.workflowStatus).toBe('investigation');
  });
});
