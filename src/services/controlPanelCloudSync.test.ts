/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5) ===
 * Tests avec mocks — aucun appel réseau réel. Même convention que
 * casesCloudSync.test.ts / firestoreCaseRepository.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsPhase4Configured = vi.fn();
const mockListCases = vi.fn();
// === AMÉLIORATION AJOUTÉE (revue PR #139) === session Firebase Auth simulée.
const mockAuth: { currentUser: { email: string } | null; authStateReady: () => Promise<void> } = {
  currentUser: { email: 'Operateur@Group-Activa.com' },
  authStateReady: () => Promise.resolve(),
};

vi.mock('./firebaseClient', () => ({
  isPhase4Configured: () => mockIsPhase4Configured(),
  getPhase4Firebase: () => ({ auth: mockAuth }),
}));

vi.mock('../data-access/firestoreCaseRepository', () => ({
  FirestoreCaseRepository: class {
    listCases(...args: unknown[]) {
      return mockListCases(...args);
    }
  },
}));

import { fetchMirroredCasesForControlPanel, mergeMirroredCases } from './controlPanelCloudSync';
import type { AlertRecord } from '../types';

const EMAIL = 'operateur@group-activa.com';

beforeEach(() => {
  mockIsPhase4Configured.mockReset();
  mockListCases.mockReset();
  mockAuth.currentUser = { email: 'Operateur@Group-Activa.com' };
});

describe('fetchMirroredCasesForControlPanel', () => {
  it('renvoie [] sans appeler listCases si Firebase Phase 4 n\'est pas configuré', async () => {
    mockIsPhase4Configured.mockReturnValue(false);

    const result = await fetchMirroredCasesForControlPanel(EMAIL);

    expect(result).toEqual([]);
    expect(mockListCases).not.toHaveBeenCalled();
  });

  it('convertit chaque Case reçu en résumé AlertRecord', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockListCases.mockResolvedValue({
      items: [
        {
          caseId: 'case-1',
          caseNumber: 'CASE-2026-000001',
          status: 'new',
          category: 'Fraude',
          subcategory: '',
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
          updatedAt: '2026-01-01T00:00:00Z',
          updatedBy: 'system',
        },
      ],
      total: 1,
    });

    const result = await fetchMirroredCasesForControlPanel(EMAIL);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('case-case-1');
    expect(result[0].trackingNumber).toBe('CASE-2026-000001');
  });

  it('renvoie [] sans jamais rejeter si listCases échoue (ex. unauthenticated tant que le personnel n\'est pas réellement connecté)', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockListCases.mockRejectedValue(new Error('unauthenticated'));

    await expect(fetchMirroredCasesForControlPanel(EMAIL)).resolves.toEqual([]);
  });
});

// === AMÉLIORATION AJOUTÉE (revue PR #139) ===
const kase = (caseId: string) => ({
  caseId, caseNumber: `CASE-${caseId}`, status: 'new', category: 'Fraude', subcategory: '', country: 'Cameroun', entity: 'ACTIVA Assurances',
  reportingMode: 'anonymous', priority: 'low', riskScore: 1, confidentialityLevel: 'restricted', additionalInvestigators: [], implicatedUserIds: [],
  slaStatus: 'ok', receivedAt: '2026-01-01T00:00:00Z', incidentDateUnknown: true, description: 'x', legalHold: false,
  createdAt: '2026-01-01T00:00:00Z', createdBy: 's', updatedAt: '2026-01-01T00:00:00Z', updatedBy: 's',
});

describe('fetchMirroredCasesForControlPanel — liaison au compte local', () => {
  it("ne renvoie rien sans compte local, ou si la session Firebase appartient à un autre compte", async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockListCases.mockResolvedValue({ items: [kase('a')], total: 1 });
    await expect(fetchMirroredCasesForControlPanel()).resolves.toEqual([]);
    mockAuth.currentUser = { email: 'autre.compte@group-activa.com' };
    await expect(fetchMirroredCasesForControlPanel(EMAIL)).resolves.toEqual([]);
    mockAuth.currentUser = null;
    await expect(fetchMirroredCasesForControlPanel(EMAIL)).resolves.toEqual([]);
    expect(mockListCases).not.toHaveBeenCalled();
  });

  it("ignore la réponse si la session change pendant l'appel", async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockListCases.mockImplementation(async () => {
      mockAuth.currentUser = { email: 'autre.compte@group-activa.com' };
      return { items: [kase('a')], total: 1 };
    });
    await expect(fetchMirroredCasesForControlPanel(EMAIL)).resolves.toEqual([]);
  });

  it('parcourt toutes les pages (nextOffset), pas seulement les 100 premiers dossiers', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockListCases
      .mockResolvedValueOnce({ items: [kase('a')], total: 3, nextOffset: 100 })
      .mockResolvedValueOnce({ items: [kase('b')], total: 3, nextOffset: 200 })
      .mockResolvedValueOnce({ items: [kase('c')], total: 3 });
    const result = await fetchMirroredCasesForControlPanel(EMAIL);
    expect(result.map((r) => r.id)).toEqual(['case-a', 'case-b', 'case-c']);
    expect(mockListCases.mock.calls.map((c) => c[3])).toEqual([0, 100, 200]);
  });
});

describe('mergeMirroredCases', () => {
  it('écarte le résumé backend d\'un dossier déjà présent localement (mirroredCaseId), garde les autres', () => {
    const local = [{ id: 'alt-1', mirroredCaseId: 'a' }, { id: 'alt-2' }] as unknown as AlertRecord[];
    const mirrored = [{ id: 'case-a' }, { id: 'case-b' }] as unknown as AlertRecord[];
    expect(mergeMirroredCases(local, mirrored).map((r) => r.id)).toEqual(['alt-1', 'alt-2', 'case-b']);
  });
});
