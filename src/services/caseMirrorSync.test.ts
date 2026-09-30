/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 14) ===
 * Tests avec mocks — aucun appel réseau réel. Même convention que
 * statusMirrorSync.test.ts/assignmentMirrorSync.test.ts.
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

import {
  HIERARCHY_ROLE_TO_LEVEL,
  LOCAL_PRIORITY_TO_CASE_PRIORITY,
  TASK_PRIORITY_TO_CASE_PRIORITY,
  mirrorAddCommunication,
  mirrorAddCorrectiveAction,
  mirrorAddInterview,
  mirrorAddInvestigationNote,
  mirrorAddPerson,
  mirrorAddTask,
  mirrorDeclareConflict,
  mirrorRecordRiskAssessment,
} from './caseMirrorSync';

beforeEach(() => {
  mockIsPhase4Configured.mockReset();
  mockGetPhase4Functions.mockReset();
  mockHttpsCallable.mockReset();
});

function mockSuccess(data: unknown) {
  mockIsPhase4Configured.mockReturnValue(true);
  mockGetPhase4Functions.mockResolvedValue({});
  const callableFn = vi.fn().mockResolvedValue({ data });
  mockHttpsCallable.mockReturnValue(callableFn);
  return callableFn;
}

describe('caseMirrorSync — no-op si Firebase Phase 4 non configuré', () => {
  it.each([
    ['mirrorAddTask', () => mirrorAddTask({ caseId: 'c', title: 't', owner: 'o', priority: 'low', dueDate: '2026-01-01' })],
    ['mirrorAddInterview', () => mirrorAddInterview({ caseId: 'c', intervieweeLabel: 'l' })],
    ['mirrorDeclareConflict', () => mirrorDeclareConflict({ caseId: 'c', outcome: 'no_conflict' })],
    ['mirrorAddInvestigationNote', () => mirrorAddInvestigationNote({ caseId: 'c', content: 'x' })],
    ['mirrorAddCommunication', () => mirrorAddCommunication({ caseId: 'c', content: 'x' })],
    ['mirrorAddCorrectiveAction', () => mirrorAddCorrectiveAction({ caseId: 'c', description: 'd', owner: 'o', dueDate: '2026-01-01', priority: 'low' })],
    ['mirrorRecordRiskAssessment', () => mirrorRecordRiskAssessment({ caseId: 'c', financialImpact: 1, hierarchicalLevel: 1, recurrence: 1, reputationRisk: 1, totalScore: 4, priority: 'low', isOverride: false })],
    ['mirrorAddPerson', () => mirrorAddPerson({ caseId: 'c', kind: 'subject', name: 'n' })],
  ] as const)('%s renvoie false sans appeler getPhase4Functions', async (_name, fn) => {
    mockIsPhase4Configured.mockReturnValue(false);
    await expect(fn()).resolves.toBe(false);
    expect(mockGetPhase4Functions).not.toHaveBeenCalled();
  });
});

describe('caseMirrorSync — appelle la bonne Cloud Function et renvoie true en cas de succès', () => {
  it('mirrorAddTask → addTask', async () => {
    const callableFn = mockSuccess({ taskId: 't1' });
    const result = await mirrorAddTask({ caseId: 'c', title: 't', owner: 'o', priority: 'low', dueDate: '2026-01-01' });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'addTask');
    expect(callableFn).toHaveBeenCalled();
  });

  it('mirrorAddInterview → addInterview', async () => {
    mockSuccess({ interviewId: 'i1' });
    const result = await mirrorAddInterview({ caseId: 'c', intervieweeLabel: 'l' });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'addInterview');
  });

  it('mirrorDeclareConflict → declareConflictOfInterest', async () => {
    mockSuccess({ ok: true });
    const result = await mirrorDeclareConflict({ caseId: 'c', outcome: 'conflict_identified', details: 'x' });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'declareConflictOfInterest');
  });

  it('mirrorAddInvestigationNote → addInvestigationNote', async () => {
    mockSuccess({ noteId: 'n1' });
    const result = await mirrorAddInvestigationNote({ caseId: 'c', content: 'x' });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'addInvestigationNote');
  });

  it('mirrorAddCommunication → addCommunication', async () => {
    mockSuccess({ messageId: 'm1' });
    const result = await mirrorAddCommunication({ caseId: 'c', content: 'x' });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'addCommunication');
  });

  it('mirrorAddCorrectiveAction → addCorrectiveAction', async () => {
    mockSuccess({ actionId: 'a1' });
    const result = await mirrorAddCorrectiveAction({ caseId: 'c', description: 'd', owner: 'o', dueDate: '2026-01-01', priority: 'high' });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'addCorrectiveAction');
  });

  it('mirrorRecordRiskAssessment → recordRiskAssessment', async () => {
    mockSuccess({ assessmentId: 'r1' });
    const result = await mirrorRecordRiskAssessment({
      caseId: 'c', financialImpact: 2, hierarchicalLevel: 2, recurrence: 1, reputationRisk: 2, totalScore: 8, priority: 'high', isOverride: true, originalScore: 8, overrideReason: 'test',
    });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'recordRiskAssessment');
  });

  it('mirrorAddPerson → addPerson', async () => {
    mockSuccess({ personId: 'p1' });
    const result = await mirrorAddPerson({ caseId: 'c', kind: 'witness', name: 'n', position: 'p' });
    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'addPerson');
  });
});

describe('caseMirrorSync — ne rejette jamais si l\'appel échoue', () => {
  it('renvoie false sans rejeter (réseau)', async () => {
    mockIsPhase4Configured.mockReturnValue(true);
    mockGetPhase4Functions.mockResolvedValue({});
    mockHttpsCallable.mockReturnValue(vi.fn().mockRejectedValue(new Error('network down')));
    await expect(mirrorAddTask({ caseId: 'c', title: 't', owner: 'o', priority: 'low', dueDate: '2026-01-01' })).resolves.toBe(false);
  });
});

describe('tables de correspondance — réutilisent data-access/migrateLegacy.ts telles quelles', () => {
  it('LOCAL_PRIORITY_TO_CASE_PRIORITY', () => {
    expect(LOCAL_PRIORITY_TO_CASE_PRIORITY).toEqual({ faible: 'low', elevee: 'high', tres_elevee: 'very_high', critique: 'critical' });
  });

  it('TASK_PRIORITY_TO_CASE_PRIORITY', () => {
    expect(TASK_PRIORITY_TO_CASE_PRIORITY).toEqual({ low: 'low', medium: 'high', high: 'very_high' });
  });

  it('HIERARCHY_ROLE_TO_LEVEL', () => {
    expect(HIERARCHY_ROLE_TO_LEVEL).toEqual({
      'Employé': 'employee',
      'Cadre': 'manager',
      'Sous-Directeur': 'senior_manager',
      'Directeur+': 'director_plus',
    });
  });
});
