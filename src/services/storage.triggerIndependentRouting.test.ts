/**
 * === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
 * Intégration contre le singleton `storage` réel, même convention que
 * storage.escalateAlert.test.ts.
 *
 * === AMÉLIORATION AJOUTÉE : retrait des personas fictifs de démonstration ===
 * Les comptes fictifs (usr-investigator-1, usr-darc-compliance, etc.) qui
 * servaient de fixtures à ces tests ont été retirés de INITIAL_USERS (voir
 * activaConfig.ts) — chaque test crée désormais son propre compte de test
 * local via storage.addUser(), avec exactement le rôle/périmètre/
 * confidentialité nécessaire à son scénario, plutôt que de dépendre de
 * données de démonstration partagées.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage.triggerIndependentRouting', () => {
  it('is a no-op when nobody on the alert is linked to a real account', () => {
    const target = storage.getAlerts().find((a) => a.trackingNumber === 'AIIG-26-07-0001')!;
    const auditCountBefore = storage.getAuditLogs().length;
    const updatedAtBefore = target.updatedAt;

    storage.triggerIndependentRouting(target.id, storage.getActiveUser());

    const after = storage.getAlertById(target.id);
    expect(after?.updatedAt).toBe(updatedAtBefore);
    expect(storage.getAuditLogs().length).toBe(auditCountBefore);
  });

  it('excludes the accused, removes them from assignedInvestigators, and routes to a Group-scoped senior authority', () => {
    const actor = storage.getActiveUser();
    // Accusé : enquêteur à périmètre local Côte d'Ivoire (même périmètre que
    // le dossier AACIV-26-08-0001 : countryId 'CI', entityId 'ci_activa').
    const accusedId = 'test-accused-investigator-ci';
    storage.addUser(
      {
        id: accusedId,
        name: 'Enquêteur de test (CI)',
        email: 'test.accuse.ci@group-activa.com',
        username: 'test.accuse.ci',
        role: 'investigator',
        roleTitle: 'Enquêteur',
        entity: 'ACTIVA Côte d’Ivoire',
        country: 'Côte d’Ivoire',
        countries: ['CI'],
        entities: ['ci_activa'],
        active: true,
      },
      actor
    );
    // Autorité de repli Groupe : niveau strictement supérieur (senior_investigator),
    // périmètre vide (Groupe), habilitation suffisante pour 'confidential'.
    storage.addUser(
      {
        id: 'test-fallback-senior-investigator-group',
        name: 'Responsable des Investigations de test (Groupe)',
        email: 'test.fallback.senior@group-activa.com',
        username: 'test.fallback.senior',
        role: 'senior_investigator',
        roleTitle: 'Responsable des Investigations Groupe',
        entity: 'ACTIVA Finance',
        country: 'Groupe ACTIVA',
        countries: [],
        entities: [],
        active: true,
      },
      actor
    );

    const target = storage.getAlerts().find((a) => a.trackingNumber === 'AACIV-26-08-0001')!;

    // Recognize the involved person as the accused investigator above.
    storage.saveAlert({
      ...target,
      involvedPersons: target.involvedPersons.map((p, i) => (i === 0 ? { ...p, linkedUserId: accusedId } : p)),
    });

    const auditCountBefore = storage.getAuditLogs().length;
    storage.triggerIndependentRouting(target.id, storage.getActiveUser());

    const after = storage.getAlertById(target.id);
    expect(after?.independentRoutingExcludedUserIds).toContain(accusedId);
    expect(after?.assignedInvestigators).not.toContain(accusedId);
    // Aucun senior_investigator/functional_admin/darc_compliance local n'est
    // scopé sur la Côte d'Ivoire ci-dessus — repli sur l'autorité Groupe.
    expect(after?.independentRoutingUnresolved).toBe(false);
    expect(after?.escalatedOwnerId).toBeTruthy();
    expect(after?.assignedInvestigators).toContain(after?.escalatedOwnerId);

    const newAuditEntries = storage.getAuditLogs().slice(0, storage.getAuditLogs().length - auditCountBefore);
    expect(newAuditEntries.map((e) => e.actionType)).toEqual(['INVESTIGATOR_ASSIGNED', 'INDEPENDENT_ROUTING_TRIGGERED']);
  });

  it('marks the case as unresolved when the implicated account is the highest operational role (darc_compliance), and notifies the highest-grade active escalation recipient as a last resort', () => {
    const actor = storage.getActiveUser();
    const darcUser: import('../types').UserProfile = {
      id: 'test-accused-darc-compliance',
      name: 'DARC de test (Groupe)',
      email: 'test.accuse.darc@group-activa.com',
      username: 'test.accuse.darc',
      role: 'darc_compliance',
      roleTitle: 'Direction Audit, Risques & Conformité — Groupe',
      entity: 'ACTIVA Finance',
      country: 'Groupe ACTIVA',
      countries: [],
      entities: [],
      active: true,
    };
    storage.addUser(darcUser, actor);

    const target = storage.getAlerts().find((a) => a.trackingNumber === 'AACMR-26-09-0001')!;

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
