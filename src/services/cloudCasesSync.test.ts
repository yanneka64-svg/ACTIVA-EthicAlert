/**
 * === AMÉLIORATION AJOUTÉE (lecture des dossiers Firebase par le portail) ===
 */
import { describe, expect, it } from 'vitest';
import { isFreshLocalEdit } from './cloudCasesSync';

describe('cloudCasesSync — isFreshLocalEdit', () => {
  const now = Date.parse('2026-10-05T10:00:00Z');

  it('modification locale récente et plus récente que Firebase : on garde la copie locale', () => {
    expect(isFreshLocalEdit('2026-10-05T09:59:30Z', '2026-10-05T09:00:00Z', now)).toBe(true);
  });

  it('modification locale ancienne (au-delà de 90 s) : Firebase fait référence', () => {
    expect(isFreshLocalEdit('2026-10-05T09:58:00Z', '2026-10-05T09:00:00Z', now)).toBe(false);
  });

  it('Firebase déjà plus récent que la copie locale : Firebase fait référence', () => {
    expect(isFreshLocalEdit('2026-10-05T09:59:30Z', '2026-10-05T09:59:50Z', now)).toBe(false);
  });

  it('date locale illisible : Firebase fait référence', () => {
    expect(isFreshLocalEdit(undefined, '2026-10-05T09:00:00Z', now)).toBe(false);
  });
});

// === AMÉLIORATION AJOUTÉE (chargement rapide du portail) ===
import { caseFingerprint, casesNeedingDetails } from './cloudCasesSync';

describe('casesNeedingDetails', () => {
  const listed = [
    { caseId: 'a', updatedAt: '2026-10-05T10:00:00Z', lastActivityAt: '2026-10-05T10:05:00Z' },
    { caseId: 'b', updatedAt: '2026-10-05T09:00:00Z' },
    { caseId: 'c', updatedAt: '2026-10-05T08:00:00Z' },
  ];
  const fingerprints = {
    a: caseFingerprint(listed[0]),
    b: '2026-10-05T08:59:00Z|',
    c: caseFingerprint(listed[2]),
  };

  it('ne recharge que les dossiers nouveaux, modifiés ou sans copie locale', () => {
    const local = new Set(['a', 'b']);
    expect(casesNeedingDetails(listed, fingerprints, (id) => local.has(id), false)).toEqual(['b', 'c']);
  });

  it('recharge tout lors du rechargement complet de sécurité', () => {
    expect(casesNeedingDetails(listed, fingerprints, () => true, true)).toEqual(['a', 'b', 'c']);
  });

  it("change d'empreinte à chaque nouvelle activité sur le dossier", () => {
    expect(caseFingerprint({ updatedAt: 'x', lastActivityAt: 'y' })).not.toBe(caseFingerprint({ updatedAt: 'x', lastActivityAt: 'z' }));
  });
});
