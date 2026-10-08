/**
 * === AMÉLIORATION AJOUTÉE (double authentification du personnel) ===
 *
 * Fin enrobage des appels Firebase Auth pour la double authentification par
 * application (TOTP). Prérequis côté projet : Identity Platform activé et
 * TOTP autorisée (`./scripts/devops/gcp-hardening.sh mfa`). Tant que ce n'est
 * pas le cas, `startTotpEnrollment` échoue avec une erreur « not_enabled » et
 * l'écran de connexion laisse passer (aucun blocage des comptes).
 *
 * Les écrans reçoivent ces fonctions sous forme d'objet (`MfaApi`) : on peut
 * ainsi les tester et les prévisualiser sans projet Firebase.
 */
import {
  EmailAuthProvider,
  getMultiFactorResolver,
  multiFactor,
  reauthenticateWithCredential,
  TotpMultiFactorGenerator,
} from 'firebase/auth';
import type { MultiFactorError, MultiFactorResolver, TotpSecret } from 'firebase/auth';

import { TOTP_FACTOR_DISPLAY_NAME, TOTP_ISSUER } from '../domain/mfaPolicy';
import { getPhase4Firebase } from './firebaseClient';

export interface TotpEnrollmentStart {
  /** Objet Firebase opaque, à repasser à `finishTotpEnrollment`. */
  secret: unknown;
  /** Adresse `otpauth://` encodée dans le QR code. */
  uri: string;
  /** Clé à saisir à la main si le QR code ne peut pas être scanné. */
  key: string;
}

export interface MfaApi {
  /** Date d'activation si le compte connecté a une application enregistrée, sinon `null`. */
  currentEnrollment(): { enrolledAt: string | null } | null;
  startTotpEnrollment(accountLabel: string): Promise<TotpEnrollmentStart>;
  finishTotpEnrollment(start: TotpEnrollmentStart, code: string): Promise<void>;
  disableTotp(): Promise<void>;
  /** Confirme l'identité avec le mot de passe (opérations sensibles). */
  reauthenticate(password: string): Promise<void>;
  hasPendingChallenge(): boolean;
  resolveChallenge(code: string): Promise<void>;
}

let pendingResolver: MultiFactorResolver | null = null;

export function errorCode(e: unknown): string {
  return (e as { code?: string })?.code ?? '';
}

/** Vrai si l'erreur Firebase demande le second facteur. */
export function isMfaChallenge(e: unknown): boolean {
  return errorCode(e) === 'auth/multi-factor-auth-required';
}

/**
 * Mémorise la demande de second facteur reçue à la connexion. Renvoie `false`
 * si le compte n'a pas d'application TOTP (autre facteur non pris en charge).
 */
export function rememberMfaChallenge(e: unknown): boolean {
  const { auth } = getPhase4Firebase();
  pendingResolver = getMultiFactorResolver(auth, e as MultiFactorError);
  return pendingResolver.hints.some((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
}

export function clearMfaChallenge(): void {
  pendingResolver = null;
}

export const firebaseMfaApi: MfaApi = {
  currentEnrollment() {
    const { auth } = getPhase4Firebase();
    const user = auth.currentUser;
    if (!user) return null;
    const factor = multiFactor(user).enrolledFactors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    return factor ? { enrolledAt: factor.enrollmentTime ?? null } : null;
  },

  async startTotpEnrollment(accountLabel) {
    const { auth } = getPhase4Firebase();
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
    const session = await multiFactor(user).getSession();
    const secret = await TotpMultiFactorGenerator.generateSecret(session);
    return { secret, uri: secret.generateQrCodeUrl(accountLabel, TOTP_ISSUER), key: secret.secretKey };
  },

  async finishTotpEnrollment(start, code) {
    const { auth } = getPhase4Firebase();
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(start.secret as TotpSecret, code);
    await multiFactor(user).enroll(assertion, TOTP_FACTOR_DISPLAY_NAME);
  },

  async disableTotp() {
    const { auth } = getPhase4Firebase();
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
    const factor = multiFactor(user).enrolledFactors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (factor) await multiFactor(user).unenroll(factor);
  },

  async reauthenticate(password) {
    const { auth } = getPhase4Firebase();
    const user = auth.currentUser;
    if (!user?.email) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } catch (e) {
      // Compte déjà protégé : Firebase demande aussi le code de l'application
      // (l'appelant voit `hasPendingChallenge()` et demande le code).
      if (isMfaChallenge(e)) rememberMfaChallenge(e);
      throw e;
    }
  },

  hasPendingChallenge() {
    return pendingResolver !== null;
  },

  async resolveChallenge(code) {
    if (!pendingResolver) throw Object.assign(new Error('No pending challenge'), { code: 'auth/invalid-verification-id' });
    const hint = pendingResolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (!hint) throw Object.assign(new Error('No TOTP factor'), { code: 'auth/unsupported-first-factor' });
    await pendingResolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code));
    pendingResolver = null;
  },
};
