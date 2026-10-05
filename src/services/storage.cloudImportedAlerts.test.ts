/**
 * === AMÉLIORATION AJOUTÉE (lecture des dossiers Firebase par le portail) ===
 * Test d'intégration léger contre le vrai singleton `storage`, même
 * convention que storage.linkMirroredCase.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';
import { AlertRecord } from '../types';

function cloudAlert(id: string, overrides: Partial<AlertRecord> = {}): AlertRecord {
  const template = storage.getAlerts()[0];
  return { ...template, id, trackingNumber: `TRK-${id}`, mirroredCaseId: id.replace(/^case-/, ''), cloudImported: true, ...overrides };
}

describe('storage.replaceCloudImportedAlerts', () => {
  it('ajoute les dossiers Firebase sans toucher aux dossiers locaux', () => {
    const localIds = storage.getAlerts().filter((a) => !a.cloudImported).map((a) => a.id);
    storage.replaceCloudImportedAlerts([cloudAlert('case-a'), cloudAlert('case-b')]);
    const ids = storage.getAlerts().map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([...localIds, 'case-a', 'case-b']));
    expect(storage.getAlerts().filter((a) => !a.cloudImported).map((a) => a.id)).toEqual(localIds);
  });

  it('retire un dossier Firebase qui n’est plus renvoyé (supprimé ou plus visible)', () => {
    storage.replaceCloudImportedAlerts([cloudAlert('case-a'), cloudAlert('case-b')]);
    storage.replaceCloudImportedAlerts([cloudAlert('case-b', { category: 'Mise à jour' })]);
    const cloud = storage.getAlerts().filter((a) => a.cloudImported);
    expect(cloud.map((a) => a.id)).toEqual(['case-b']);
    expect(cloud[0].category).toBe('Mise à jour');
  });

  it('marque toujours les dossiers reçus comme venant de Firebase', () => {
    storage.replaceCloudImportedAlerts([cloudAlert('case-c', { cloudImported: undefined })]);
    expect(storage.getAlertById('case-c')?.cloudImported).toBe(true);
  });

  it('une liste vide efface tous les dossiers Firebase (déconnexion), jamais les locaux', () => {
    const localCount = storage.getAlerts().filter((a) => !a.cloudImported).length;
    storage.replaceCloudImportedAlerts([cloudAlert('case-d')]);
    storage.replaceCloudImportedAlerts([]);
    expect(storage.getAlerts().some((a) => a.cloudImported)).toBe(false);
    expect(storage.getAlerts().length).toBe(localCount);
  });
});
