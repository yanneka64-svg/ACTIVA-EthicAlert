/**
 * ACTIVA EthicAlert - Client-side password protection utilities
 *
 * SECURITY NOTE: This application currently runs entirely client-side (browser +
 * optional Firestore sync), with no dedicated authentication backend. The helpers
 * below replace the previous plaintext access-code storage with a salted,
 * iterated SHA-256 hash so that a raw whistleblower password is never persisted
 * or transmitted in clear form. This is a meaningful improvement over plaintext
 * storage, but it is still NOT equivalent to a proper server-side KDF
 * (PBKDF2/bcrypt/Argon2). For a production deployment, password verification
 * and rate limiting MUST be moved to a trusted backend (e.g. Firebase Cloud
 * Functions) so that hashes, salts and lockout counters are never readable or
 * bypassable from the client.
 */

const HASH_ITERATIONS = 1000;

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return bytesToHex(digest);
}

/** Generates a cryptographically random per-record salt (hex-encoded). */
export function generateSalt(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derives a salted, iterated SHA-256 hash of a password.
 * Iterating the hash (a lightweight stand-in for a real KDF) raises the cost
 * of brute-forcing a leaked hash compared to a single unsalted SHA-256 pass.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  let value = `${salt}:${password}`;
  for (let i = 0; i < HASH_ITERATIONS; i++) {
    value = await sha256Hex(`${value}:${salt}:${i}`);
  }
  return value;
}

// === AMÉLIORATION AJOUTÉE (Phase 26 — génération automatique du mot de passe
// d'accès, conforme à la nouvelle maquette de référence : le code de suivi
// est désormais généré par le système plutôt que saisi manuellement par le
// déclarant, ce qui garantit une entropie minimale constante — la fonction
// existante hashPassword ci-dessus continue de saler/hacher ce mot de passe
// exactement comme avant, rien n'est modifié côté stockage/vérification) ===
const ACCESS_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Generates a random, unambiguous 8-character access password (client-side, CSPRNG). */
export function generateAccessPassword(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((b) => ACCESS_PASSWORD_ALPHABET[b % ACCESS_PASSWORD_ALPHABET.length])
    .join('');
}

/** Verifies a candidate password against a stored salt + hash pair. */
export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!salt || !expectedHash) return false;
  const computed = await hashPassword(password, salt);
  return computed === expectedHash;
}
