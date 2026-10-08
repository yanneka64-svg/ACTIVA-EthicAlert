/**
 * === AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et
 * enregistrés dans Firebase) ===
 *
 * Cloud Functions de gestion des comptes du personnel. L'écran
 * Administration → Utilisateurs (src/components/admin/UsersTab.tsx) les
 * appelle dès qu'un administrateur est connecté à Firebase : chaque compte
 * créé existe alors réellement dans Firebase Auth (avec son rôle et sa
 * portée en custom claims) et son profil dans Firestore (`staff_users/{uid}`),
 * au lieu de n'exister que dans le navigateur de l'administrateur.
 *
 * Sécurité :
 * - gestion réservée aux rôles qui ont `users.manage` (permissions.ts) ;
 * - mot de passe temporaire généré ici, renvoyé UNE fois à l'administrateur,
 *   jamais stocké ; claim `pwdTemp` tant qu'il n'est pas changé (les
 *   fonctions métier refusent alors l'accès, voir requireAppUser) ; il
 *   expire après 4 h comme les comptes locaux ;
 * - unicité de l'identifiant garantie par une réservation transactionnelle
 *   (`staff_usernames/{username}`) ;
 * - impossible de supprimer ou rétrograder le dernier administrateur
 *   système actif, ni de supprimer son propre compte ;
 * - chaque action est journalisée dans `audit_logs`.
 *
 * Firestore : base nommée `default` (docs/FIREBASE-SETUP.md), jamais
 * `(default)`. Les collections `staff_users` et `staff_usernames` sont
 * fermées aux clients (firestore.rules) : seul ce module y accède.
 */
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

import { RoleId } from '../../src/domain/caseTypes';
import { roleHasPermission } from '../../src/domain/permissions';
import {
  StaffAccountInput,
  StaffAccountProfile,
  isStaffRole,
  isStaffTempPasswordExpired,
  parseStaffAccountInput,
  staffAuthEmail,
  staffClaimsFor,
  staffScopeFor,
  validateStaffNewPassword,
} from '../../src/domain/staffAccounts';
// === AMÉLIORATION AJOUTÉE (politique de mots de passe Firebase) === mots de
// passe temporaires conformes (majuscule, minuscule, chiffre, caractère spécial).
import { generatePolicyCompliantPassword } from '../../src/services/crypto';

const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'default';
const STAFF_USERS = 'staff_users';
const STAFF_USERNAMES = 'staff_usernames';
/** Changement de mot de passe : la session doit avoir moins de 10 minutes (preuve récente du mot de passe actuel). */
const RECENT_LOGIN_MS = 10 * 60 * 1000;
const TEMP_PASSWORD_LENGTH = 12;

// Appelé à l'exécution seulement : initializeApp() est fait par index.ts,
// qui importe ce module avant de l'appeler.
function db() {
  return getFirestore(DATABASE_ID);
}

function projectId(): string {
  const fromEnv = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (fromEnv) return fromEnv;
  try {
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}') as { projectId?: string };
    if (cfg.projectId) return cfg.projectId;
  } catch {
    // ignore — erreur explicite ci-dessous
  }
  throw new HttpsError('internal', 'Project id unavailable.');
}

interface StaffCaller {
  uid: string;
  role: RoleId;
  name: string;
  authTimeMs: number;
}

/**
 * Identité de l'appelant, lue depuis le jeton vérifié — même source que
 * `requireAppUser` (index.ts). `allowTempPassword` : seules les fonctions
 * de première connexion acceptent un compte au mot de passe temporaire.
 */
function requireStaffCaller(request: CallableRequest, allowTempPassword = false): StaffCaller {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required.');
  const token = request.auth.token as { role?: unknown; pwdTemp?: unknown; name?: unknown; email?: string; auth_time?: number };
  if (!isStaffRole(token.role)) {
    throw new HttpsError('permission-denied', 'This account has no ACTIVA Hotline role assigned.');
  }
  if (token.pwdTemp === true && !allowTempPassword) {
    throw new HttpsError('failed-precondition', 'Password change required.');
  }
  return {
    uid: request.auth.uid,
    role: token.role,
    name: typeof token.name === 'string' && token.name ? token.name : token.email ?? request.auth.uid,
    authTimeMs: (token.auth_time ?? 0) * 1000,
  };
}

