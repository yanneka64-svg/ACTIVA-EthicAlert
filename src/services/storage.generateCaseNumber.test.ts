/**
 * === AMÉLIORATION AJOUTÉE (numérotation officielle des dossiers) ===
 *
 * Test d'intégration léger de `storage.generateCaseNumber()` contre le vrai
 * singleton `storage`, même convention que storage.escalateAlert.test.ts.
 * Format attendu (fourni par la DARC Groupe) : XX(code entité)-YY(année)-
 * MM(mois)-XXXX(n° séquentiel sur 4 chiffres, remis à 0001 chaque début de
 * mois, PAR ENTITÉ). Exemple : AARDC-26-09-0001.
 */
import { describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage.generateCaseNumber', () => {
  it('produces the official XX-YY-MM-XXXX format', () => {
    const num = storage.generateCaseNumber('ZZT1', new Date('2026-09-08T00:00:00Z'));
    expect(num).toMatch(/^ZZT1-26-09-\d{4}$/);
  });

  it('increments sequentially within the same entity and month, starting at 0001', () => {
    const first = storage.generateCaseNumber('ZZT2', new Date('2026-05-05T00:00:00Z'));
    const second = storage.generateCaseNumber('ZZT2', new Date('2026-05-20T00:00:00Z'));
    const third = storage.generateCaseNumber('ZZT2', new Date('2026-05-01T00:00:00Z'));
    expect(first).toBe('ZZT2-26-05-0001');
    expect(second).toBe('ZZT2-26-05-0002');
    expect(third).toBe('ZZT2-26-05-0003');
  });

  it('resets to 0001 for a different month, and keeps each entity independent', () => {
    storage.generateCaseNumber('ZZT3', new Date('2026-01-15T00:00:00Z'));
    const nextMonth = storage.generateCaseNumber('ZZT3', new Date('2026-02-01T00:00:00Z'));
    expect(nextMonth).toBe('ZZT3-26-02-0001');

    const otherEntitySameMonth = storage.generateCaseNumber('ZZT4', new Date('2026-02-01T00:00:00Z'));
    expect(otherEntitySameMonth).toBe('ZZT4-26-02-0001');
  });

  it('uppercases the entity code and falls back to GRP when empty', () => {
    const lower = storage.generateCaseNumber('zzt5', new Date('2026-03-01T00:00:00Z'));
    expect(lower).toMatch(/^ZZT5-26-03-\d{4}$/);

    const empty = storage.generateCaseNumber('', new Date('2026-03-01T00:00:00Z'));
    expect(empty).toMatch(/^GRP-26-03-\d{4}$/);
  });

  // === AMÉLIORATION AJOUTÉE === le compteur d'une entité déjà présente
  // dans les dossiers seedés (AACMR, via alt-001 = AACMR-26-09-0001)
  // reprend après le plus haut numéro déjà utilisé, jamais depuis 0001 —
  // protection anti-collision de seedCaseNumberCountersFromAlerts().
  it('continues after the seed data for an already-used entity/month instead of colliding', () => {
    const seeded = storage.getAlerts().find((a) => a.trackingNumber === 'AACMR-26-09-0001');
    expect(seeded).toBeTruthy();

    const next = storage.generateCaseNumber('AACMR', new Date('2026-09-08T00:00:00Z'));
    expect(next).not.toBe('AACMR-26-09-0001');
    expect(next).toMatch(/^AACMR-26-09-\d{4}$/);
  });
});
