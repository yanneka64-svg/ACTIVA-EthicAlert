import { describe, expect, it } from 'vitest';
import { adminMfaSatisfied, isReporterAccessCode, isReporterCaseNumber, isSafeDocId, safeStoredMimeType } from './serverInputGuards';

describe('serverInputGuards', () => {
  it('isSafeDocId refuse les valeurs qui ne désignent pas un seul document', () => {
    expect(isSafeDocId('case-123-abc')).toBe(true);
    for (const bad of ['', 'a/b', 'case/communications/msg', '.', '..', '__id__', 'x'.repeat(129), { $gt: '' }, ['a'], 12, null, undefined]) {
      expect(isSafeDocId(bad)).toBe(false);
    }
  });

  it('isReporterCaseNumber accepte les formats de numéros de suivi, refuse le reste', () => {
    for (const ok of ['CASE-2026-000001', 'AACMR-26-10-0001', 'ABC']) expect(isReporterCaseNumber(ok)).toBe(true);
    for (const bad of ['AB', 'cases/abc', 'A'.repeat(65), 'a b', { a: 1 }, 1234, null]) expect(isReporterCaseNumber(bad)).toBe(false);
  });

  it('isReporterAccessCode borne la longueur et le type', () => {
    expect(isReporterAccessCode('Demo1234x')).toBe(true);
    for (const bad of ['', 'x'.repeat(201), 12345, [], null]) expect(isReporterAccessCode(bad)).toBe(false);
  });

  it('safeStoredMimeType neutralise les types interprétables par un navigateur', () => {
    expect(safeStoredMimeType('application/pdf')).toBe('application/pdf');
    expect(safeStoredMimeType('IMAGE/JPEG')).toBe('image/jpeg');
    for (const risky of ['text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/javascript', 'application/x-sh', 'text/xml', 'application/x-msdownload']) {
      expect(safeStoredMimeType(risky)).toBe('application/octet-stream');
    }
    for (const bad of ['', 'pas un type', 'x'.repeat(200), 42, null, 'text/plain; charset=utf-8<script>']) {
      expect(safeStoredMimeType(bad)).toBe('application/octet-stream');
    }
  });

  it('adminMfaSatisfied : obligatoire pour les administrateurs seulement', () => {
    expect(adminMfaSatisfied({ role: 'investigator', enrolledFactorCount: 0 })).toBe(true);
    expect(adminMfaSatisfied({ role: 'system_admin', enrolledFactorCount: 0 })).toBe(false);
    expect(adminMfaSatisfied({ role: 'security_admin', enrolledFactorCount: 0 })).toBe(false);
    expect(adminMfaSatisfied({ role: 'system_admin', signInSecondFactor: 'totp', enrolledFactorCount: 0 })).toBe(true);
    expect(adminMfaSatisfied({ role: 'system_admin', enrolledFactorCount: 1 })).toBe(true);
    expect(adminMfaSatisfied({ role: 'system_admin', signInSecondFactor: '', enrolledFactorCount: 0 })).toBe(false);
  });
});
