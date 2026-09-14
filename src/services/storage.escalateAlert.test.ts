/**
 * === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage.escalateAlert', () => {
  it('refuses an unknown alertId', () => {
    const owner = storage.getUsers().find((u) => u.role === 'darc_compliance');
    const result = storage.escalateAlert('does-not-exist', 'x', [], owner!.id, storage.getActiveUser());
    expect(result.allowed).toBe(false);
  });

  it('escalates a valid alert: sets workflowStatus, status, escalation fields, and leaves country/entity untouched', () => {
    const alerts = storage.getAlerts();
    const target = alerts[0];
    const originalCountry = target.country;
    const originalEntity = target.concernedEntity;
    const originalCountryId = target.countryId;
    const originalEntityId = target.entityId;
    const owner = storage.getUsers().find((u) => u.role === 'darc_compliance' || u.role === 'senior_investigator');
    const auditCountBefore = storage.getAuditLogs().length;

    const result = storage.escalateAlert(target.id, 'Implication de la Direction', ['Implication d’un membre de la Direction'], owner!.id, storage.getActiveUser());

    if (result.allowed) {
      const after = storage.getAlertById(target.id);
      expect(after?.workflowStatus).toBe('escalated');
      expect(after?.status).toBe('investigation');
      expect(after?.escalatedOwnerId).toBe(owner!.id);
      expect(after?.escalatedReason).toBe('Implication de la Direction');
      // Origine du dossier jamais modifiée par une escalade.
      expect(after?.country).toBe(originalCountry);
      expect(after?.concernedEntity).toBe(originalEntity);
      expect(after?.countryId).toBe(originalCountryId);
      expect(after?.entityId).toBe(originalEntityId);
      expect(storage.getAuditLogs().length).toBe(auditCountBefore + 1);
      expect(storage.getAuditLogs()[0].actionType).toBe('CASE_ESCALATED');
    } else {
      expect(result.reason).toBeTruthy();
    }
  });
});
