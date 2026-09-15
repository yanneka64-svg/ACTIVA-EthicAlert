/**
 * === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
 * Intégration contre le singleton `storage` réel, même convention que
 * storage.escalateAlert.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage.triggerIndependentRouting', () => {
  it('is a no-op when nobody on the alert is linked to a real account', () => {
    const target = storage.getAlerts().find((a) => a.trackingNumber === 'ACT-2026-0210')!;
    const auditCountBefore = storage.getAuditLogs().length;
    const updatedAtBefore = target.updatedAt;

    storage.triggerIndependentRouting(target.id, storage.getActiveUser());

    const after = storage.getAlertById(target.id);
    expect(after?.updatedAt).toBe(updatedAtBefore);
    expect(storage.getAuditLogs().length).toBe(auditCountBefore);
  });

  it('excludes the accused, removes them from assignedInvestigators, and routes to a Group-scoped senior authority', () => {
    const target = storage.getAlerts().find((a) => a.trackingNumber === 'ACT-2026-0391')!;
    const accusedId = target.assignedInvestigators[0]; // usr-investigator-1 (Alain Kouassi), locally-scoped to Côte d'Ivoire
    expect(accusedId).toBeTruthy();

    // Recognize the involved person as the very investigator already assigned to the case.
    storage.saveAlert({
      ...target,
      involvedPersons: target.involvedPersons.map((p, i) => (i === 0 ? { ...p, linkedUserId: accusedId } : p)),
    });

    const auditCountBefore = storage.getAuditLogs().length;
    storage.triggerIndependentRouting(target.id, storage.getActiveUser());

    const after = storage.getAlertById(target.id);
    expect(after?.independentRoutingExcludedUserIds).toContain(accusedId);
    expect(after?.assignedInvestigators).not.toContain(accusedId);
    // No local senior_investigator/functional_admin/darc_compliance is scoped
    // to Côte d'Ivoire in the seed data — falls back to a Group authority.
    expect(after?.independentRoutingUnresolved).toBe(false);
    expect(after?.escalatedOwnerId).toBeTruthy();
    expect(after?.assignedInvestigators).toContain(after?.escalatedOwnerId);

    const newAuditEntries = storage.getAuditLogs().slice(0, storage.getAuditLogs().length - auditCountBefore);
    expect(newAuditEntries.map((e) => e.actionType)).toEqual(['INVESTIGATOR_ASSIGNED', 'INDEPENDENT_ROUTING_TRIGGERED']);
  });

  it('marks the case as unresolved when the implicated account is the highest operational role (darc_compliance), and notifies the highest-grade active escalation recipient as a last resort', () => {
    const target = storage.getAlerts().find((a) => a.trackingNumber === 'ACT-2026-0418')!;
    const darcUser = storage.getUsers().find((u) => u.role === 'darc_compliance')!;

    storage.saveAlert({
      ...target,
      involvedPersons: [...target.involvedPersons, { id: 'per-test-darc', name: 'x', position: 'x', hierarchyRole: 'Directeur+', linkedUserId: darcUser.id }],
    });

    const fallbackRecipient = storage.triggerIndependentRouting(target.id, storage.getActiveUser());

    const after = storage.getAlertById(target.id);
    expect(after?.independentRoutingExcludedUserIds).toContain(darcUser.id);
    expect(after?.independentRoutingUnresolved).toBe(true);
    expect(storage.getAuditLogs()[0].actionType).toBe('NO_INDEPENDENT_AUTHORITY_FOUND');

    // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
    // routage) === Le destinataire actif du grade le plus élevé du
    // registre (seed : DGA Groupe, grade 5) est identifié et retourné pour
    // notification — jamais de silence total sur un cas non résolu.
    const expectedFallback = [...storage.getEscalationRecipients()].filter((r) => r.active).sort((a, b) => b.grade - a.grade)[0];
    expect(fallbackRecipient?.id).toBe(expectedFallback.id);
    expect(after?.independentRoutingFallbackRecipientId).toBe(expectedFallback.id);
    expect(after?.independentRoutingFallbackNotifiedAt).toBeTruthy();
  });
});
