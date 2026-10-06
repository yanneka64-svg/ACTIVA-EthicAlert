// === AMÉLIORATION AJOUTÉE (suppression des dossiers fictifs) ===
import { describe, expect, it } from 'vitest';
import { storage } from './storage';
import type { AlertRecord } from '../types';

describe('storage.removeLocalCasesDeletedOnServer', () => {
  it('retire les dossiers de ce navigateur supprimés du serveur, et seulement eux', () => {
    const base = storage.getAlerts()[0];
    const now = Date.parse('2026-10-06T12:00:00Z');
    const old = '2026-10-05T08:00:00Z';
    const mk = (id: string, extra: Partial<AlertRecord>): AlertRecord => ({ ...base, id, trackingNumber: `T-${id}`, createdAt: old, ...extra });
    const deleted = mk('rm-deleted', { mirroredCaseId: 'srv-deleted' });
    const kept = mk('rm-kept', { mirroredCaseId: 'srv-kept' });
    const fresh = mk('rm-fresh', { mirroredCaseId: 'srv-new', createdAt: '2026-10-06T11:55:00Z' });
    const unlinked = mk('rm-unlinked', {});
    [deleted, kept, fresh, unlinked].forEach((a) => storage.saveAlert(a));

    const removed = storage.removeLocalCasesDeletedOnServer(new Set(['srv-kept']), now);

    const ids = storage.getAlerts().map((a) => a.id);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(ids).not.toContain('rm-deleted');
    expect(ids).toContain('rm-kept');
    expect(ids).toContain('rm-fresh');
    expect(ids).toContain('rm-unlinked');
  });
});
