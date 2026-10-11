/** === AMÉLIORATION AJOUTÉE (observabilité) === */
import { describe, expect, it } from 'vitest';
import { buildCallLogEntry, callOutcome, callSeverity, sanitizeCorrelationId, SLOW_CALL_MS } from './callObservability';

describe('journal des appels serveur', () => {
  it('résultat : ok, code HttpsError, erreurs Firestore, imprévu', () => {
    expect(callOutcome(undefined)).toBe('ok');
    expect(callOutcome({ httpErrorCode: { status: 403 }, code: 'permission-denied' })).toBe('permission-denied');
    expect(callOutcome({ code: 4 })).toBe('deadline-exceeded');
    expect(callOutcome({ code: 10 })).toBe('aborted');
    expect(callOutcome({ code: 14 })).toBe('unavailable');
    expect(callOutcome(new TypeError('x'))).toBe('internal');
  });

  it('gravité : refus normal = WARNING, panne = ERROR, lent = WARNING', () => {
    expect(callSeverity('ok', 100)).toBe('INFO');
    expect(callSeverity('ok', SLOW_CALL_MS)).toBe('WARNING');
    expect(callSeverity('permission-denied', 10)).toBe('WARNING');
    expect(callSeverity('internal', 10)).toBe('ERROR');
    expect(callSeverity('deadline-exceeded', 10)).toBe('ERROR');
  });

  it('ligne de journal : champs fixes, aucune donnée du dossier', () => {
    const e = buildCallLogEntry({ fn: 'applyPortalUpdate', durationMs: 4200.4, outcome: 'ok', role: 'investigator', actor: 'ab12', correlationId: 'corr-12345678' });
    expect(e).toEqual({
      severity: 'WARNING',
      message: 'applyPortalUpdate ok 4200ms',
      event: 'callable',
      fn: 'applyPortalUpdate',
      outcome: 'ok',
      durationMs: 4200,
      slow: true,
      role: 'investigator',
      actor: 'ab12',
      correlationId: 'corr-12345678',
    });
    expect(buildCallLogEntry({ fn: 'f', durationMs: 5, outcome: 'ok', correlationId: 'c' }).role).toBe('anonymous');
  });

  it('identifiant de corrélation : format strict', () => {
    expect(sanitizeCorrelationId('abcdEFGH1234')).toBe('abcdEFGH1234');
    expect(sanitizeCorrelationId('a b')).toBeNull();
    expect(sanitizeCorrelationId({})).toBeNull();
  });
});
