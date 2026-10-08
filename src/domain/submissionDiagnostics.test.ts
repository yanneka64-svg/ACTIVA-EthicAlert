// === AMÉLIORATION AJOUTÉE (diagnostic des dépôts retardés) ===
import { describe, expect, it } from 'vitest';
import { classifyUserAgent, normalizeErrorCode, sanitizeSubmissionDiagnostics } from './submissionDiagnostics';

describe('submissionDiagnostics', () => {
  it('classe les appareils et navigateurs courants', () => {
    expect(classifyUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toEqual({ platform: 'ios', browser: 'safari' });
    expect(classifyUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36')).toEqual({ platform: 'android', browser: 'samsung' });
    expect(classifyUserAgent('Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 [FBAN/EMA;FBAV/400.0]')).toEqual({ platform: 'android', browser: 'inapp' });
    expect(classifyUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 OPR/85.0')).toEqual({ platform: 'android', browser: 'opera' });
    expect(classifyUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36')).toEqual({ platform: 'desktop', browser: 'chrome' });
  });

  it("n'accepte que des valeurs sûres", () => {
    expect(normalizeErrorCode('functions/internal')).toBe('functions/internal');
    expect(normalizeErrorCode('<script>')).toBe('unknown');
    expect(sanitizeSubmissionDiagnostics({ firstError: 'functions/internal', attempts: 3.7, via: 'site', platform: 'ios', browser: 'safari', extra: 'x' })).toEqual({ firstError: 'functions/internal', attempts: 3, via: 'site', platform: 'ios', browser: 'safari' });
    expect(sanitizeSubmissionDiagnostics({ firstError: 'a b' })).toBeNull();
    expect(sanitizeSubmissionDiagnostics({ firstError: 'x', attempts: -5, via: 'evil', platform: 'evil', browser: 'evil' })).toEqual({ firstError: 'x', attempts: 0, via: 'site', platform: 'other', browser: 'other' });
    expect(sanitizeSubmissionDiagnostics(null)).toBeNull();
  });
});
