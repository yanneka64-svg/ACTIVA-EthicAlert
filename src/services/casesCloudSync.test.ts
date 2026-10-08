/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4) ===
 * Tests avec mocks (firebase/functions, services/firebaseClient) — aucun
 * appel réseau réel. Même convention que firestoreCaseRepository.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsPhase4Configured = vi.fn();
const mockGetPhase4Functions = vi.fn();
const mockHttpsCallable = vi.fn();

vi.mock('./firebaseClient', () => ({
  isPhase4Configured: () => mockIsPhase4Configured(),
  getPhase4Functions: () => mockGetPhase4Functions(),
  // === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
  firebaseEmulatorHost: () => '',
  getPhase4Config: () => ({ projectId: 'demo-project' }),
  getPhase4Firebase: () => ({ app: {} }),
}));

vi.mock('firebase/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/functions')>();
  return { ...actual, httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args) };
});

import { mirrorSubmissionToRealBackend, postCallableDirect, submitReportToBackend } from './casesCloudSync';

const input = {
  category: 'Fraude',
  subcategory: 'Détournement',
  country: 'Cameroun',
  entity: 'ACTIVA Assurances',
  description: 'Test',
  reportingMode: 'anonymous' as const,
  confidentialityLevel: 'confidential' as const,
};

beforeEach(() => {
  mockIsPhase4Configured.mockReset();
  mockGetPhase4Functions.mockReset();
  mockHttpsCallable.mockReset();
});

describe('mirrorSubmissionToRealBackend', () => {
  it('ne fait rien (no-op silencieux) si Firebase Phase 4 n\'est pas configuré', async () => {
    mockIsPhase4Configured.mockReturnValue(false);

    const result = await mirrorSubmissionToRealBackend(input);

    expect(result).toBeNull();
    expect(mockGetPhase4Functions).not.toHaveBeenCalled();
  });

  it('appelle createCaseAsReporter et renvoie caseId/caseNumber en cas de succès', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockResolvedValue({ data: { caseId: 'case-1', caseNumber: 'CASE-2026-000001' } });
    mockHttpsCallable.mockReturnValue(callableFn);

    const result = await mirrorSubmissionToRealBackend(input);

    expect(result).toEqual({ caseId: 'case-1', caseNumber: 'CASE-2026-000001' });
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'createCaseAsReporter');
    expect(callableFn).toHaveBeenCalledWith(input);
  });

  it('renvoie null sans jamais rejeter si l\'appel réseau échoue', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockRejectedValue(new Error('network down'));
    mockHttpsCallable.mockReturnValue(callableFn);

    await expect(mirrorSubmissionToRealBackend(input)).resolves.toBeNull();
  });
});

// === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
describe('submitReportToBackend — seconds chemins d’envoi', () => {
  const FN_URL = 'https://us-central1-demo-project.cloudfunctions.net/createCaseAsReporter';
  const reject = (code: string) => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(Object.assign(new Error(code), { code })));
  };
  const jsonResponse = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  it('réessaie sans le SDK quand la requête n’a pas atteint le serveur', async () => {
    reject('functions/internal');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { result: { caseId: 'c1', caseNumber: 'CASE-2026-000009', trackingNumber: 'AACMR-26-10-0002' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await submitReportToBackend({ ...input, submissionId: 's1' });
    expect(res).toEqual({ ok: true, result: { caseId: 'c1', caseNumber: 'CASE-2026-000009', trackingNumber: 'AACMR-26-10-0002' } });
    expect(fetchMock).toHaveBeenCalledWith(FN_URL, expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).data.submissionId).toBe('s1');
    vi.unstubAllGlobals();
  });

  it('ne réessaie pas quand le serveur a répondu (limite atteinte)', async () => {
    reject('functions/resource-exhausted');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(submitReportToBackend(input)).resolves.toEqual({ ok: false, retryable: true });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('contenu refusé : jamais renvoyé', async () => {
    reject('functions/invalid-argument');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(submitReportToBackend(input)).resolves.toEqual({ ok: false, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('tous les chemins injoignables : mis en file d’attente', async () => {
    reject('functions/unavailable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(submitReportToBackend(input)).resolves.toEqual({ ok: false, retryable: true });
    vi.unstubAllGlobals();
  });

  it('postCallableDirect traduit la réponse d’erreur du serveur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, { error: { status: 'INVALID_ARGUMENT', message: 'x' } })));
    await expect(postCallableDirect('/api/report', {}, 1000)).resolves.toEqual({ ok: false, retryable: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => { throw new Error('html'); } }));
    await expect(postCallableDirect('/api/report', {}, 1000)).resolves.toBe('unreachable');
    vi.unstubAllGlobals();
  });
});
