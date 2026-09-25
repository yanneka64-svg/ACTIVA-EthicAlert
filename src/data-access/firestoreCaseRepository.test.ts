/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 3 :
 * FirestoreCaseRepository) ===
 *
 * Tests avec mocks (`firebase/functions`, `firebase/firestore`,
 * `services/firebaseClient`) — aucun appel réseau réel. Vérifie le
 * "plomberie" de ce fichier : quels arguments partent vers quelle Cloud
 * Function, comment une réponse minimale (`{xxxId}`/`{ok:true}`) devient un
 * objet complet via le second appel `getDoc`, et comment les erreurs
 * `FunctionsError` se traduisent dans le vocabulaire de `CaseRepository`
 * (`CaseAccessDeniedError`, etc.). La logique d'autorisation elle-même
 * (qui a le droit de faire quoi) est déjà testée ailleurs
 * (`domain/permissions.test.ts`) — pas reproduite ici.
 */
import { FunctionsError } from 'firebase/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppUser, Case } from '../domain/caseTypes';
import { CaseAccessDeniedError } from './caseRepository';
import { FirestoreCaseRepository, ListNotYetAvailableError, ServerOnlyOperationError } from './firestoreCaseRepository';

const mockHttpsCallable = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/functions')>();
  return { ...actual, httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args) };
});

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock('../services/firebaseClient', () => ({
  getPhase4Firebase: () => ({ app: {}, auth: {}, db: {} }),
  getPhase4Functions: () => Promise.resolve({}),
}));

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    userId: 'u-1',
    name: 'Test User',
    email: 't@example.com',
    roleId: 'investigator',
    countries: [],
    entities: [],
    active: true,
    mfaEnabled: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function fakeCase(overrides: Partial<Case> = {}): Case {
  return {
    caseId: 'case-1',
    caseNumber: 'CASE-2026-000001',
    status: 'new',
    category: 'Fraude',
    subcategory: '',
    country: 'Cameroun',
    entity: 'ACTIVA Assurances',
    reportingMode: 'anonymous',
    priority: 'low',
    riskScore: 0,
    confidentialityLevel: 'confidential',
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

/** `httpsCallable(functions, name)` renvoie une fonction callable — ce helper prépare celle que le prochain appel retournera. */
function mockCallableResolves(data: unknown) {
  mockHttpsCallable.mockReturnValueOnce(vi.fn().mockResolvedValue({ data }));
}

function mockCallableRejects(err: unknown) {
  mockHttpsCallable.mockReturnValueOnce(vi.fn().mockRejectedValue(err));
}

beforeEach(() => {
  mockHttpsCallable.mockReset();
  mockGetDoc.mockReset();
  mockDoc.mockReset();
});

describe('FirestoreCaseRepository — createCase', () => {
  it('appelle la Cloud Function createCase puis relit le dossier créé', async () => {
    mockCallableResolves({ caseId: 'case-1', caseNumber: 'CASE-2026-000001' });
    const kase = fakeCase();
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => kase });

    const repo = new FirestoreCaseRepository();
    const result = await repo.createCase(
      { status: 'new', category: 'Fraude', subcategory: '', country: 'Cameroun', entity: 'ACTIVA Assurances', reportingMode: 'anonymous', priority: 'low', riskScore: 0, confidentialityLevel: 'confidential', additionalInvestigators: [], implicatedUserIds: [], slaStatus: 'ok', receivedAt: '2026-01-01T00:00:00Z', incidentDateUnknown: true, description: 'Test', legalHold: false },
      'u-1'
    );

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'createCase');
    expect(result).toEqual(kase);
  });
});

describe('FirestoreCaseRepository — listCases', () => {
  it('passe le filtre/limit/offset et renvoie la Page telle quelle (pas de second appel)', async () => {
    const page = { items: [fakeCase()], total: 1, nextOffset: undefined };
    mockCallableResolves(page);

    const repo = new FirestoreCaseRepository();
    const result = await repo.listCases({ status: 'new' }, user(), 10, 0);

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'listCases');
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(result).toEqual(page);
  });
});