function requireUserManager(request: CallableRequest): StaffCaller {
  const caller = requireStaffCaller(request);
  if (!roleHasPermission(caller.role, 'users.manage')) {
    throw new HttpsError('permission-denied', 'Not authorized (users.manage).');
  }
  return caller;
}

async function auditStaff(actor: StaffCaller | { uid: string }, action: string, objectId: string, details: Record<string, unknown>) {
  const id = `audv2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db()
    .collection('audit_logs')
    .doc(id)
    .set({ id, actorId: actor.uid, action, objectType: 'staff_account', objectId, newValue: details, timestamp: new Date().toISOString() });
}

function profileFromData(id: string, data: FirebaseFirestore.DocumentData): StaffAccountProfile {
  return {
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    username: String(data.username ?? ''),
    role: data.role as RoleId,
    roleTitle: String(data.roleTitle ?? ''),
    entity: String(data.entity ?? ''),
    country: String(data.country ?? ''),
    countries: Array.isArray(data.countries) ? data.countries : [],
    entities: Array.isArray(data.entities) ? data.entities : [],
    active: data.active !== false,
    mustChangePassword: data.mustChangePassword === true,
    passwordSetAt: String(data.passwordSetAt ?? ''),
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  };
}

async function loadProfile(id: unknown): Promise<StaffAccountProfile> {
  if (typeof id !== 'string' || !id || id.length > 128) throw new HttpsError('invalid-argument', 'Invalid account id.');
  const snap = await db().collection(STAFF_USERS).doc(id).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Staff account not found.');
  return profileFromData(snap.id, snap.data() ?? {});
}

/** Refuse de retirer le dernier administrateur système actif. */
async function assertAnotherActiveSystemAdmin(excludingId: string): Promise<void> {
  const snap = await db().collection(STAFF_USERS).where('role', '==', 'system_admin').get();
  const others = snap.docs.filter((d) => d.id !== excludingId && d.data().active !== false);
  if (others.length === 0) {
    throw new HttpsError('failed-precondition', 'This is the last active system administrator.');
  }
}

/** Réserve un identifiant (échoue s'il est déjà pris). */
async function reserveUsername(username: string, reservedBy: string): Promise<FirebaseFirestore.DocumentReference> {
  const ref = db().collection(STAFF_USERNAMES).doc(username);
  try {
    await ref.create({ uid: null, reservedAt: new Date().toISOString(), reservedBy });
  } catch {
    throw new HttpsError('already-exists', `Username "${username}" is already used by another account.`);
  }
  return ref;
}

function authError(e: unknown): HttpsError {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/email-already-exists') return new HttpsError('already-exists', 'This username is already used by another account.');
  if (code === 'auth/user-not-found') return new HttpsError('not-found', 'Staff account not found.');
  return new HttpsError('internal', 'Firebase Auth operation failed.');
}

/** Crée un compte : Firebase Auth + claims + profil Firestore. Renvoie le mot de passe temporaire une seule fois. */
export const createStaffAccount = onCall(async (request) => {
  const caller = requireUserManager(request);
  const parsed = parseStaffAccountInput((request.data as { account?: unknown } | undefined)?.account);
  if (parsed.ok === false) throw new HttpsError('invalid-argument', parsed.error);
  const raw = parsed.value as StaffAccountInput;
  const input: StaffAccountInput = {
    ...raw,
    roleTitle: raw.roleTitle || raw.role,
    entity: raw.entity || 'Toutes entités',
    country: raw.country || 'Groupe ACTIVA',
  };

  const usernameRef = await reserveUsername(input.username, caller.uid);
  const tempPassword = generatePolicyCompliantPassword(TEMP_PASSWORD_LENGTH);
  let uid: string;
  try {
    const created = await getAuth().createUser({
      email: staffAuthEmail(input.username, projectId()),
      emailVerified: true,
      password: tempPassword,
      displayName: input.name,
    });
    uid = created.uid;
  } catch (e) {
    await usernameRef.delete().catch(() => {});
    throw authError(e);
  }

  const now = new Date().toISOString();
  const scope = staffScopeFor(input.role, input.country, input.entity);
  const account: StaffAccountProfile = {
    ...input,
    id: uid,
    ...scope,
    active: true,
    mustChangePassword: true,
    passwordSetAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await getAuth().setCustomUserClaims(uid, staffClaimsFor(input.role, input.country, input.entity, true));
  await db().collection(STAFF_USERS).doc(uid).set({ ...account, createdBy: caller.uid });
  await usernameRef.set({ uid }, { merge: true });
  await auditStaff(caller, 'STAFF_ACCOUNT_CREATED', uid, { username: input.username, role: input.role, ...scope });
  return { account, tempPassword };
});

/** Modifie un compte (nom, e-mail, identifiant, rôle, poste, entité, pays). Ne touche jamais au mot de passe. */
export const updateStaffAccount = onCall(async (request) => {
  const caller = requireUserManager(request);
  const data = (request.data ?? {}) as { id?: unknown; changes?: unknown };
  const current = await loadProfile(data.id);
  const parsed = parseStaffAccountInput(data.changes, true);
  if (parsed.ok === false) throw new HttpsError('invalid-argument', parsed.error);
  const changes = parsed.value;

  if (current.role === 'system_admin' && changes.role && changes.role !== 'system_admin') {
    await assertAnotherActiveSystemAdmin(current.id);
  }

  const next: StaffAccountProfile = { ...current, ...changes, updatedAt: new Date().toISOString() };
  next.roleTitle = next.roleTitle || next.role;
  next.entity = next.entity || 'Toutes entités';
  next.country = next.country || 'Groupe ACTIVA';
  const scope = staffScopeFor(next.role, next.country, next.entity);
  next.countries = scope.countries;
  next.entities = scope.entities;

  const usernameChanged = next.username !== current.username;
  const newUsernameRef = usernameChanged ? await reserveUsername(next.username, caller.uid) : null;
  try {
    await getAuth().updateUser(current.id, {
      displayName: next.name,
      ...(usernameChanged ? { email: staffAuthEmail(next.username, projectId()) } : {}),
    });
  } catch (e) {
    if (newUsernameRef) await newUsernameRef.delete().catch(() => {});
    throw authError(e);
  }
  if (newUsernameRef) {
    await newUsernameRef.set({ uid: current.id }, { merge: true });
    await db().collection(STAFF_USERNAMES).doc(current.username).delete().catch(() => {});
  }

  await getAuth().setCustomUserClaims(current.id, staffClaimsFor(next.role, next.country, next.entity, next.mustChangePassword));
  const rightsChanged =
    next.role !== current.role ||
    JSON.stringify(scope) !== JSON.stringify({ countries: current.countries, entities: current.entities });
  // Les sessions ouvertes gardent leurs anciens droits jusqu'à l'expiration
  // de leur jeton (1 h au plus) : les révoquer force une reconnexion.
  if (rightsChanged) await getAuth().revokeRefreshTokens(current.id);

  await db().collection(STAFF_USERS).doc(current.id).set({ ...next, updatedBy: caller.uid }, { merge: true });
  await auditStaff(caller, 'STAFF_ACCOUNT_UPDATED', current.id, { fields: Object.keys(changes), role: next.role, ...scope });
  return { account: next };
});

/** Supprime un compte (Firebase Auth + profil + réservation d'identifiant). */
export const deleteStaffAccount = onCall(async (request) => {
  const caller = requireUserManager(request);
  const current = await loadProfile((request.data as { id?: unknown } | undefined)?.id);
  if (current.id === caller.uid) throw new HttpsError('failed-precondition', 'You cannot delete your own account.');
  if (current.role === 'system_admin' && current.active) await assertAnotherActiveSystemAdmin(current.id);

  await getAuth()
    .deleteUser(current.id)
    .catch((e: unknown) => {
      if ((e as { code?: string })?.code !== 'auth/user-not-found') throw authError(e);
    });
  await db().collection(STAFF_USERS).doc(current.id).delete();
  await db().collection(STAFF_USERNAMES).doc(current.username).delete().catch(() => {});
  await auditStaff(caller, 'STAFF_ACCOUNT_DELETED', current.id, { username: current.username, role: current.role });
  return { ok: true };
});

/** Régénère un mot de passe temporaire (4 h), à changer à la prochaine connexion. */
export const resetStaffAccountPassword = onCall(async (request) => {
  const caller = requireUserManager(request);
  const current = await loadProfile((request.data as { id?: unknown } | undefined)?.id);
  const tempPassword = generatePolicyCompliantPassword(TEMP_PASSWORD_LENGTH);
  await getAuth().updateUser(current.id, { password: tempPassword }).catch((e: unknown) => {
    throw authError(e);
  });
  await getAuth().setCustomUserClaims(current.id, staffClaimsFor(current.role, current.country, current.entity, true));
  await getAuth().revokeRefreshTokens(current.id);
  const now = new Date().toISOString();
  await db().collection(STAFF_USERS).doc(current.id).set({ mustChangePassword: true, passwordSetAt: now, updatedAt: now }, { merge: true });
  await auditStaff(caller, 'STAFF_ACCOUNT_PASSWORD_RESET', current.id, { username: current.username });
  return { tempPassword };
});

// === AMÉLIORATION AJOUTÉE (double authentification du personnel) ===
/**
 * Réinitialise la double authentification d'un compte (téléphone perdu ou
 * changé) : retire l'application enregistrée et ferme ses sessions. Le
 * compte la réactivera à sa prochaine connexion (obligatoire pour les
 * administrateurs). Jamais sur son propre compte. Tracé dans la piste d'audit.
 */
export const resetStaffAccountMfa = onCall(async (request) => {
  const caller = requireUserManager(request);
  const current = await loadProfile((request.data as { id?: unknown } | undefined)?.id);
  if (current.id === caller.uid) throw new HttpsError('failed-precondition', 'You cannot reset your own two-factor authentication.');
  await getAuth()
    .updateUser(current.id, { multiFactor: { enrolledFactors: null } })
    .catch((e: unknown) => {
      throw authError(e);
    });
  await getAuth().revokeRefreshTokens(current.id);
  await auditStaff(caller, 'STAFF_ACCOUNT_MFA_RESET', current.id, { username: current.username });
  return { ok: true };
});

/**
 * Annuaire du personnel, pour tout compte du personnel connecté (listes
 * d'attribution, destinataires des notifications, écran Utilisateurs).
 * Aucun secret : le profil n'en contient pas.
 */
export const listStaffDirectory = onCall(async (request) => {
  requireStaffCaller(request);
  const snap = await db().collection(STAFF_USERS).limit(2000).get();
  const accounts = snap.docs.map((d) => profileFromData(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
  return { accounts };
});

/** Profil du compte connecté, y compris pendant la première connexion (mot de passe temporaire). */
export const getMyStaffProfile = onCall(async (request) => {
  const caller = requireStaffCaller(request, true);
  const account = await loadProfile(caller.uid);
  const expired = isStaffTempPasswordExpired(account.mustChangePassword, account.passwordSetAt, Date.now());
  return { account, expired };
});

/**
 * Changement de mot de passe par l'utilisateur lui-même (obligatoire après
 * un mot de passe temporaire). Exige une connexion de moins de 10 minutes ;
 * révoque ensuite les sessions : le portail se reconnecte aussitôt avec le
 * nouveau mot de passe.
 */
export const changeMyStaffPassword = onCall(async (request) => {
  const caller = requireStaffCaller(request, true);
  if (Date.now() - caller.authTimeMs > RECENT_LOGIN_MS) {
    throw new HttpsError('failed-precondition', 'Recent sign-in required.');
  }
  const account = await loadProfile(caller.uid);
  if (isStaffTempPasswordExpired(account.mustChangePassword, account.passwordSetAt, Date.now())) {
    throw new HttpsError('failed-precondition', 'Temporary password expired.');
  }
  const password = validateStaffNewPassword((request.data as { newPassword?: unknown } | undefined)?.newPassword);
  if (password.ok === false) throw new HttpsError('invalid-argument', password.error);

  await getAuth().updateUser(caller.uid, { password: password.value }).catch((e: unknown) => {
    throw authError(e);
  });
  await getAuth().setCustomUserClaims(caller.uid, staffClaimsFor(account.role, account.country, account.entity, false));
  await getAuth().revokeRefreshTokens(caller.uid);
  const now = new Date().toISOString();
  await db().collection(STAFF_USERS).doc(caller.uid).set({ mustChangePassword: false, passwordSetAt: now, updatedAt: now }, { merge: true });
  await auditStaff(caller, 'STAFF_PASSWORD_CHANGED', caller.uid, {});
  return { ok: true };
});

/** Résout un e-mail de contact (profil Firestore) en UID — utilisé par index.ts pour les attributions et notifications. */
export async function staffUidByContactEmail(email: string): Promise<{ uid: string; active: boolean } | null> {
  const value = email.trim().toLowerCase();
  if (!value) return null;
  const snap = await db().collection(STAFF_USERS).where('email', '==', value).limit(1).get();
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, active: snap.docs[0].data().active !== false };
}
