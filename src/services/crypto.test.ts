/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : dérivation de clé robuste) ===
 *
 * Nouvelles empreintes PBKDF2 + compatibilité totale avec les empreintes
 * SHA-256 itérées déjà stockées (comptes, codes d'accès, données de démo).
 */
import { describe, expect, it } from 'vitest';
import {
  PBKDF2_ITERATIONS,
  constantTimeEqual,
  hashPassword,
  hashPasswordLegacy,
  hashPasswordPbkdf2,
  needsRehash,
  parsePbkdf2Hash,
  verifyPassword,
} from './crypto';

describe('PBKDF2 password hashing', () => {
  it('matches the RFC 7914 PBKDF2-HMAC-SHA256 test vector', async () => {
    expect(await hashPasswordPbkdf2('passwd', 'salt', 1)).toBe(
      'pbkdf2_sha256$1$55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc',
    );
  });

  it('hashPassword now produces a self-describing 600k-iteration PBKDF2 hash that verifies', async () => {
    const h = await hashPassword('Hx4G4TYJ', 'a1b2c3');
    expect(h).toMatch(new RegExp(`^pbkdf2_sha256\\$${PBKDF2_ITERATIONS}\\$[0-9a-f]{64}$`));
    expect(await verifyPassword('Hx4G4TYJ', 'a1b2c3', h)).toBe(true);
    expect(await verifyPassword('hx4g4tyj', 'a1b2c3', h)).toBe(false);
    expect(await verifyPassword('Hx4G4TYJ', 'other-salt', h)).toBe(false);
    expect(needsRehash(h)).toBe(false);
  });

  it('still verifies hashes produced by the historical iterated SHA-256 algorithm', async () => {
    const legacy = await hashPasswordLegacy('demo-pass', 'deadbeef');
    expect(legacy).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyPassword('demo-pass', 'deadbeef', legacy)).toBe(true);
    expect(await verifyPassword('wrong', 'deadbeef', legacy)).toBe(false);
    expect(needsRehash(legacy)).toBe(true);
  });

  it('honours the iteration count stored in the hash and flags weaker ones for rehash', async () => {
    const weaker = await hashPasswordPbkdf2('pw', 's', 1000);
    expect(await verifyPassword('pw', 's', weaker)).toBe(true);
    expect(needsRehash(weaker)).toBe(true);
  });

  it('rejects malformed or empty inputs', async () => {
    expect(parsePbkdf2Hash('pbkdf2_sha256$abc$00')).toBeNull();
    expect(parsePbkdf2Hash('pbkdf2_sha256$99999999999$' + '0'.repeat(64))).toBeNull();
    expect(await verifyPassword('pw', '', 'x')).toBe(false);
    expect(await verifyPassword('pw', 's', '')).toBe(false);
    expect(needsRehash(undefined)).toBe(false);
  });

  it('compares strings without short-circuit semantics errors', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});