describe('FirestoreCaseRepository — changeCaseStatus', () => {
  it('renvoie result.allowed = true et le dossier à jour en cas de succès', async () => {
    mockCallableResolves({ ok: true, status: 'investigation' });
    const kase = fakeCase({ status: 'investigation' });
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => kase });

    const repo = new FirestoreCaseRepository();
    const result = await repo.changeCaseStatus('case-1', 'investigation', user());

    expect(result.result).toEqual({ allowed: true });
    expect(result.case).toEqual(kase);
  });

  it('traduit une erreur failed-precondition en result.allowed = false (jamais une exception), même comportement que LocalCaseRepository', async () => {
    mockCallableRejects(new FunctionsError('failed-precondition', 'Closure requires functional review sign-off.'));
    const kase = fakeCase();
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => kase });

    const repo = new FirestoreCaseRepository();
    const result = await repo.changeCaseStatus('case-1', 'closed', user());

    expect(result.result).toEqual({ allowed: false, reason: 'Closure requires functional review sign-off.' });
    expect(result.case).toEqual(kase);
  });
});

describe('FirestoreCaseRepository — traduction des erreurs', () => {
  it('traduit permission-denied en CaseAccessDeniedError', async () => {
    mockCallableRejects(new FunctionsError('permission-denied', 'Not authorized to assign this case.'));

    const repo = new FirestoreCaseRepository();
    await expect(repo.assignCase('case-1', 'inv-2', [], user())).rejects.toThrow(CaseAccessDeniedError);
  });

  it('laisse remonter une erreur non-FunctionsError telle quelle (ex. panne réseau)', async () => {
    mockHttpsCallable.mockReturnValueOnce(vi.fn().mockRejectedValue(new Error('network down')));

    const repo = new FirestoreCaseRepository();
    await expect(repo.assignCase('case-1', 'inv-2', [], user())).rejects.toThrow('network down');
  });
});

describe('FirestoreCaseRepository — getCase (lecture directe, sans Cloud Function)', () => {
  it("appelle getDoc directement, jamais httpsCallable", async () => {
    const kase = fakeCase();
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => kase });

    const repo = new FirestoreCaseRepository();
    const result = await repo.getCase('case-1', user());

    expect(mockHttpsCallable).not.toHaveBeenCalled();
    expect(result).toEqual(kase);
  });

  it('renvoie null pour un document inexistant', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const repo = new FirestoreCaseRepository();
    expect(await repo.getCase('case-x', user())).toBeNull();
  });
});

describe('FirestoreCaseRepository — identité jamais acceptée du client', () => {
  it('addCommunication ignore sender/senderDisplayName fournis par l\'appelant (jamais transmis à la Cloud Function)', async () => {
    mockCallableResolves({ messageId: 'msg-1' });
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ messageId: 'msg-1' }) });

    const repo = new FirestoreCaseRepository();
    await repo.addCommunication('case-1', 'reporter', 'Quelqu\'un d\'autre', 'Bonjour', 'u-1');

    const callableFn = mockHttpsCallable.mock.results[0].value;
    expect(callableFn).toHaveBeenCalledWith({ caseId: 'case-1', content: 'Bonjour' });
  });

  it('declareConflictOfInterest ignore le userId fourni par l\'appelant pour l\'appel serveur (toujours l\'identité du token vérifié)', async () => {
    mockCallableResolves({ ok: true });

    const repo = new FirestoreCaseRepository();
    await repo.declareConflictOfInterest('case-1', 'quelquun-dautre', 'no_conflict');

    const callableFn = mockHttpsCallable.mock.results[0].value;
    expect(callableFn).toHaveBeenCalledWith({ caseId: 'case-1', outcome: 'no_conflict', details: undefined });
  });
});

describe('FirestoreCaseRepository — non disponible depuis le client', () => {
  it('les listes de sous-collection lèvent ListNotYetAvailableError (aucune Cloud Function de liste)', async () => {
    const repo = new FirestoreCaseRepository();
    await expect(repo.listAllegations('case-1')).rejects.toThrow(ListNotYetAvailableError);
    await expect(repo.listPersons('case-1')).rejects.toThrow(ListNotYetAvailableError);
    await expect(repo.getTimeline('case-1')).rejects.toThrow(ListNotYetAvailableError);
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('les opérations réservées aux identifiants du déclarant lèvent ServerOnlyOperationError', async () => {
    const repo = new FirestoreCaseRepository();
    await expect(repo.setReporterCredentials('case-1', { caseId: 'case-1', accessCodeHash: 'h', accessCodeSalt: 's' })).rejects.toThrow(ServerOnlyOperationError);
    await expect(repo.setReporterIdentity('case-1', { caseId: 'case-1', isAnonymous: true })).rejects.toThrow(ServerOnlyOperationError);
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });
});
