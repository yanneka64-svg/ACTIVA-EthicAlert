/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 10) ===
 * Tests avec mocks — aucun appel réseau réel. Même convention que
 * casesCloudSync.test.ts.
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

import { mirrorStatusChangeToRealBackend } from './statusMirrorSync';

const input = { caseId: 'case-1', to: 'investigation' as const, reason: 'Test' };

beforeEach(() => {
  mockIsPhase4Configured.mockReset();
  mockGetPhase4Functions.mockReset();
  mockHttpsCallable.mockReset();
});

describe('mirrorStatusChangeToRealBackend', () => {
  it('ne fait rien (no-op silencieux) si Firebase Phase 4 n\'est pas configuré', async () => {
    mockIsPhase4Configured.mockReturnValue(false);

    const result = await mirrorStatusChangeToRealBackend(input);

    expect(result).toBe(false);
    expect(mockGetPhase4Functions).not.toHaveBeenCalled();
  });

  it('appelle changeCaseStatus et renvoie true en cas de succès', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockResolvedValue({ data: { ok: true, status: 'investigation' } });
    mockHttpsCallable.mockReturnValue(callableFn);

    const result = await mirrorStatusChangeToRealBackend(input);

    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'changeCaseStatus');
    expect(callableFn).toHaveBeenCalledWith(input);
  });

  it('renvoie false sans jamais rejeter si l\'appel réseau échoue', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockRejectedValue(new Error('network down'));
    mockHttpsCallable.mockReturnValue(callableFn);

    await expect(mirrorStatusChangeToRealBackend(input)).resolves.toBe(false);
  });

  it('renvoie false sans jamais rejeter si la transition est refusée côté serveur (failed-precondition)', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockRejectedValue(Object.assign(new Error('Invalid transition'), { code: 'functions/failed-precondition' }));
    mockHttpsCallable.mockReturnValue(callableFn);

    await expect(mirrorStatusChangeToRealBackend(input)).resolves.toBe(false);
  });
});
