/** === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) === */
import { describe, expect, it } from 'vitest';
import type { AlertRecord } from '../types';
import { applyPortalState, diffPortalUpdate, mergePortalPatches, PortalPatchError, sanitizePortalPatch } from './portalUpdate';

const base = {
  id: 'a1',
  status: 'new',
  workflowStatus: 'new',
  assignedInvestigators: [],
  assignedInvestigatorNames: [],
  involvedPersons: [{ id: 'p1', name: 'X', position: '', hierarchyRole: 'Employé' }],
  witnesses: [],
  tasks: [{ id: 't1', title: 'Collecter', owner: 'u1', dueDate: '2026-10-10', priority: 'medium', status: 'not_started', createdAt: '2026-10-01', createdBy: 'u1' }],
  messages: [],
  internalNotes: [],
} as unknown as AlertRecord;

describe('diffPortalUpdate', () => {
  it('rien à envoyer si rien de ce périmètre ne change', () => {
    expect(diffPortalUpdate(base, { ...base, messages: [{ id: 'm' }] as never })).toBeNull();
  });

  it('attribution, statut et clôture', () => {
    const next = {
      ...base,
      assignedInvestigators: ['uid-inv'],
      status: 'closed',
      workflowStatus: 'closed',
      closureSummary: 'Faits établis',
      closedAt: '2026-10-05T10:00:00.000Z',
    } as AlertRecord;
    expect(diffPortalUpdate(base, next)).toEqual({
      portal: { status: 'closed', workflowStatus: 'closed', closureSummary: 'Faits établis', closedAt: '2026-10-05T10:00:00.000Z' },
      assignedInvestigators: ['uid-inv'],
    });
  });

  it('ordre des enquêteurs indifférent ; effacement = null', () => {
    const a = { ...base, assignedInvestigators: ['x', 'y'], reopenReason: 'motif' } as AlertRecord;
    const b = { ...base, assignedInvestigators: ['y', 'x'] } as AlertRecord;
    expect(diffPortalUpdate(a, b)).toEqual({ portal: { reopenReason: null } });
  });

  it('avancement d’une tâche existante et rattachement d’une personne', () => {
    const next = {
      ...base,
      tasks: [{ ...base.tasks![0], status: 'completed', completedAt: '2026-10-05T11:00:00.000Z' }, { id: 't2' }],
      involvedPersons: [{ ...base.involvedPersons[0], linkedUserId: 'uid-x' }, { id: 'p2' }],
    } as unknown as AlertRecord;
    expect(diffPortalUpdate(base, next)).toEqual({
      taskUpdates: [{ taskId: 't1', status: 'completed', completedAt: '2026-10-05T11:00:00.000Z' }],
      personLinks: [{ personId: 'p1', linkedUserId: 'uid-x' }],
    });
  });
});

describe('mergePortalPatches', () => {
  it('le plus récent l’emporte, les tâches sont fusionnées', () => {
    expect(
      mergePortalPatches(
        { portal: { status: 'investigation' }, taskUpdates: [{ taskId: 't1', status: 'in_progress' }] },
        { portal: { status: 'closed' }, assignedInvestigators: ['u'], taskUpdates: [{ taskId: 't1', completedAt: 'x' }] }
      )
    ).toEqual({ portal: { status: 'closed' }, assignedInvestigators: ['u'], taskUpdates: [{ taskId: 't1', status: 'in_progress', completedAt: 'x' }] });
  });
});

describe('sanitizePortalPatch', () => {
  it('accepte un envoi valide', () => {
    const p = { portal: { status: 'closed', closureSummary: 'ok', closedAt: '2026-10-05T10:00:00.000Z', reopenReason: null }, assignedInvestigators: ['uid-1'] };
    expect(sanitizePortalPatch(p)).toEqual(p);
  });
  it.each([
    [{ portal: { status: 'bidon' } }],
    [{ portal: { inconnu: 'x' } }],
    [{ portal: { closedAt: 'hier' } }],
    [{ portal: { closureSummary: 'x'.repeat(20001) } }],
    [{ assignedInvestigators: ['<script>'] }],
    [{ taskUpdates: [{ taskId: 't1', status: 'fini' }] }],
    [{ personLinks: [{ personId: 'p1', linkedUserId: 3 }] }],
    [{}],
    [null],
  ])('refuse %j', (input) => {
    expect(() => sanitizePortalPatch(input)).toThrow(PortalPatchError);
  });
});

describe('applyPortalState', () => {
  it('le travail enregistré l’emporte sur la valeur déduite', () => {
    const r = applyPortalState({ status: 'new', closureSummary: undefined } as Record<string, unknown>, { status: 'closed', closureSummary: 'Synthèse' });
    expect(r).toMatchObject({ status: 'closed', closureSummary: 'Synthèse' });
    expect(applyPortalState({ status: 'new' }, undefined)).toEqual({ status: 'new' });
  });
});

import { portalVisibleCaseStatus } from './portalUpdate';
describe('portalVisibleCaseStatus', () => {
  it('statut du serveur sans travail du portail', () => {
    expect(portalVisibleCaseStatus('new', undefined)).toBe('new');
  });
  it('statut détaillé quand il concorde, sinon statut affiché', () => {
    expect(portalVisibleCaseStatus('new', { status: 'closed', workflowStatus: 'closed' })).toBe('closed');
    expect(portalVisibleCaseStatus('new', { status: 'investigation', workflowStatus: 'pending_information' })).toBe('pending_information');
    expect(portalVisibleCaseStatus('new', { status: 'investigation' })).toBe('investigation');
    expect(portalVisibleCaseStatus('new', { status: 'closed', workflowStatus: 'investigation' })).toBe('closed');
  });
});

import { reporterVisibleCaseStatus } from './portalUpdate';
describe('reporterVisibleCaseStatus', () => {
  it('en attente d’informations reste à l’étape Investigation pour le déclarant', () => {
    expect(reporterVisibleCaseStatus('new', { status: 'investigation', workflowStatus: 'pending_information' })).toBe('investigation');
    expect(reporterVisibleCaseStatus('new', { status: 'closed', workflowStatus: 'closed' })).toBe('closed');
    expect(reporterVisibleCaseStatus('under_review', undefined)).toBe('under_review');
  });
});
