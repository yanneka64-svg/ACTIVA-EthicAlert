// === AMÉLIORATION AJOUTÉE (numéro provisoire unique hors ligne) ===
import { describe, expect, it } from 'vitest';
import { formatTrackingNumber, parseReporterCaseInput, provisionalTrackingNumber } from './reporterCaseInput';

describe('provisionalTrackingNumber', () => {
  const date = new Date(2026, 9, 8);

  it('garde le format CODE-AA-MM- avec une fin aléatoire commençant par une lettre', () => {
    const n = provisionalTrackingNumber('aacmr', date);
    expect(n).toMatch(/^AACMR-26-10-[A-Z][A-Z2-9]{5}$/);
  });

  it('ne coïncide jamais avec un numéro officiel ni entre deux appareils', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(provisionalTrackingNumber('AACMR', date));
    expect(seen.size).toBe(2000);
    expect(seen.has(formatTrackingNumber('AACMR', date, 1))).toBe(false);
  });

  it('est accepté par le serveur comme numéro déjà remis', () => {
    const ref = provisionalTrackingNumber('AACMR', date);
    const parsed = parseReporterCaseInput({
      category: 'Fraude', country: 'Cameroun', entity: 'ACTIVA', description: 'Test',
      reportingMode: 'anonymous', confidentialityLevel: 'confidential', externalReference: ref,
    });
    expect(parsed.ok).toBe(true);
  });
});
