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
 *
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === les nouvelles empreintes
 * sont désormais dérivées par PBKDF2-HMAC-SHA256 (600 000 itérations, voir
 * `hashPassword`) ; le hachage SHA-256 itéré décrit ci-dessus ne sert plus
 * qu'à vérifier les empreintes existantes. La recommandation de déplacer la
 * vérification côté serveur (Firebase Auth / Cloud Functions) reste valable.
 */

const HASH_ITERATIONS = 1000;

// === AMÉLIORATION AJOUTÉE (Audit DevOps — P2 : dérivation de clé robuste) ===
// Les NOUVELLES empreintes utilisent PBKDF2-HMAC-SHA256 à 600 000 itérations
// (recommandation OWASP), via WebCrypto (`crypto.subtle.deriveBits`) —
// disponible à l'identique dans le navigateur et dans le runtime Node des
// Cloud Functions, qui importent ce même fichier. Format auto-descriptif,
// stocké dans le même champ qu'avant (passwordHash / accessCodeHash) :
//   pbkdf2_sha256$<itérations>$<hex 64>
// Les empreintes existantes (SHA-256 itéré 1 000 fois, hex sans préfixe)
// restent vérifiables : `verifyPassword` reconnaît les deux formats, aucune
// donnée n'est invalidée. `needsRehash` permet de mettre à niveau une
// empreinte héritée lors d'une connexion réussie (voir storage.ts).
export const PBKDF2_PREFIX = 'pbkdf2_sha256';
export const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_KEY_BITS = 256;

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
 *
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === produit désormais une
 * empreinte PBKDF2-HMAC-SHA256 (600 000 itérations, format préfixé). Même
 * signature, mêmes appelants ; l'ancien algorithme reste disponible via
 * `hashPasswordLegacy` pour vérifier les empreintes existantes.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  return hashPasswordPbkdf2(password, salt, PBKDF2_ITERATIONS);
}

// === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === dérivation PBKDF2 (WebCrypto).
export async function hashPasswordPbkdf2(password: string, salt: string, iterations: number = PBKDF2_ITERATIONS): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations },
    key,
    PBKDF2_KEY_BITS
  );
  return `${PBKDF2_PREFIX}$${iterations}$${bytesToHex(bits)}`;
}

/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === algorithme historique
 * (SHA-256 itéré 1 000 fois), corps inchangé : conservé UNIQUEMENT pour
 * vérifier les empreintes créées avant le passage à PBKDF2 (comptes et
 * codes d'accès existants, données de démonstration, compte de secours).
 */
export async function hashPasswordLegacy(password: string, salt: string): Promise<string> {
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

// === AMÉLIORATION AJOUTÉE (politique de mots de passe Firebase) ===
// Mot de passe temporaire du personnel conforme à la politique Firebase du
// projet : au moins une majuscule, une minuscule, un chiffre et un caractère
// spécial (reconnu par Firebase), sans caractères ambigus (I/l/1, O/0).
// Tirage CSPRNG par rejet (aucun biais de modulo), positions mélangées.
const POLICY_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const POLICY_LOWER = 'abcdefghijkmnpqrstuvwxyz';
const POLICY_DIGITS = '23456789';
const POLICY_SPECIAL = '!@#%&*?-_+=';

function randomIndex(max: number): number {
  const limit = 256 - (256 % max);
  const byte = new Uint8Array(1);
  do {
    crypto.getRandomValues(byte);
  } while (byte[0] >= limit);
  return byte[0] % max;
}

export function generatePolicyCompliantPassword(length = 12): string {
  const size = Math.max(8, length);
  const all = POLICY_UPPER + POLICY_LOWER + POLICY_DIGITS + POLICY_SPECIAL;
  const chars = [POLICY_UPPER, POLICY_LOWER, POLICY_DIGITS, POLICY_SPECIAL].map((set) => set[randomIndex(set.length)]);
  while (chars.length < size) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

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
  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) === format détecté depuis
  // l'empreinte stockée ; comparaison à temps constant.
  const parsed = parsePbkdf2Hash(expectedHash);
  const computed = parsed
    ? await hashPasswordPbkdf2(password, salt, parsed.iterations)
    : await hashPasswordLegacy(password, salt);
  return constantTimeEqual(computed, expectedHash);
}

// === AMÉLIORATION AJOUTÉE (Audit DevOps — P2) ===
/** Lit une empreinte au format `pbkdf2_sha256$<itérations>$<hex>` ; `null` pour une empreinte héritée. */
export function parsePbkdf2Hash(hash: string): { iterations: number } | null {
  const parts = hash.split('$');
  if (parts.length !== 3 || parts[0] !== PBKDF2_PREFIX) return null;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000 || !/^[0-9a-f]{64}$/.test(parts[2])) return null;
  return { iterations };
}

/** `true` si l'empreinte doit être recalculée avec l'algorithme actuel (héritée, ou PBKDF2 moins itéré). */
export function needsRehash(hash: string | undefined): boolean {
  if (!hash) return false;
  const parsed = parsePbkdf2Hash(hash);
  return !parsed || parsed.iterations < PBKDF2_ITERATIONS;
}

/** Comparaison de chaînes sans court-circuit (évite une fuite par mesure du temps de réponse). */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
