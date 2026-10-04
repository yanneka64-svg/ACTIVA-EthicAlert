/**
 * === AMÉLIORATION AJOUTÉE (comptes du personnel créés depuis le portail et
 * enregistrés dans Firebase) ===
 *
 * Amorçage du PREMIER administrateur système dans Firebase. Les comptes du
 * personnel se créent depuis le portail (Administration → Utilisateurs),
 * mais seulement par un administrateur déjà enregistré dans Firebase :
 * ce script crée ce tout premier compte, une fois. Lancé par le workflow
 * manuel « Bootstrap staff admin » (fédération d'identité, aucune clé).
 *
 * - Refuse s'il existe déjà un administrateur système actif AUTRE que
 *   l'identifiant demandé.
 * - Si l'identifiant demandé est déjà un administrateur système : son mot de
 *   passe est remplacé (recours si le mot de passe est perdu ou expiré).
 * - Mot de passe initial : secret GitHub STAFF_BOOTSTRAP_PASSWORD, jamais
 *   affiché. Il est temporaire : à changer à la première connexion, dans
 *   les 4 heures.
 *
 * Variables : STAFF_ADMIN_NAME, STAFF_ADMIN_EMAIL, STAFF_ADMIN_USERNAME,
 * STAFF_BOOTSTRAP_PASSWORD, GCLOUD_PROJECT (ou PROJECT_ID),
 * FIRESTORE_DATABASE_ID (défaut `default`). Identifiants Google : ADC.
 *
 * Usage : npx tsx scripts/bootstrapStaffAdmin.ts
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import {
  StaffAccountInput,
  parseStaffAccountInput,
  staffAuthEmail,
  staffClaimsFor,
  staffScopeFor,
} from '../src/domain/staffAccounts';

const BOOTSTRAP_PASSWORD_MIN_LENGTH = 12;

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function main() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.PROJECT_ID || fail('GCLOUD_PROJECT is not set.');
  const password = process.env.STAFF_BOOTSTRAP_PASSWORD || '';
  if (password.length < BOOTSTRAP_PASSWORD_MIN_LENGTH || password.length > 128) {
    fail(`Le secret STAFF_BOOTSTRAP_PASSWORD doit contenir entre ${BOOTSTRAP_PASSWORD_MIN_LENGTH} et 128 caractères.`);
  }
  const parsed = parseStaffAccountInput({
    name: process.env.STAFF_ADMIN_NAME,
    email: process.env.STAFF_ADMIN_EMAIL,
    username: process.env.STAFF_ADMIN_USERNAME,
    role: 'system_admin',
    roleTitle: 'Administrateur système',
    entity: '',
    country: '',
  });
  if (parsed.ok === false) fail(parsed.error);
  const input = {
    ...(parsed.value as StaffAccountInput),
    entity: 'Toutes entités',
    country: 'Groupe ACTIVA',
  };

  const app = initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth(app);
  const db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || 'default');

  const admins = await db.collection('staff_users').where('role', '==', 'system_admin').get();
  const activeAdmins = admins.docs.filter((d) => d.data().active !== false);
  const existing = activeAdmins.find((d) => d.data().username === input.username);
  if (activeAdmins.length > 0 && !existing) {
    fail(
      `Un administrateur système actif existe déjà (${activeAdmins.map((d) => d.data().username).join(', ')}). ` +
        'Créez les autres comptes depuis le portail, ou relancez ce workflow avec cet identifiant pour réinitialiser son mot de passe.'
    );
  }

  const now = new Date().toISOString();
  const claims = staffClaimsFor('system_admin', input.country, input.entity, true);

  if (existing) {
    await auth.updateUser(existing.id, { password, displayName: input.name });
    await auth.setCustomUserClaims(existing.id, claims);
    await auth.revokeRefreshTokens(existing.id);
    await existing.ref.set({ mustChangePassword: true, passwordSetAt: now, updatedAt: now }, { merge: true });
    await audit(db, existing.id, 'STAFF_BOOTSTRAP_PASSWORD_RESET', { username: input.username });
    console.log(`Mot de passe de l'administrateur « ${input.username} » réinitialisé (à changer à la prochaine connexion, sous 4 h).`);
    return;
  }

  const usernameRef = db.collection('staff_usernames').doc(input.username);
  try {
    await usernameRef.create({ uid: null, reservedAt: now, reservedBy: 'bootstrap' });
  } catch {
    fail(`L'identifiant « ${input.username} » est déjà utilisé par un autre compte.`);
  }

  let uid: string;
  try {
    const created = await auth.createUser({
      email: staffAuthEmail(input.username, projectId),
      emailVerified: true,
      password,
      displayName: input.name,
    });
    uid = created.uid;
  } catch (e) {
    await usernameRef.delete().catch(() => {});
    fail(`Création du compte Firebase Auth impossible : ${(e as Error).message}`);
  }

  await auth.setCustomUserClaims(uid, claims);
  await db
    .collection('staff_users')
    .doc(uid)
    .set({
      ...input,
      id: uid,
      ...staffScopeFor('system_admin', input.country, input.entity),
      active: true,
      mustChangePassword: true,
      passwordSetAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: 'bootstrap',
    });
  await usernameRef.set({ uid }, { merge: true });
  await audit(db, uid, 'STAFF_ACCOUNT_CREATED', { username: input.username, role: 'system_admin', via: 'bootstrap' });
  console.log(`Administrateur système « ${input.username} » créé dans Firebase (mot de passe à changer à la première connexion, sous 4 h).`);
}

async function audit(db: FirebaseFirestore.Firestore, objectId: string, action: string, details: Record<string, unknown>) {
  const id = `audv2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db
    .collection('audit_logs')
    .doc(id)
    .set({ id, actorId: 'bootstrap', action, objectType: 'staff_account', objectId, newValue: details, timestamp: new Date().toISOString() });
}

main().then(
  () => process.exit(0),
  (err) => fail(`Amorçage impossible : ${(err as Error).message}`)
);
