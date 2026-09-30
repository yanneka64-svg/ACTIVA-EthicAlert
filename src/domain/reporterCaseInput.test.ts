/**
 * === AMÉLIORATION AJOUTÉE (revue PR #139 — createCaseAsReporter) ===
 */
import { describe, expect, it } from 'vitest';
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
