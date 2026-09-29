/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P0 : fermer le relais e-mail ouvert) ===
 *
 * Tests du garde-fou partagé par api/notify-email.ts et la Cloud Function
 * notifyEmail. Le point clé : ce que src/services/emailNotify.ts envoie
 * réellement passe toujours ; tout le reste est refusé.
 */
import { describe, expect, it } from 'vitest';
import {
  FixedWindowRateLimiter,
  NOTIFY_DEFAULT_RATE_LIMIT,
  appCheckToken,
  bearerToken,
  clientIp,
  isStaffClaims,
  rateLimitFromEnv,
  validateNotifyEmailRequest,
} from './notifyEmailGuard';

const APP = 'https://activa-ethicalert-47246.web.app';
const headers = (extra: Record<string, string> = {}) => ({ host: 'activa-ethicalert-47246.web.app', origin: APP, ...extra });
const ENV = { allowedRecipientDomains: 'group-activa.com' };
const valid = {
  to: 'operateur@group-activa.com',
  subject: '[activa-whistleblowing] Dossier attribué — AACMR-26-09-0001',
  body: `Un dossier vient de vous être attribué.\n\nAccédez-y directement : ${APP}/cases/AACMR-26-09-0001\n\nVous ne pouvez consulter que les dossiers qui vous sont attribués.`,
};

