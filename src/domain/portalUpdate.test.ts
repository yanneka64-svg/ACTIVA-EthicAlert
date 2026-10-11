/** === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) === */
import { describe, expect, it } from 'vitest';
import type { AlertRecord } from '../types';
import { applyPortalState, diffPortalUpdate, mergePortalPatches, PortalPatchError, portalConflicts, remainingAfterSend, sanitizePortalPatch } from './portalUpdate';

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
      // === AMÉLIORATION AJOUTÉE (modifications simultanées) === valeur connue avant la saisie.
      expected: { portal: { closureSummary: null } },
    });
  });

  it('ordre des enquêteurs indifférent ; effacement = null', () => {
    const a = { ...base, assignedInvestigators: ['x', 'y'], reopenReason: 'motif' } as AlertRecord;
    const b = { ...base, assignedInvestigators: ['y', 'x'] } as AlertRecord;
    expect(diffPortalUpdate(a, b)).toEqual({ portal: { reopenReason: null }, expected: { portal: { reopenReason: 'motif' } } });
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

// === AMÉLIORATION AJOUTÉE (modifications simultanées) ===
describe('portalConflicts', () => {
  it('aucun conflit si le serveur a toujours la valeur attendue', () => {
    expect(portalConflicts({ investigationReport: 'v1' }, { portal: { investigationReport: 'v1' } }, { investigationReport: 'v2' })).toEqual([]);
  });

  it('conflit si un collègue a modifié le champ entre-temps', () => {
    expect(portalConflicts({ investigationReport: 'collègue' }, { portal: { investigationReport: 'v1' } }, { investigationReport: 'moi' })).toEqual([
      'investigationReport',
    ]);
  });

  it('jamais de faux conflit : champ absent du serveur, ou même valeur déjà écrite (envoi rejoué)', () => {
    expect(portalConflicts({}, { portal: { investigationReport: 'local' } }, { investigationReport: 'moi' })).toEqual([]);
    expect(portalConflicts({ investigationReport: 'moi' }, { portal: { investigationReport: 'v1' } }, { investigationReport: 'moi' })).toEqual([]);
    expect(portalConflicts({ reopenReason: '' }, { portal: { reopenReason: null } })).toEqual([]);
  });

  it('listes comparées sans tenir compte de l’ordre ; statut jamais contrôlé', () => {
    expect(portalConflicts({ independentRoutingExcludedUserIds: ['b', 'a'] }, { portal: { independentRoutingExcludedUserIds: ['a', 'b'] } })).toEqual([]);
    expect(portalConflicts({ status: 'closed' }, { portal: { status: 'new' } as never })).toEqual([]);
  });
});

describe('expected : fusion et validation', () => {
  it('la valeur attendue la plus ancienne l’emporte', () => {
    const merged = mergePortalPatches(
      { portal: { closureSummary: 'v2' }, expected: { portal: { closureSummary: 'v1' } } },
      { portal: { closureSummary: 'v3' }, expected: { portal: { closureSummary: 'v2' } } }
    );
    expect(merged).toEqual({ portal: { closureSummary: 'v3' }, expected: { portal: { closureSummary: 'v1' } } });
  });

  it('sanitizePortalPatch accepte expected et refuse un champ inconnu ou un patch vide', () => {
    expect(sanitizePortalPatch({ portal: { closureSummary: 'x' }, expected: { portal: { closureSummary: null } } }).expected).toEqual({
      portal: { closureSummary: null },
    });
    expect(() => sanitizePortalPatch({ portal: { closureSummary: 'x' }, expected: { portal: { status: 'new' } } })).toThrow(PortalPatchError);
    expect(() => sanitizePortalPatch({ portal: { closureSummary: 'x' }, expected: { portal: { closureSummary: { a: 1 } } } })).toThrow(PortalPatchError);
    expect(() => sanitizePortalPatch({ expected: { portal: { closureSummary: 'x' } } })).toThrow(PortalPatchError);
  });
});

describe('remainingAfterSend', () => {
  it('rien ne reste si l’envoi n’a pas changé pendant le trajet', () => {
    const p = { portal: { closureSummary: 'a' } };
    expect(remainingAfterSend(p, p)).toBeNull();
  });

  it('garde la modification ajoutée pendant le trajet, avec la nouvelle valeur attendue', () => {
    const sent = { portal: { closureSummary: 'v2' }, expected: { portal: { closureSummary: 'v1' } } };
    const current = { portal: { closureSummary: 'v3', reopenReason: 'r' }, expected: { portal: { closureSummary: 'v1', reopenReason: null } } };
    expect(remainingAfterSend(sent, current)).toEqual({
      portal: { closureSummary: 'v3', reopenReason: 'r' },
      expected: { portal: { closureSummary: 'v2', reopenReason: null } },
    });
  });

  it('retire ce qui a déjà été écrit tel quel (tâches, rattachements, attribution)', () => {
    const sent = { assignedInvestigators: ['u1'], taskUpdates: [{ taskId: 't1', status: 'completed' as const }] };
    const current = { ...sent, personLinks: [{ personId: 'p1', linkedUserId: 'u2' }] };
    expect(remainingAfterSend(sent, current)).toEqual({ personLinks: [{ personId: 'p1', linkedUserId: 'u2' }] });
  });

  it('un champ en conflit garde sa valeur attendue d’origine', () => {
    const sent = { portal: { closureSummary: 'v2' }, expected: { portal: { closureSummary: 'v1' } } };
    const current = { portal: { closureSummary: 'v3' }, expected: { portal: { closureSummary: 'v1' } } };
    expect(remainingAfterSend(sent, current, ['closureSummary'])).toEqual(current);
  });
});
