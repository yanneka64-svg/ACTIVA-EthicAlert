/**
 * === AMÉLIORATION AJOUTÉE (couverture de tests pour la couche backend cible) ===
 *
 * `migrateLegacyAlertsToCases` est la fonction qui prouve que le modèle
 * cible (`domain/caseTypes.ts`) peut réellement absorber les données du
 * modèle actuel sans perte silencieuse (voir son propre commentaire
 * d'en-tête : "no fake data" — un constat honnête, jamais une valeur
 * inventée). Aucun test n'existait pour elle avant ce fichier.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { installTestLocalStorage } from './testLocalStorageStub';
import { LocalCaseRepository } from './caseRepository';
import { migrateLegacyAlertsToCases } from './migrateLegacy';
import { AlertRecord } from '../types';

installTestLocalStorage();

beforeEach(() => {
  localStorage.clear();
});

function baseAlert(overrides: Partial<AlertRecord> = {}): AlertRecord {
  return {
    id: 'legacy-1',
    trackingNumber: 'AACMR-26-09-0001',
    accessCodeHash: 'hash-value',
    accessCodeSalt: 'salt-value',
    channel: 'web',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    whistleblower: { isAnonymous: true },
    category: 'Fraude',
    subCategory: 'Détournement',
    detailedDescription: 'Détail des faits signalés.',
    incidentDates: 'Courant août 2026',
    incidentLocation: 'Douala',
    concernedEntity: 'ACTIVA_CI',
    country: 'CM',
    riskEvaluation: {
      financialImpact: 2,
      hierarchyLevel: 2,
      recidivism: 1,
      reputationRisk: 2,
      totalScore: 12,
      nocaThreshold: 'NOCA 2',
      priority: 'elevee',
      expectedTreatment: '—',
    },
    impactType: 'Financier',
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

describe('migrateLegacyAlertsToCases', () => {
  it('maps a single alert to a Case with the correct field mapping and child-collection counts', async () => {
    const repo = new LocalCaseRepository();
    const alert = baseAlert({
      assignedInvestigators: ['inv-1', 'inv-2'],
      involvedPersons: [{ id: 'p1', name: 'Personne A', position: 'Comptable', hierarchyRole: 'Cadre' }],
      witnesses: [{ id: 'w1', name: 'Témoin B', position: 'Assistant', hierarchyRole: 'Employé' }],
      evidences: [{ id: 'e1', name: 'facture.pdf', size: 1024, type: 'application/pdf', uploadedAt: '2026-09-01T10:00:00.000Z' }],
      correctiveMeasures: [
        { id: 'c1', title: 'Renforcer les contrôles', description: 'Détail.', responsiblePerson: 'admin-1', dueDate: '2026-10-01', status: 'in_progress', documentedBy: 'admin-1', documentedAt: '2026-09-01T10:00:00.000Z' },
      ],
      messages: [{ id: 'm1', sender: 'investigator', senderDisplayName: 'Enquêteur', content: 'Bonjour', createdAt: '2026-09-01T10:00:00.000Z' }],
      internalNotes: [{ id: 'n1', authorId: 'inv-1', authorName: 'Enquêteur', authorRole: 'investigator', content: 'Note interne', createdAt: '2026-09-01T10:00:00.000Z', isPrivate: true }],
    });

    const [result] = await migrateLegacyAlertsToCases([alert], repo);
    expect(result.legacyId).toBe('legacy-1');
    expect(result.caseNumber).toMatch(/^CASE-\d{4}-\d{6}$/);

    const admin = { userId: 'admin', name: 'Admin', email: 'a@a.com', roleId: 'functional_admin' as const, countries: [], entities: [], active: true, mfaEnabled: false, createdAt: new Date().toISOString() };
    const kase = await repo.getCase(result.caseId, admin);
    expect(kase?.status).toBe('new');
    expect(kase?.country).toBe('CM');
    expect(kase?.entity).toBe('ACTIVA_CI');
    expect(kase?.priority).toBe('high'); // 'elevee' → 'high'
    expect(kase?.confidentialityLevel).toBe('confidential'); // 'high' priority → 'confidential'
    expect(kase?.assignee).toBe('inv-1');
    expect(kase?.additionalInvestigators).toEqual(['inv-2']);
    expect(kase?.reportingMode).toBe('anonymous');

    expect(await repo.listAllegations(result.caseId)).toHaveLength(1);
    expect(await repo.listPersons(result.caseId)).toHaveLength(2); // 1 subject + 1 witness
    expect(await repo.listEvidence(result.caseId, admin)).toHaveLength(1);
    expect(await repo.listCorrectiveActions(result.caseId)).toHaveLength(1);
    expect(await repo.listCommunications(result.caseId)).toHaveLength(1);
    expect(await repo.listInvestigationNotes(result.caseId, admin)).toHaveLength(1);

    const risk = await repo.getActiveRiskAssessment(result.caseId);
    expect(risk?.totalScore).toBe(12);
  });

  it('leaves the migrated allegation open (no invented finding) for an already-closed legacy alert, with an honest warning', async () => {
    const repo = new LocalCaseRepository();
    const alert = baseAlert({ status: 'closed', closedAt: '2026-09-05T10:00:00.000Z', closedBy: 'admin-1' });

    const [result] = await migrateLegacyAlertsToCases([alert], repo);
    expect(result.warnings.some((w) => w.toLowerCase().includes('finding'))).toBe(true);

    const [allegation] = await repo.listAllegations(result.caseId);
    expect(allegation.status).toBe('open');
    expect(allegation.finding).toBeUndefined();
  });

  it('only creates a reporter identity record for a non-anonymous alert', async () => {
    const repo = new LocalCaseRepository();
    const anonymous = baseAlert({ id: 'legacy-anon', trackingNumber: 'AACMR-26-09-0002' });
    const identified = baseAlert({
      id: 'legacy-named',
      trackingNumber: 'AACMR-26-09-0003',
      whistleblower: { isAnonymous: false, fullName: 'Jeanne Doe', email: 'jeanne@example.com' },
    });

    const [anonResult, namedResult] = await migrateLegacyAlertsToCases([anonymous, identified], repo);

    const admin = { userId: 'admin', name: 'Admin', email: 'a@a.com', roleId: 'functional_admin' as const, countries: [], entities: [], active: true, mfaEnabled: false, createdAt: new Date().toISOString() };
    expect(await repo.getReporterIdentity(anonResult.caseId, admin)).toBeNull();
    expect((await repo.getReporterIdentity(namedResult.caseId, admin))?.fullName).toBe('Jeanne Doe');
  });

  it('records a second, active override risk assessment when the legacy alert has an overridePriority', async () => {
    const repo = new LocalCaseRepository();
    const alert = baseAlert({ overridePriority: 'critique', overrideReason: 'Nouvelle information reçue.' });

    const [result] = await migrateLegacyAlertsToCases([alert], repo);
    const active = await repo.getActiveRiskAssessment(result.caseId);
    expect(active?.isOverride).toBe(true);
    expect(active?.priority).toBe('critical');
    expect(active?.overrideReason).toBe('Nouvelle information reçue.');
  });
});
