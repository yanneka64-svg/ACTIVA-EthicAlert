/**
 * === AMÉLIORATION AJOUTÉE (double authentification du personnel) ===
 *
 * Règles pures (sans Firebase) de la double authentification par
 * application (TOTP : Google Authenticator, Microsoft Authenticator…).
 *
 * - Les comptes d'administration (système et sécurité) DOIVENT l'activer :
 *   après le mot de passe, l'écran d'activation s'affiche avant tout accès
 *   au portail.
 * - Les autres comptes peuvent l'activer depuis leur menu de profil.
 */
import type { RoleId } from './caseTypes';

/** Nom affiché dans l'application d'authentification. */
export const TOTP_ISSUER = 'ACTIVA Whistleblowing';

/** Nom donné au facteur enregistré sur le compte Firebase. */
export const TOTP_FACTOR_DISPLAY_NAME = 'Application d’authentification';

/** Rôles pour lesquels la double authentification est obligatoire. */
export const MFA_REQUIRED_ROLES: readonly RoleId[] = ['system_admin', 'security_admin'];

export function isMfaRequiredForRole(role: string | undefined | null): boolean {
  return !!role && (MFA_REQUIRED_ROLES as readonly string[]).includes(role);
}

/** Ne garde que les chiffres saisis (espaces, tirets collés…), 6 au plus. */
export function normalizeTotpCode(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 6);
}

export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** Clé secrète présentée par groupes de 4 caractères, pour la saisie manuelle. */
export function formatTotpSecret(secret: string): string {
  return String(secret ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, '$1 ');
}

export type MfaErrorKind = 'invalid_code' | 'recent_login' | 'wrong_password' | 'not_enabled' | 'too_many' | 'unknown';

/** Traduit un code d'erreur Firebase Auth en catégorie affichable. */
export function mfaErrorKind(code: string): MfaErrorKind {
  switch (code) {
    case 'auth/invalid-verification-code':
    case 'auth/invalid-verification-id':
    case 'auth/totp-challenge-timeout':
      return 'invalid_code';
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired':
      return 'recent_login';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'wrong_password';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
    case 'auth/unsupported-first-factor':
      return 'not_enabled';
    case 'auth/too-many-requests':
      return 'too_many';
    default:
      return 'unknown';
  }
}
