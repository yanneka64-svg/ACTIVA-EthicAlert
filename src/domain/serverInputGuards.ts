/**
 * === AMÉLIORATION AJOUTÉE (tests hors « happy path » et sécurité) ===
 *
 * Contrôles purs (sans Firebase) appliqués par les Cloud Functions aux
 * données reçues des clients. Ajoutés après la batterie d'attaques
 * scripts/e2eSecurity.emulator.mts : chaque règle correspond à un cas qui
 * provoquait une erreur interne ou laissait passer une valeur dangereuse.
 */
import type { RoleId } from './caseTypes';
import { isMfaRequiredForRole } from './mfaPolicy';

/**
 * Identifiant de document Firestore fourni par un client (caseId, evidenceId…).
 * Refuse tout ce qui n'est pas une chaîne courte : objets, tableaux, « / »
 * (qui ferait pointer vers un AUTRE document, ex. `cas/communications/msg`),
 * « . », « .. » et les identifiants réservés `__…__`.
 */
export function isSafeDocId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes('/') &&
    value !== '.' &&
    value !== '..' &&
    !/^__.*__$/.test(value)
  );
}

/** Numéro de suivi saisi par un déclarant : lettres, chiffres, tirets, 3 à 64 caractères. */
export function isReporterCaseNumber(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{3,64}$/.test(value.trim());
}

/** Code d'accès saisi par un déclarant : chaîne non vide d'au plus 200 caractères. */
export function isReporterAccessCode(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}

const RISKY_MIME = /(html|xml|javascript|ecmascript|svg|x-sh\b|x-csh|x-msdownload|x-msdos|x-php|x-httpd|x-perl|x-python)/i;
const MIME_SHAPE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,60}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,60}$/i;

/**
 * Type de fichier enregistré pour une pièce déposée. Un type capable d'être
 * exécuté par un navigateur (HTML, SVG, XML, JavaScript…) ou mal formé est
 * remplacé par `application/octet-stream` : le fichier reste téléchargeable
 * sous son nom d'origine, mais n'est jamais interprété comme une page.
 */
export function safeStoredMimeType(value: unknown): string {
  if (typeof value !== 'string') return 'application/octet-stream';
  const type = value.trim().toLowerCase();
  if (!MIME_SHAPE.test(type) || RISKY_MIME.test(type)) return 'application/octet-stream';
  return type;
}

/**
 * Double authentification exigée par le SERVEUR (et plus seulement par
 * l'écran de connexion) pour les rôles d'administration : la session doit
 * avoir été ouverte avec le second facteur, ou le compte doit en avoir un
 * enregistré (Firebase refuse alors toute connexion par mot de passe seul).
 */
export function adminMfaSatisfied(input: { role: RoleId | string | undefined; signInSecondFactor?: unknown; enrolledFactorCount: number }): boolean {
  if (!isMfaRequiredForRole(input.role)) return true;
  if (typeof input.signInSecondFactor === 'string' && input.signInSecondFactor) return true;
  return input.enrolledFactorCount > 0;
}
