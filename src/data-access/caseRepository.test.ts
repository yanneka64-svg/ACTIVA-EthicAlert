/**
 * === AMÉLIORATION AJOUTÉE (couverture de tests pour la couche backend cible) ===
 *
 * `LocalCaseRepository` est la préfiguration fonctionnelle du futur backend
 * (Cloud Functions, voir functions/src/index.ts) : chaque écriture y revalide
 * déjà les permissions (`domain/permissions.can`) et les transitions de
 * workflow (`domain/workflow.checkTransition`) exactement comme le fera un
 * jour le serveur réel. Ce fichier n'existait pas — aucune régression sur
 * cette logique (règle #9 « personne mise en cause », cadenas de clôture,
 * unicité de l'évaluation de risque active...) n'aurait été détectée
 * automatiquement avant ce test.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { installTestLocalStorage } from './testLocalStorageStub';
import { CaseAccessDeniedError, LocalCaseRepository } from './caseRepository';
import { AppUser, Case } from '../domain/caseTypes';

installTestLocalStorage();

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    userId: 'u-1',
    name: 'Test User',
    email: 'test@group-activa.com',
    roleId: 'investigator',
    countries: [],
    entities: [],
    active: true,
    mfaEnabled: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function caseInput(overrides: Partial<Omit<Case, 'caseId' | 'caseNumber' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>> = {}) {
  return {
    status: 'new' as const,
    category: 'Fraude',
    subcategory: 'Détournement',
    country: 'CM',
    entity: 'ACTIVA_CI',
    reportingMode: 'anonymous' as const,
    priority: 'high' as const,
    riskScore: 12,
    confidentialityLevel: 'restricted' as const,
    additionalInvestigators: [] as string[],
    implicatedUserIds: [] as string[],
    slaStatus: 'ok' as const,
    receivedAt: new Date().toISOString(),
    incidentDateUnknown: true,
    description: 'Description de test.',
    legalHold: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('LocalCaseRepository — createCase / getCase', () => {
  it('generates a sequential, year-scoped case number and persists the case', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'actor-1');
    expect(kase.caseId).toBeTruthy();
    expect(kase.caseNumber).toMatch(/^CASE-\d{4}-\d{6}$/);

    const reader = user({ userId: 'actor-1', roleId: 'functional_admin' });
    const reloaded = await repo.getCase(kase.caseId, reader);
    expect(reloaded?.caseId).toBe(kase.caseId);
  });

  it('returns null for a case that does not exist', async () => {
    const repo = new LocalCaseRepository();
    const result = await repo.getCase('does-not-exist', user({ roleId: 'functional_admin' }));
    expect(result).toBeNull();
  });

  it('lets an assigned investigator read their own case', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ assignee: 'inv-1' }), 'creator');
    const investigator = user({ userId: 'inv-1', roleId: 'investigator' });
    const result = await repo.getCase(kase.caseId, investigator);
    expect(result?.caseId).toBe(kase.caseId);
  });

  it('denies a non-assigned investigator with no global visibility', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ assignee: 'someone-else' }), 'creator');
    const investigator = user({ userId: 'inv-2', roleId: 'investigator' });
    await expect(repo.getCase(kase.caseId, investigator)).rejects.toBeInstanceOf(CaseAccessDeniedError);
  });

  it('rule #9 — an implicated person is denied even as an assigned, global-visibility admin', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ assignee: 'admin-1' }), 'creator');
    await repo.addPerson(kase.caseId, { kind: 'subject', name: 'John Doe', linkedUserId: 'admin-1' }, user({ roleId: 'functional_admin' }));

    const implicatedAdmin = user({ userId: 'admin-1', roleId: 'functional_admin' });
    await expect(repo.getCase(kase.caseId, implicatedAdmin)).rejects.toBeInstanceOf(CaseAccessDeniedError);
  });

  it('denies access when the case is outside the user country/entity scope', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ country: 'SN' }), 'creator');
    const admin = user({ roleId: 'functional_admin', countries: ['CM'] });
    await expect(repo.getCase(kase.caseId, admin)).rejects.toBeInstanceOf(CaseAccessDeniedError);
  });

  it('denies access when the confidentiality level exceeds the role clearance', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ assignee: 'inv-1', confidentialityLevel: 'highly_confidential' }), 'creator');
    const investigator = user({ userId: 'inv-1', roleId: 'investigator' }); // cleared only to 'confidential'
    await expect(repo.getCase(kase.caseId, investigator)).rejects.toBeInstanceOf(CaseAccessDeniedError);
  });
});

describe('LocalCaseRepository — listCases', () => {
  it('only returns cases the requesting user is permitted to see, and applies filters', async () => {
    const repo = new LocalCaseRepository();
    await repo.createCase(caseInput({ status: 'new', country: 'CM' }), 'creator');
    await repo.createCase(caseInput({ status: 'triage', country: 'SN' }), 'creator');

    const scopedAdmin = user({ roleId: 'functional_admin', countries: ['CM'] });
    const page = await repo.listCases({}, scopedAdmin);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].country).toBe('CM');

    const globalAdmin = user({ roleId: 'functional_admin' });
    const filtered = await repo.listCases({ status: 'triage' }, globalAdmin);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].status).toBe('triage');
  });
});

describe('LocalCaseRepository — changeCaseStatus', () => {
  it('applies a structurally valid transition and records timeline/audit', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'creator');
    const admin = user({ roleId: 'functional_admin' });

    const { case: updated, result } = await repo.changeCaseStatus(kase.caseId, 'triage', admin);
    expect(result.allowed).toBe(true);
    expect(updated.status).toBe('triage');

    const timeline = await repo.getTimeline(kase.caseId);
    expect(timeline.some((e) => e.label.includes('TRIAGE'))).toBe(true);
  });

  it('rejects a transition that is not part of the defined workflow, without throwing', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'creator');
    const admin = user({ roleId: 'functional_admin' });

    const { case: unchanged, result } = await repo.changeCaseStatus(kase.caseId, 'closed', admin);
    expect(result.allowed).toBe(false);
    expect(unchanged.status).toBe('new');
  });

  it('enforces closure gating: no allegation, then unassessed allegation, then missing sign-off, then success', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ status: 'functional_review' }), 'creator');
    const admin = user({ roleId: 'functional_admin' });

    const noAllegation = await repo.changeCaseStatus(kase.caseId, 'closed', admin);
    expect(noAllegation.result.allowed).toBe(false);
    expect(noAllegation.result.reason).toMatch(/allegation/i);

    const allegation = await repo.addAllegation(kase.caseId, { category: 'Fraude', subcategory: 'Détournement', description: 'Détail.' }, admin);
    const unassessed = await repo.changeCaseStatus(kase.caseId, 'closed', admin);
    expect(unassessed.result.allowed).toBe(false);

    await repo.setAllegationFinding(allegation.allegationId, 'SUBSTANTIATED', 'Confirmé par les preuves.', admin);

    // === AMÉLIORATION AJOUTÉE (correctif — cadenas de revue fonctionnelle) ===
    // Allegations assessed and no open corrective action is NOT enough on
    // its own: closure from 'functional_review' also requires a recorded
    // sign-off (previously never actually enforced — see caseTypes.ts).
    const noSignOff = await repo.changeCaseStatus(kase.caseId, 'closed', admin);
    expect(noSignOff.result.allowed).toBe(false);
    expect(noSignOff.result.reason).toMatch(/sign-off/i);

    const signedOff = await repo.recordFunctionalReviewSignOff(kase.caseId, admin);
    expect(signedOff.functionalReviewSignedOffBy).toBe(admin.userId);

    const { case: closed, result } = await repo.changeCaseStatus(kase.caseId, 'closed', admin);
    expect(result.allowed).toBe(true);
    expect(closed.status).toBe('closed');
    expect(closed.overallFinding).toBe('substantiated');
  });

  it('rejects closure while a corrective action remains open', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ status: 'functional_review' }), 'creator');
    const admin = user({ roleId: 'functional_admin' });
    const allegation = await repo.addAllegation(kase.caseId, { category: 'Fraude', subcategory: 'Détournement', description: 'Détail.' }, admin);
    await repo.setAllegationFinding(allegation.allegationId, 'UNSUBSTANTIATED', 'Non confirmé.', admin);
    await repo.addCorrectiveAction(kase.caseId, { description: 'Renforcer les contrôles', owner: 'admin-1', dueDate: new Date().toISOString(), priority: 'high', status: 'open' }, admin);

    const { result } = await repo.changeCaseStatus(kase.caseId, 'closed', admin);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/corrective/i);
  });

  it('denies a role without cases.close from closing a case, even with a valid transition', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput({ status: 'functional_review', assignee: 'inv-1' }), 'creator');
    const investigator = user({ userId: 'inv-1', roleId: 'investigator' }); // has cases.edit, not cases.close
    await expect(repo.changeCaseStatus(kase.caseId, 'closed', investigator)).rejects.toBeInstanceOf(CaseAccessDeniedError);
  });
});

describe('LocalCaseRepository — assignCase / addPerson', () => {
  it('assigns a case and records the change', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'creator');
    const admin = user({ roleId: 'functional_admin' });
    const updated = await repo.assignCase(kase.caseId, 'inv-1', ['inv-2'], admin);
    expect(updated.assignee).toBe('inv-1');
    expect(updated.additionalInvestigators).toEqual(['inv-2']);
  });

  it('syncs Case.implicatedUserIds when a linked subject is added, without duplicating it', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'creator');
    const admin = user({ roleId: 'functional_admin' });

    await repo.addPerson(kase.caseId, { kind: 'subject', name: 'A', linkedUserId: 'u-42' }, admin);
    await repo.addPerson(kase.caseId, { kind: 'witness', name: 'B', linkedUserId: 'u-43' }, admin);
    await repo.addPerson(kase.caseId, { kind: 'subject', name: 'A bis', linkedUserId: 'u-42' }, admin);

    const reloaded = await repo.getCase(kase.caseId, admin);
    expect(reloaded?.implicatedUserIds).toEqual(['u-42']); // witness never counted, no duplicate
  });
});

describe('LocalCaseRepository — recordRiskAssessment', () => {
  it('keeps only one active risk assessment per case and updates the case score/priority', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'creator');
    const admin = user({ roleId: 'functional_admin' });

    await repo.recordRiskAssessment(kase.caseId, { financialImpact: 1, hierarchicalLevel: 1, recurrence: 1, reputationRisk: 1, totalScore: 4, priority: 'low', isOverride: false }, admin);
    await repo.recordRiskAssessment(kase.caseId, { financialImpact: 4, hierarchicalLevel: 4, recurrence: 4, reputationRisk: 4, totalScore: 16, priority: 'critical', isOverride: true, originalScore: 4, overrideReason: 'Nouvelle information.' }, admin);

    const active = await repo.getActiveRiskAssessment(kase.caseId);
    expect(active?.totalScore).toBe(16);
    expect(active?.isOverride).toBe(true);

    const reloaded = await repo.getCase(kase.caseId, admin);
    expect(reloaded?.riskScore).toBe(16);
    expect(reloaded?.priority).toBe('critical');
  });
});

describe('LocalCaseRepository — reporter credentials & identity', () => {
  it('round-trips reporter credentials through a verify callback', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'creator');
    await repo.setReporterCredentials(kase.caseId, { caseId: kase.caseId, accessCodeHash: 'h', accessCodeSalt: 's' });

    const ok = await repo.verifyReporterCredentials(kase.caseId, async (salt, hash) => salt === 's' && hash === 'h');
    expect(ok).toBe(true);

    const wrong = await repo.verifyReporterCredentials(kase.caseId, async () => false);
    expect(wrong).toBe(false);

    const missing = await repo.verifyReporterCredentials('other-case', async () => true);
    expect(missing).toBe(false);
  });

  it('audits every access to the reporter identity (section 44 of the brief)', async () => {
    const repo = new LocalCaseRepository();
    const kase = await repo.createCase(caseInput(), 'creator');
    await repo.setReporterIdentity(kase.caseId, { caseId: kase.caseId, isAnonymous: false, fullName: 'Jeanne Doe' });

    const admin = user({ roleId: 'functional_admin' });
    const identity = await repo.getReporterIdentity(kase.caseId, admin);
    expect(identity?.fullName).toBe('Jeanne Doe');

    const events = await repo.listAuditEvents(kase.caseId);
    expect(events.some((e) => e.action === 'REPORTER_IDENTITY_ACCESSED')).toBe(true);
  });
});
