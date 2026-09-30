/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 7 : lien
 * dossier local ↔ dossier réel) ===
 * Test d'intégration léger contre le vrai singleton `storage`, même
 * convention que storage.generateCaseNumber.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage.linkMirroredCase', () => {
  it('persiste caseId/caseNumber sur un dossier existant, sans toucher updatedAt', () => {
    const existing = storage.getAlerts()[0];
    const updatedAtBefore = existing.updatedAt;

    storage.linkMirroredCase(existing.id, 'case-abc123', 'CASE-2026-000042');

    const reloaded = storage.getAlerts().find((a) => a.id === existing.id);
    expect(reloaded?.mirroredCaseId).toBe('case-abc123');
    expect(reloaded?.mirroredCaseNumber).toBe('CASE-2026-000042');
    expect(reloaded?.updatedAt).toBe(updatedAtBefore);
  });

  it("ne fait rien (silencieusement) si le dossier n'existe pas", () => {
    expect(() => storage.linkMirroredCase('does-not-exist', 'case-x', 'CASE-2026-000099')).not.toThrow();
    expect(storage.getAlerts().some((a) => a.mirroredCaseId === 'case-x')).toBe(false);
  });
});
