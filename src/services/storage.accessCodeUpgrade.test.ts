/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : codes d'accès hérités) ===
 *
 * Mise à niveau transparente de l'empreinte du code d'accès d'un lanceur
 * d'alerte après une vérification réussie (AlertTrackingView).
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';
import { hashPasswordLegacy, needsRehash, verifyPassword } from './crypto';
import type { AlertRecord } from '../types';

function cloneFirstAlert(id: string, patch: Partial<AlertRecord>): AlertRecord {
  const base = storage.getAlerts()[0];
  const alert = { ...base, id, trackingNumber: `TEST-${id}`, ...patch } as AlertRecord;
  storage.saveAlert(alert);
  return storage.getAlerts().find((a) => a.id === id)!;
}

describe('storage.upgradeAccessCodeHashIfNeeded', () => {
  it('replaces a legacy iterated-SHA-256 hash by PBKDF2 without touching updatedAt or the audit trail', async () => {
    const legacy = await hashPasswordLegacy('Code1234', 'aabbccdd');
    const alert = cloneFirstAlert('acc-upg-1', { accessCodeHash: legacy, accessCodeSalt: 'aabbccdd' });
    const updatedAt = alert.updatedAt;
    const audit = storage.getAuditLogs().length;

    await storage.upgradeAccessCodeHashIfNeeded(alert.id, 'Code1234');

    const after = storage.getAlerts().find((a) => a.id === alert.id)!;
    expect(needsRehash(after.accessCodeHash)).toBe(false);
    expect(after.accessCodeSalt).not.toBe('aabbccdd');
    expect(await verifyPassword('Code1234', after.accessCodeSalt, after.accessCodeHash)).toBe(true);
    expect(after.updatedAt).toBe(updatedAt);
    expect(storage.getAuditLogs().length).toBe(audit);
  });

  it('salts and hashes a legacy unsalted demo code (stored in clear) the same way', async () => {
    const alert = cloneFirstAlert('acc-upg-2', { accessCodeHash: 'demo-code', accessCodeSalt: '' });
    await storage.upgradeAccessCodeHashIfNeeded(alert.id, 'demo-code');
    const after = storage.getAlerts().find((a) => a.id === alert.id)!;
    expect(after.accessCodeHash).toMatch(/^pbkdf2_sha256\$/);
    expect(await verifyPassword('demo-code', after.accessCodeSalt, after.accessCodeHash)).toBe(true);
  });

  it('leaves an already-strong hash and unknown alerts untouched', async () => {
    const alert = cloneFirstAlert('acc-upg-3', { accessCodeHash: 'x', accessCodeSalt: '' });
    await storage.upgradeAccessCodeHashIfNeeded(alert.id, 'x');
    const strong = storage.getAlerts().find((a) => a.id === alert.id)!;
    const snapshot = { h: strong.accessCodeHash, s: strong.accessCodeSalt };
    await storage.upgradeAccessCodeHashIfNeeded(alert.id, 'x');
    const again = storage.getAlerts().find((a) => a.id === alert.id)!;
    expect({ h: again.accessCodeHash, s: again.accessCodeSalt }).toEqual(snapshot);
    await expect(storage.upgradeAccessCodeHashIfNeeded('does-not-exist', 'x')).resolves.toBeUndefined();
  });
});
