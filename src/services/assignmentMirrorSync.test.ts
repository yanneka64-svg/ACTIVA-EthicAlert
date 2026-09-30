/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 12) ===
 * Tests avec mocks — aucun appel réseau réel. Même convention que
 * statusMirrorSync.test.ts.
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

import { mirrorAssignmentToRealBackend } from './assignmentMirrorSync';

const input = { caseId: 'case-1', assignee: 'uid-owner', additionalInvestigators: ['uid-other'] };

beforeEach(() => {
  mockIsPhase4Configured.mockReset();
  mockGetPhase4Functions.mockReset();
  mockHttpsCallable.mockReset();
});

describe('mirrorAssignmentToRealBackend', () => {
  it('ne fait rien (no-op silencieux) si Firebase Phase 4 n\'est pas configuré', async () => {
    mockIsPhase4Configured.mockReturnValue(false);

    const result = await mirrorAssignmentToRealBackend(input);

    expect(result).toBe(false);
    expect(mockGetPhase4Functions).not.toHaveBeenCalled();
  });

  it('appelle assignCase et renvoie true en cas de succès', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockResolvedValue({ data: { ok: true } });
    mockHttpsCallable.mockReturnValue(callableFn);

    const result = await mirrorAssignmentToRealBackend(input);

    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'assignCase');
    expect(callableFn).toHaveBeenCalledWith(input);
  });

  it('renvoie false sans jamais rejeter si l\'appel réseau échoue', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockRejectedValue(new Error('network down'));
    mockHttpsCallable.mockReturnValue(callableFn);

    await expect(mirrorAssignmentToRealBackend(input)).resolves.toBe(false);
  });

  it('renvoie false sans jamais rejeter si le serveur refuse (permission-denied)', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    const callableFn = vi.fn().mockRejectedValue(Object.assign(new Error('Not authorized'), { code: 'functions/permission-denied' }));
    mockHttpsCallable.mockReturnValue(callableFn);

    await expect(mirrorAssignmentToRealBackend(input)).resolves.toBe(false);
  });
});
