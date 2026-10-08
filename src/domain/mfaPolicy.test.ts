// === AMÉLIORATION AJOUTÉE (double authentification du personnel) ===
import { describe, expect, it } from 'vitest';
import { formatTotpSecret, isMfaRequiredForRole, isValidTotpCode, mfaErrorKind, normalizeTotpCode } from './mfaPolicy';

describe('mfaPolicy', () => {
  it('impose la double authentification aux seuls comptes d’administration', () => {
    expect(isMfaRequiredForRole('system_admin')).toBe(true);
    expect(isMfaRequiredForRole('security_admin')).toBe(true);
    expect(isMfaRequiredForRole('functional_admin')).toBe(false);
    expect(isMfaRequiredForRole('investigator')).toBe(false);
    expect(isMfaRequiredForRole(undefined)).toBe(false);
  });

  it('nettoie et valide le code à 6 chiffres', () => {
    expect(normalizeTotpCode(' 123 456 ')).toBe('123456');
    expect(normalizeTotpCode('12-34-5678')).toBe('123456');
    expect(isValidTotpCode('123456')).toBe(true);
    expect(isValidTotpCode('12345')).toBe(false);
    expect(isValidTotpCode('12345a')).toBe(false);
  });

  it('présente la clé secrète par groupes de 4', () => {
    expect(formatTotpSecret('abcdefghijklmnop')).toBe('ABCD EFGH IJKL MNOP');
    expect(formatTotpSecret('ABCDEF')).toBe('ABCD EF');
  });

  it('classe les erreurs Firebase', () => {
    expect(mfaErrorKind('auth/invalid-verification-code')).toBe('invalid_code');
    expect(mfaErrorKind('auth/requires-recent-login')).toBe('recent_login');
    expect(mfaErrorKind('auth/invalid-credential')).toBe('wrong_password');
    expect(mfaErrorKind('auth/operation-not-allowed')).toBe('not_enabled');
    expect(mfaErrorKind('auth/too-many-requests')).toBe('too_many');
    expect(mfaErrorKind('auth/network-request-failed')).toBe('unknown');
  });
});
