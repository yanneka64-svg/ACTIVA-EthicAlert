/**
 * === AMÉLIORATION AJOUTÉE (revue PR #139 — createCaseAsReporter) ===
 */
import { describe, expect, it } from 'vitest';
import { formatTrackingNumber } from './reporterCaseInput';
import { parseReporterCaseInput, REPORTER_INPUT_LIMITS } from './reporterCaseInput';

const base = { category: 'Fraude', subcategory: 'Détournement', country: 'Cameroun', entity: 'ACTIVA Assurances', description: 'Faits', reportingMode: 'anonymous', confidentialityLevel: 'restricted' };

describe('parseReporterCaseInput', () => {
  it('accepts exactly what the submission mirror sends, trimmed', () => {
    const r = parseReporterCaseInput({ ...base, category: '  Fraude ', accessCode: 'Hk7mPq2Rz', externalReference: 'aacmr-26-09-0001' });
    expect(r).toEqual({ ok: true, value: { ...base, accessCode: 'Hk7mPq2Rz', externalReference: 'AACMR-26-09-0001' } });
  });

  it('applies the historical defaults for optional enums and subcategory', () => {
    const r = parseReporterCaseInput({ category: 'A', country: 'B', entity: 'C', description: 'D' });
    expect(r).toMatchObject({ ok: true, value: { subcategory: '', reportingMode: 'anonymous', confidentialityLevel: 'confidential' } });
  });

  it('rejects missing, non-string or oversized required fields', () => {
    expect(parseReporterCaseInput({ ...base, category: undefined }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, country: { $gt: '' } }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, description: 'x'.repeat(REPORTER_INPUT_LIMITS.description + 1) }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, entity: '   ' }).ok).toBe(false);
  });

  it('rejects values outside the allowed enums', () => {
    expect(parseReporterCaseInput({ ...base, reportingMode: 'public' }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, confidentialityLevel: 'top_secret' }).ok).toBe(false);
  });

  it('rejects malformed access codes and references, and non-object payloads', () => {
    expect(parseReporterCaseInput({ ...base, accessCode: 'short' }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, accessCode: 'has space 123' }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, externalReference: '../../x' }).ok).toBe(false);
    expect(parseReporterCaseInput(null).ok).toBe(false);
    expect(parseReporterCaseInput([base]).ok).toBe(false);
  });

  it('never copies unknown fields', () => {
    const r = parseReporterCaseInput({ ...base, status: 'closed', assignee: 'attacker' });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(['category', 'confidentialityLevel', 'country', 'description', 'entity', 'reportingMode', 'subcategory']);
  });
});

// === AMÉLIORATION AJOUTÉE (numéro de suivi attribué par le serveur) ===
describe('parseReporterCaseInput — numéro attribué par le serveur', () => {
  const base = { category: 'Fraude', country: 'Cameroun', entity: 'ACTIVA Assurances', description: 'Faits.' };
  it('accepte un code d’entité et un identifiant de dépôt valides', () => {
    const r = parseReporterCaseInput({ ...base, entityCode: 'AACMR', submissionId: 'sub-1234abcd' });
    expect(r.ok && r.value.entityCode).toBe('AACMR');
    expect(r.ok && r.value.submissionId).toBe('sub-1234abcd');
  });
  it('refuse un code d’entité ou un identifiant mal formés', () => {
    expect(parseReporterCaseInput({ ...base, entityCode: 'aa-1' }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, submissionId: 'x' }).ok).toBe(false);
    expect(parseReporterCaseInput({ ...base, submissionId: 'a b c d e f g h' }).ok).toBe(false);
  });
});

describe('formatTrackingNumber', () => {
  it('produit le format officiel CODE-AA-MM-NNNN', () => {
    expect(formatTrackingNumber('AACMR', new Date('2026-10-05T08:00:00Z'), 2)).toBe('AACMR-26-10-0002');
    expect(formatTrackingNumber('GRP', new Date('2027-01-31T23:00:00Z'), 123)).toBe('GRP-27-01-0123');
  });
});
