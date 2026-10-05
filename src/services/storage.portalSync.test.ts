/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
 * Toute modification d'un dossier lié au serveur (attribution, statut…) est
 * envoyée ; un dossier local non lié ne l'est jamais ; l'état reçu du
 * serveur n'est jamais renvoyé.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queuePortalUpdate = vi.fn();
vi.mock('./portalSync', () => ({ queuePortalUpdate }));

import { storage } from './storage';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('storage → serveur (applyPortalUpdate)', () => {
  beforeEach(() => queuePortalUpdate.mockClear());

  it('envoie l’attribution d’un dossier lié au serveur', async () => {
    const a = storage.getAlerts()[0];
    storage.linkMirroredCase(a.id, 'case-sync-1', 'CASE-2026-000777');
    await flush();
    queuePortalUpdate.mockClear();
    const linked = storage.getAlertById(a.id)!;
    storage.saveAlert({ ...linked, assignedInvestigators: ['uid-inv-1'], assignedInvestigatorNames: ['Inv'] });
    await flush();
    await flush();
    expect(queuePortalUpdate).toHaveBeenCalledWith('case-sync-1', expect.objectContaining({ assignedInvestigators: ['uid-inv-1'] }));
  });

  it('envoie un changement de statut fait sur place (transitionStatus)', async () => {
    const a = storage.getAlerts().find((x) => x.mirroredCaseId === 'case-sync-1')!;
    const actor = storage.getActiveUser();
    const from = a.workflowStatus ?? 'new';
    const to = from === 'new' ? 'triage' : 'investigation';
    const res = storage.transitionStatus(a.id, to as never, actor, 'test');
    await flush();
    await flush();
    if (res.allowed) {
      expect(queuePortalUpdate).toHaveBeenCalledWith('case-sync-1', expect.objectContaining({ portal: expect.objectContaining({ workflowStatus: to }) }));
    }
  });

  it('ne renvoie jamais l’état reçu du serveur', async () => {
    const a = storage.getAlerts().find((x) => x.mirroredCaseId === 'case-sync-1')!;
    storage.replaceCloudImportedAlerts([{ ...a, id: 'cloud-x', mirroredCaseId: 'case-cloud-x', status: 'closed', closureSummary: 'Du serveur' }]);
    await flush();
    await flush();
    expect(queuePortalUpdate).not.toHaveBeenCalledWith('case-cloud-x', expect.anything());
  });

  it('une saisie locale inconnue du serveur lui est envoyée une fois', async () => {
    const a = storage.getAlerts().find((x) => x.mirroredCaseId === 'case-sync-1')!;
    storage.replaceCloudImportedAlerts([
      { ...a, id: 'cloud-y', mirroredCaseId: 'case-cloud-y', investigationReport: 'Rapport saisi avant', serverPortal: {} },
    ]);
    await flush();
    await flush();
    expect(queuePortalUpdate).toHaveBeenCalledWith('case-cloud-y', { portal: { investigationReport: 'Rapport saisi avant' } });
    queuePortalUpdate.mockClear();
    storage.replaceCloudImportedAlerts([
      { ...a, id: 'cloud-y', mirroredCaseId: 'case-cloud-y', investigationReport: 'Rapport saisi avant', serverPortal: { investigationReport: 'Rapport saisi avant' }, updatedAt: 'x' },
    ]);
    await flush();
    await flush();
    expect(queuePortalUpdate).not.toHaveBeenCalled();
  });

  it('un dossier non lié au serveur n’est jamais envoyé', async () => {
    const local = storage.getAlerts().find((x) => !x.mirroredCaseId)!;
    storage.saveAlert({ ...local, assignedInvestigators: ['someone'] });
    await flush();
    await flush();
    expect(queuePortalUpdate).not.toHaveBeenCalled();
  });
});
