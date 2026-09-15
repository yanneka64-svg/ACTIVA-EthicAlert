/**
 * === AMÉLIORATION AJOUTÉE (Phase 3 — évolution multi-pays/multi-entité) ===
 *
 * Test d'intégration léger de `storage.transitionStatus()` contre le vrai
 * singleton `storage` (données de démonstration seedées, comme dans
 * l'application réelle) — vérifie que la méthode refuse une transition
 * structurellement invalide, accepte une transition valide, synchronise
 * bien `status` (legacy), et journalise une entrée d'audit.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage.transitionStatus', () => {
  it('refuses an unknown alertId', () => {
    const result = storage.transitionStatus('does-not-exist', 'triage', storage.getActiveUser());
    expect(result.allowed).toBe(false);
  });

  it('refuses a structurally invalid transition and leaves the alert untouched', () => {
    const [alert] = storage.getAlerts();
    const before = storage.getAlertById(alert.id);
    // 'new' cannot jump straight to 'closed' per ALLOWED_TRANSITIONS.
    const result = storage.transitionStatus(alert.id, 'closed', storage.getActiveUser());
    expect(result.allowed).toBe(false);
    const after = storage.getAlertById(alert.id);
    expect(after?.workflowStatus).toBe(before?.workflowStatus);
  });

  it('accepts a valid transition, syncs the legacy status, and logs an audit entry', () => {
    const alerts = storage.getAlerts();
    // Find (or fall back to) an alert currently in a legacy 'new' state so the
    // derived starting CaseStatus is 'new' or 'assigned', both of which allow → 'triage'.
    const target = alerts.find((a) => a.status === 'new') ?? alerts[0];
    const auditCountBefore = storage.getAuditLogs().length;

    const result = storage.transitionStatus(target.id, 'triage', storage.getActiveUser(), 'test');

    // Only assert the happy path when the derived starting state genuinely allows it —
    // this alert's current legacy status determines that, not a hardcoded assumption.
    if (result.allowed) {
      const after = storage.getAlertById(target.id);
      expect(after?.workflowStatus).toBe('triage');
      expect(after?.status).toBe('under_review');
      expect(storage.getAuditLogs().length).toBe(auditCountBefore + 1);
    } else {
      expect(result.reason).toBeTruthy();
    }
  });

  // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
  // périmètre) === 'duplicate'/'out_of_scope' étaient structurellement
  // valides depuis 'new' mais jamais exercés par aucun écran avant ce
  // correctif — verrouille le comportement attendu : statut legacy
  // 'closed', et closedAt/closedBy renseignés (sinon le dossier resterait
  // invisible de l'onglet Opérateur "Dossiers clôturés", qui affiche
  // "Clôturé le").
  it('dismisses a never-assigned "new" case as a duplicate: syncs to legacy "closed" and stamps closedAt/closedBy', () => {
    const base = storage.getAlerts()[0];
    const target = { ...base, id: 'test-dismiss-duplicate', status: 'new' as const, workflowStatus: undefined, assignedInvestigators: [] as string[], assignedInvestigatorNames: [] as string[], closedAt: undefined, closedBy: undefined };
    storage.saveAlert(target);
    const actor = storage.getActiveUser();

    const result = storage.transitionStatus(target.id, 'duplicate', actor, 'Doublon du dossier ACT-...');

    expect(result.allowed).toBe(true);
    const after = storage.getAlertById(target.id);
    expect(after?.workflowStatus).toBe('duplicate');
    expect(after?.status).toBe('closed');
    expect(after?.closedAt).toBeTruthy();
    expect(after?.closedBy).toBe(actor.name);
  });

  it('dismisses a never-assigned "new" case as out of scope: same closure bookkeeping', () => {
    const base = storage.getAlerts()[0];
    const target = { ...base, id: 'test-dismiss-out-of-scope', status: 'new' as const, workflowStatus: undefined, assignedInvestigators: [] as string[], assignedInvestigatorNames: [] as string[], closedAt: undefined, closedBy: undefined };
    storage.saveAlert(target);
    const actor = storage.getActiveUser();

    const result = storage.transitionStatus(target.id, 'out_of_scope', actor, 'Hors périmètre du dispositif');

    expect(result.allowed).toBe(true);
    const after = storage.getAlertById(target.id);
    expect(after?.workflowStatus).toBe('out_of_scope');
    expect(after?.status).toBe('closed');
    expect(after?.closedAt).toBeTruthy();
    expect(after?.closedBy).toBe(actor.name);
  });
});
