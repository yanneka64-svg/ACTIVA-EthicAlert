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
