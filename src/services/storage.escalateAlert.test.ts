/**
 * === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage.escalateAlert', () => {
  it('refuses an unknown alertId', () => {
    const recipient = storage.getEscalationRecipients()[0];
    const result = storage.escalateAlert('does-not-exist', 'x', [], recipient!.id, storage.getActiveUser());
    expect(result.allowed).toBe(false);
  });

  it('refuses an unknown recipientId', () => {
    const target = storage.getAlerts()[0];
    const result = storage.escalateAlert(target.id, 'x', [], 'not-a-real-recipient', storage.getActiveUser());
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === recipientId référence désormais EscalationRecipient.id
  // (registre), plus un UserProfile.id — et l'escalade vers un
  // destinataire lié à un compte doit réellement lui donner accès au
  // dossier (BUG PRÉEXISTANT CORRIGÉ : assignedInvestigators n'était
  // jamais mis à jour avant ce correctif).
  it('escalates a valid alert: sets workflowStatus, status, escalation fields, grants access to a linked recipient, and leaves country/entity untouched', () => {
    const alerts = storage.getAlerts();
    const target = alerts[0];
    const originalCountry = target.country;
    const originalEntity = target.concernedEntity;
    const originalCountryId = target.countryId;
    const originalEntityId = target.entityId;
    const recipient = storage.getEscalationRecipients().find((r) => r.active && !!r.linkedUserId)!;
    const auditCountBefore = storage.getAuditLogs().length;

    const result = storage.escalateAlert(target.id, 'Implication de la Direction', ['Implication d’un membre de la Direction'], recipient.id, storage.getActiveUser());

    expect(result.allowed).toBe(true);
    expect(result.recipient?.id).toBe(recipient.id);
    const after = storage.getAlertById(target.id);
    expect(after?.workflowStatus).toBe('escalated');
    expect(after?.status).toBe('investigation');
    expect(after?.escalatedOwnerId).toBe(recipient.linkedUserId);
    expect(after?.escalatedRecipientId).toBe(recipient.id);
    expect(after?.assignedInvestigators).toContain(recipient.linkedUserId);
    expect(after?.escalatedReason).toBe('Implication de la Direction');
    // Origine du dossier jamais modifiée par une escalade.
    expect(after?.country).toBe(originalCountry);
    expect(after?.concernedEntity).toBe(originalEntity);
    expect(after?.countryId).toBe(originalCountryId);
    expect(after?.entityId).toBe(originalEntityId);
    expect(storage.getAuditLogs().length).toBe(auditCountBefore + 1);
    expect(storage.getAuditLogs()[0].actionType).toBe('CASE_ESCALATED');
  });

  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage — correctif confidentialité) === BUG PRÉEXISTANT CORRIGÉ : un
  // compte lié dont le plafond de confidentialité ne couvre pas le
  // dossier obtenait quand même une entrée dans assignedInvestigators —
  // un accès qui n'en était pas un (useVisibleAlerts le filtre quand
  // même). Doit désormais se comporter exactement comme un destinataire
  // sans compte : e-mail uniquement, aucun accès in-app fictif.
  it('escalates to a linked recipient whose clearance does not cover the case: no access granted, email-only', () => {
    const base = storage.getAlerts().find((a) => a.trackingNumber === 'AACMR-26-09-0001')!; // highly_confidential
    const target = { ...base, id: 'test-alt-insufficient-clearance', status: 'investigation' as const, workflowStatus: undefined, assignedInvestigators: [] as string[], assignedInvestigatorNames: [] as string[] };
    storage.saveAlert(target);

    const investigatorUser = storage.getUsers().find((u) => u.role === 'investigator')!; // plafond 'confidential', insuffisant pour highly_confidential
    const recipientId = 'test-rec-insufficient-clearance';
    storage.addEscalationRecipient(
      { id: recipientId, identifiant: 'TEST-001', nom: investigatorUser.name, email: investigatorUser.email, fonction: 'Test', grade: 2, linkedUserId: investigatorUser.id, active: true },
      storage.getActiveUser()
    );

    const result = storage.escalateAlert(target.id, 'Motif test', [], recipientId, storage.getActiveUser());

    expect(result.allowed).toBe(true);
    const after = storage.getAlertById(target.id);
    expect(after?.escalatedOwnerId).toBeUndefined();
    expect(after?.escalatedRecipientId).toBe(recipientId);
    expect(after?.assignedInvestigators).toEqual([]);
  });

  it('escalates to an unlinked recipient without granting fictitious in-app access', () => {
    // Clone a real seed alert into a fresh, isolated 'investigation'-status
    // one (own id) — 'escalated' is only structurally valid FROM
    // 'investigation' (domain/workflow.ts ALLOWED_TRANSITIONS), and the
    // other test above already moved alerts[0] past that state.
    const base = storage.getAlerts()[0];
    const target = { ...base, id: 'test-alt-unlinked-escalation', status: 'investigation' as const, workflowStatus: undefined, assignedInvestigators: [] as string[], assignedInvestigatorNames: [] as string[] };
    storage.saveAlert(target);
    const recipient = storage.getEscalationRecipients().find((r) => r.active && !r.linkedUserId)!;

    const result = storage.escalateAlert(target.id, 'Motif RH', [], recipient.id, storage.getActiveUser());

    expect(result.allowed).toBe(true);
    const after = storage.getAlertById(target.id);
    expect(after?.escalatedOwnerId).toBeUndefined();
    expect(after?.escalatedRecipientId).toBe(recipient.id);
    expect(after?.assignedInvestigators).toEqual([]);
  });
});
