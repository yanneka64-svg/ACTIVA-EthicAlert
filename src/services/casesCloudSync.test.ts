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
}));

vi.mock('firebase/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/functions')>();
  return { ...actual, httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args) };
});

import { mirrorSubmissionToRealBackend } from './casesCloudSync';

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
