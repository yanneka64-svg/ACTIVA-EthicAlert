/** === AMÉLIORATION AJOUTÉE (file d'envoi : aucune modification perdue) === */
import { describe, expect, it } from 'vitest';
import { enqueuePortalPatch, settleOutboxEntry } from './portalSync';

describe('file d’envoi du portail', () => {
  it('un envoi réussi sans modification pendant le trajet est retiré', () => {
    const q = enqueuePortalPatch([], 'c1', { portal: { closureSummary: 'a' } }, '2026-10-11T10:00:00.000Z');
    expect(settleOutboxEntry(q, q[0])).toEqual([]);
  });

  it('une modification ajoutée PENDANT l’envoi n’est plus perdue', () => {
    const q1 = enqueuePortalPatch([], 'c1', { portal: { closureSummary: 'a' }, expected: { portal: { closureSummary: null } } }, '2026-10-11T10:00:00.000Z');
    const sent = q1[0];
    // Pendant l'appel au serveur, la personne continue de travailler :
    const q2 = enqueuePortalPatch(q1, 'c1', { portal: { closureSummary: 'ab' }, expected: { portal: { closureSummary: 'a' } } });
    const after = settleOutboxEntry(q2, sent);
    expect(after).toHaveLength(1);
    expect(after[0].patch).toEqual({ portal: { closureSummary: 'ab' }, expected: { portal: { closureSummary: 'a' } } });
    expect(after[0].attempts).toBe(0);
  });

  it('les envois des autres dossiers ne sont pas touchés', () => {
    let q = enqueuePortalPatch([], 'c1', { assignedInvestigators: ['u1'] }, '2026-10-11T10:00:00.000Z');
    q = enqueuePortalPatch(q, 'c2', { assignedInvestigators: ['u2'] }, '2026-10-11T10:00:01.000Z');
    expect(settleOutboxEntry(q, q[0]).map((e) => e.caseId)).toEqual(['c2']);
  });
});
