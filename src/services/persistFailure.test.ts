/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P0 : plus de perte de données silencieuse) ===
 */
import { describe, expect, it } from 'vitest';
import { getLastPersistFailure, isQuotaExceededError, reportPersistFailure } from './persistFailure';

describe('persistFailure', () => {
  it('recognises quota errors from every major browser', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError(new Error('SecurityError'))).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });

  it('remembers the last failure and never throws outside a browser', () => {
    expect(() => reportPersistFailure('alerts', { name: 'QuotaExceededError' })).not.toThrow();
    expect(getLastPersistFailure()).toEqual({ what: 'alerts', quotaExceeded: true });
  });
});
