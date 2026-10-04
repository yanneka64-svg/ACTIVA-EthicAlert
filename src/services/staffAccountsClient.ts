/**
 * === AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et
 * enregistrés dans Firebase) ===
 *
 * Côté portail des Cloud Functions de functions/src/staffAccounts.ts :
 * - connexion par IDENTIFIANT contre Firebase Auth (adresse technique
 *   dérivée, voir src/domain/staffAccounts.ts) ;
 * - profil du compte connecté, changement du mot de passe temporaire ;
 * - annuaire du personnel, recopié dans storage.ts pour que les écrans
 *   existants (attribution, notifications, Utilisateurs) le voient ;
 * - création / modification / suppression / nouveau mot de passe
 *   temporaire depuis Administration → Utilisateurs.
 *
 * Tant que Firebase n'est pas configuré (VITE_FIREBASE_*), rien ici n'est
 * appelé : le portail garde ses comptes locaux, comportement inchangé.
 */
import type { User as FirebaseUser } from 'firebase/auth';

import { UserProfile } from '../types';
import { RoleId } from '../domain/caseTypes';
import { roleHasPermission } from '../domain/permissions';
import { StaffAccountInput, StaffAccountProfile, isStaffRole, staffAuthEmail } from '../domain/staffAccounts';
import { getPhase4Config, getPhase4Firebase, getPhase4Functions } from './firebaseClient';
import { getStaffClaims, isStaffAuthConfigured, signInStaff, signOutStaff } from './staffAuth';
import { storage } from './storage';

export { isStaffAuthConfigured };

/** Erreur lisible renvoyée par une Cloud Function (code `functions/...`) ou Firebase Auth (`auth/...`). */
export function staffErrorCode(e: unknown): string {
  return (e as { code?: string })?.code ?? '';
}

async function callStaffFunction<Req, Res>(name: string, data: Req): Promise<Res> {
  const { httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<Req, Res>(await getPhase4Functions(), name);
  const result = await fn(data);
  return result.data;
}

/** Profil Firestore → profil utilisé par le portail (storage.ts). */
export function staffProfileToUserProfile(account: StaffAccountProfile): UserProfile {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    username: account.username,
    role: account.role,
    roleTitle: account.roleTitle,
    entity: account.entity,
    country: account.country,
    countries: account.countries,
    entities: account.entities,
    active: account.active,
    mustChangePassword: account.mustChangePassword,
    passwordSetAt: account.passwordSetAt,
    authSource: 'firebase',
  };
}

/** Codes Firebase Auth signifiant « identifiant ou mot de passe incorrect » (pas une panne). */
const WRONG_CREDENTIALS = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/user-disabled'];

export type StaffSignInResult =
  | { ok: true; user: UserProfile; mustChangePassword: boolean }
  | { ok: false; reason: 'wrong_credentials' | 'expired' | 'locked' | 'not_provisioned' | 'unavailable' };

/**
 * Connexion par identifiant + mot de passe contre Firebase Auth, puis
 * lecture du profil. Ne lève jamais : l'appelant décide du repli local.
 */
export async function signInStaffWithUsername(username: string, password: string): Promise<StaffSignInResult> {
  try {
    await signInStaff(staffAuthEmail(username, getPhase4Config().projectId), password);
  } catch (e) {
    const code = staffErrorCode(e);
    if (WRONG_CREDENTIALS.includes(code)) return { ok: false, reason: 'wrong_credentials' };
    if (code === 'auth/too-many-requests') return { ok: false, reason: 'locked' };
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const { account, expired } = await callStaffFunction<Record<string, never>, { account: StaffAccountProfile; expired: boolean }>(
      'getMyStaffProfile',
      {}
    );
    if (expired) {
      await signOutStaff().catch(() => {});
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, user: staffProfileToUserProfile(account), mustChangePassword: account.mustChangePassword };
  } catch (e) {
    await signOutStaff().catch(() => {});
    return { ok: false, reason: staffErrorCode(e) === 'functions/not-found' ? 'not_provisioned' : 'unavailable' };
  }
}

/**
 * Remplace le mot de passe temporaire, puis rouvre la session avec le
 * nouveau (le serveur révoque les sessions après le changement).
 */
export async function changeOwnStaffPassword(username: string, newPassword: string): Promise<void> {
  await callStaffFunction<{ newPassword: string }, { ok: true }>('changeMyStaffPassword', { newPassword });
  await signInStaff(staffAuthEmail(username, getPhase4Config().projectId), newPassword);
}

/** Recharge l'annuaire du personnel depuis Firebase dans storage.ts. Renvoie le nombre de comptes, ou `null` si indisponible. */
export async function syncStaffDirectory(): Promise<number | null> {
  if (!isStaffAuthConfigured()) return null;
  try {
    const { accounts } = await callStaffFunction<Record<string, never>, { accounts: StaffAccountProfile[] }>('listStaffDirectory', {});
    storage.replaceFirebaseDirectory(accounts.map(staffProfileToUserProfile));
    return accounts.length;
  } catch {
    return null;
  }
}

/** Rôle du compte Firebase actuellement connecté dans ce navigateur, ou `null`. */
export async function currentFirebaseStaffRole(): Promise<RoleId | null> {
  if (!isStaffAuthConfigured()) return null;
  const { auth } = getPhase4Firebase();
  if (typeof auth.authStateReady === 'function') await auth.authStateReady();
  const user: FirebaseUser | null = auth.currentUser;
  if (!user) return null;
  const claims = await getStaffClaims(user);
  return isStaffRole(claims?.role) && !(claims as { pwdTemp?: unknown } | null)?.pwdTemp ? claims!.role! : null;
}

/** Vrai si le compte Firebase connecté peut gérer les comptes (permission `users.manage`). */
export async function canManageFirebaseStaffAccounts(): Promise<boolean> {
  const role = await currentFirebaseStaffRole().catch(() => null);
  return role !== null && roleHasPermission(role, 'users.manage');
}

export async function createFirebaseStaffAccount(account: StaffAccountInput): Promise<{ user: UserProfile; tempPassword: string }> {
  const res = await callStaffFunction<{ account: StaffAccountInput }, { account: StaffAccountProfile; tempPassword: string }>(
    'createStaffAccount',
    { account }
  );
  return { user: staffProfileToUserProfile(res.account), tempPassword: res.tempPassword };
}

export async function updateFirebaseStaffAccount(id: string, changes: Partial<StaffAccountInput>): Promise<UserProfile> {
  const res = await callStaffFunction<{ id: string; changes: Partial<StaffAccountInput> }, { account: StaffAccountProfile }>(
    'updateStaffAccount',
    { id, changes }
  );
  return staffProfileToUserProfile(res.account);
}

export async function deleteFirebaseStaffAccount(id: string): Promise<void> {
  await callStaffFunction<{ id: string }, { ok: true }>('deleteStaffAccount', { id });
}

export async function resetFirebaseStaffAccountPassword(id: string): Promise<string> {
  const res = await callStaffFunction<{ id: string }, { tempPassword: string }>('resetStaffAccountPassword', { id });
  return res.tempPassword;
}
