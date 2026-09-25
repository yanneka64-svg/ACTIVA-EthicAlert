/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 5) ===
 * Tests avec mocks — aucun appel réseau réel. Même convention que
 * casesCloudSync.test.ts / firestoreCaseRepository.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsPhase4Configured = vi.fn();
const mockListCases = vi.fn();

vi.mock('./firebaseClient', () => ({
  isPhase4Configured: () => mockIsPhase4Configured(),
}));

vi.mock('../data-access/firestoreCaseRepository', () => ({
  FirestoreCaseRepository: class {
    listCases(...args: unknown[]) {
      return mockListCases(...args);
    }
  },
}));

import { fetchMirroredCasesForControlPanel } from './controlPanelCloudSync';

beforeEach(() => {
  mockIsPhase4Configured.mockReset();
  mockListCases.mockReset();
});

describe('fetchMirroredCasesForControlPanel', () => {
  it('renvoie [] sans appeler listCases si Firebase Phase 4 n\'est pas configuré', async () => {
    mockIsPhase4Configured.mockReturnValue(false);

    const result = await fetchMirroredCasesForControlPanel();

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

    const result = await fetchMirroredCasesForControlPanel();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('case-case-1');
    expect(result[0].trackingNumber).toBe('CASE-2026-000001');
  });

  it('renvoie [] sans jamais rejeter si listCases échoue (ex. unauthenticated tant que le personnel n\'est pas réellement connecté)', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockListCases.mockRejectedValue(new Error('unauthenticated'));

    await expect(fetchMirroredCasesForControlPanel()).resolves.toEqual([]);
  });
});