describe('validateNotifyEmailRequest', () => {
  it('accepts exactly what emailNotify.ts sends from the app itself', () => {
    const r = validateNotifyEmailRequest({ ...valid, headers: headers() }, ENV);
    expect(r).toEqual({ ok: true, to: valid.to, subject: valid.subject, body: valid.body, origin: APP });
  });

  it('keeps the historical 400 message when a field is missing', () => {
    expect(validateNotifyEmailRequest({ to: valid.to, subject: valid.subject, headers: headers() })).toEqual({
      ok: false, status: 400, error: 'to, subject and body are required.',
    });
  });

  it('rejects a missing or foreign Origin', () => {
    expect(validateNotifyEmailRequest({ ...valid, headers: { host: 'activa-ethicalert-47246.web.app' } }, ENV)).toMatchObject({ ok: false, status: 403 });
    expect(validateNotifyEmailRequest({ ...valid, headers: headers({ origin: 'https://evil.example' }) }, ENV)).toMatchObject({ ok: false, status: 403 });
  });

  it('accepts the forwarded host (Hosting rewrite) and explicitly allowed origins', () => {
    const viaRewrite = { host: 'us-central1-x.cloudfunctions.net', 'x-forwarded-host': 'activa-ethicalert-47246.web.app', origin: APP };
    expect(validateNotifyEmailRequest({ ...valid, headers: viaRewrite }, ENV).ok).toBe(true);
    const custom = 'https://activa-ethicalert.group-activa.com';
    const r = validateNotifyEmailRequest(
      { ...valid, body: 'Référence : X', headers: { host: 'fn.run.app', origin: custom } },
      { ...ENV, allowedOrigins: `${custom}/` },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects header injection, multiple recipients and malformed addresses', () => {
    for (const to of ['a@b.com\r\nBcc: x@y.com', 'a@b.com, c@d.com', 'not-an-email', 'a@localhost']) {
      expect(validateNotifyEmailRequest({ ...valid, to, headers: headers() }, ENV)).toMatchObject({ ok: false, status: 400 });
    }
  });

  it('restricts recipient domains only when configured (subdomains allowed)', () => {
    const env = { allowedRecipientDomains: 'group-activa.com' };
    expect(validateNotifyEmailRequest({ ...valid, headers: headers() }, env).ok).toBe(true);
    expect(validateNotifyEmailRequest({ ...valid, to: 'x@cm.group-activa.com', headers: headers() }, env).ok).toBe(true);
    expect(validateNotifyEmailRequest({ ...valid, to: 'victim@gmail.com', headers: headers() }, env)).toMatchObject({ ok: false, status: 403 });
    // === AMÉLIORATION AJOUTÉE (revue PR #139) === échec fermé sans liste configurée.
    expect(validateNotifyEmailRequest({ ...valid, to: 'victim@gmail.com', headers: headers() })).toMatchObject({ ok: false, status: 503 });
    expect(validateNotifyEmailRequest({ ...valid, headers: headers() })).toMatchObject({ ok: false, status: 503 });
  });

  it('requires the one-line [activa-whistleblowing] subject', () => {
    for (const subject of ['Votre compte est suspendu', '[activa-whistleblowing] a\nb', `[activa-whistleblowing] ${'x'.repeat(300)}`]) {
      expect(validateNotifyEmailRequest({ ...valid, subject, headers: headers() }, ENV)).toMatchObject({ ok: false, status: 400 });
    }
  });

  it('rejects any link that does not point to the application, and oversized bodies', () => {
    expect(validateNotifyEmailRequest({ ...valid, body: 'Cliquez ici : https://phish.example/login', headers: headers() }, ENV)).toMatchObject({ ok: false, status: 400 });
    expect(validateNotifyEmailRequest({ ...valid, body: `${APP}.evil.example/x`, headers: headers() }, ENV)).toMatchObject({ ok: false, status: 400 });
    expect(validateNotifyEmailRequest({ ...valid, body: 'x'.repeat(5001), headers: headers() }, ENV)).toMatchObject({ ok: false, status: 400 });
  });

  it('allows http origins only for localhost development', () => {
    const local = { host: 'localhost:3000', origin: 'http://localhost:3000' };
    expect(validateNotifyEmailRequest({ ...valid, body: 'x', headers: local }, ENV).ok).toBe(true);
    expect(validateNotifyEmailRequest({ ...valid, body: 'x', headers: { host: 'app.example', origin: 'http://app.example' } }, ENV).ok).toBe(false);
  });
});

describe('FixedWindowRateLimiter', () => {
  it('accepts up to the limit per key and window, then resets', () => {
    const rl = new FixedWindowRateLimiter(2, 1000);
    expect([rl.hit('ip', 0), rl.hit('ip', 10), rl.hit('ip', 20)]).toEqual([true, true, false]);
    expect(rl.hit('other', 20)).toBe(true);
    expect(rl.hit('ip', 1000)).toBe(true);
  });
});

describe('helpers', () => {
  it('reads the first X-Forwarded-For entry', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })).toBe('1.2.3.4');
    expect(clientIp({}, '9.9.9.9')).toBe('9.9.9.9');
  });
  it('falls back to the default rate limit on invalid config', () => {
    expect(rateLimitFromEnv(undefined)).toBe(NOTIFY_DEFAULT_RATE_LIMIT);
    expect(rateLimitFromEnv('abc')).toBe(NOTIFY_DEFAULT_RATE_LIMIT);
    expect(rateLimitFromEnv('5')).toBe(5);
  });
});

// === AMÉLIORATION AJOUTÉE (revue PR #139 — appelant vérifié pour notifyEmail) ===
describe('caller token helpers', () => {
  it('extracts the bearer and App Check tokens', () => {
    expect(bearerToken({ authorization: 'Bearer abc.def' })).toBe('abc.def');
    expect(bearerToken({ authorization: 'Basic xyz' })).toBeUndefined();
    expect(bearerToken({})).toBeUndefined();
    expect(appCheckToken({ 'x-firebase-appcheck': 'tok' })).toBe('tok');
    expect(appCheckToken({})).toBeUndefined();
  });
  it('treats only claims carrying a role as staff', () => {
    expect(isStaffClaims({ role: 'investigator' })).toBe(true);
    expect(isStaffClaims({ role: '' })).toBe(false);
    expect(isStaffClaims({})).toBe(false);
    expect(isStaffClaims(null)).toBe(false);
  });
});
