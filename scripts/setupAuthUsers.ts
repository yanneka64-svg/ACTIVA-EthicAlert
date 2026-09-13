/**
 * ACTIVA Hotline — Phase 3: provision real Firebase Auth accounts
 *
 * Creates one real Firebase Authentication user per staff member already
 * defined in `src/data/activaConfig.ts` (`INITIAL_USERS`), and sets custom
 * claims (`role`, `countries`, `entities`) matching `src/domain/caseTypes.ts`
 * / `src/domain/permissions.ts` — the SAME role/scope model the Firestore
 * Security Rules (see `firestore.rules`) and the future Cloud Functions must
 * agree with. Reporters are explicitly excluded: they never get a Firebase
 * Auth account (see docs/DATABASE.md — they authenticate via case number +
 * access code, not email/password).
 *
 * Idempotent: re-running updates claims on existing accounts rather than
 * erroring, but only prints (and never reuses) a temporary password for
 * accounts it actually creates.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS_PATH=/path/to/key.json npx tsx scripts/setupAuthUsers.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';

import { INITIAL_USERS } from '../src/data/activaConfig';
import { RoleId } from '../src/domain/caseTypes';

// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
// `UserRole` (src/types.ts) est désormais un simple alias de `RoleId` — plus
// besoin de table de correspondance "rôle démo local -> rôle RBAC cible",
// les deux sont maintenant littéralement les mêmes valeurs. Seule
// exclusion : `reporter` n'a jamais de compte Firebase Auth (les lanceurs
// d'alerte s'authentifient par numéro de dossier + code d'accès, pas
// email/mot de passe — voir docs/DATABASE.md).
function roleIdForAuth(role: RoleId): RoleId | null {
  return role === 'reporter' ? null : role;
}

// Roles with group-wide scope (see permissions.ts GLOBAL_VISIBILITY_ROLES /
// ROLE_PERMISSIONS): empty countries/entities arrays mean "no restriction".
const GLOBAL_SCOPE_ROLES: RoleId[] = ['functional_admin', 'darc_compliance', 'consultation', 'executive', 'system_admin'];

function generateTempPassword(): string {
  // 18 random bytes, base64url — comfortably clears typical strong-password
  // policies (length, mixed case, digits, symbols) without relying on a
  // predictable pattern.
  return randomBytes(18).toString('base64url') + 'Aa1!';
}

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH;
  if (!keyPath) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS_PATH to your service account JSON path.');
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const auth = getAuth(app);

  console.log(`--- Provisioning staff Auth accounts in project ${sa.project_id} ---\n`);

  const createdCredentials: Array<{ email: string; password: string; role: RoleId }> = [];

  for (const user of INITIAL_USERS) {
    const roleId = roleIdForAuth(user.role);
    if (!roleId) {
      console.log(`Skipping ${user.email} (role "${user.role}" has no staff Auth mapping — reporters never get an account).`);
      continue;
    }

    const countries = GLOBAL_SCOPE_ROLES.includes(roleId) ? [] : [user.country];
    const entities = GLOBAL_SCOPE_ROLES.includes(roleId) ? [] : [user.entity];

    let uid: string;
    let existed = true;
    try {
      const existing = await auth.getUserByEmail(user.email);
      uid = existing.uid;
    } catch {
      existed = false;
      const password = generateTempPassword();
      const created = await auth.createUser({
        email: user.email,
        password,
        displayName: user.name,
        emailVerified: true,
      });
      uid = created.uid;
      createdCredentials.push({ email: user.email, password, role: roleId });
    }

    await auth.setCustomUserClaims(uid, { role: roleId, countries, entities, legacyRole: user.role });
    console.log(`${existed ? 'Updated claims for' : 'Created'} ${user.email} (uid=${uid}) → role=${roleId} countries=${JSON.stringify(countries)} entities=${JSON.stringify(entities)}`);
  }

  console.log(`\n--- Verification: re-reading claims from Firebase Auth (not from local memory) ---`);
  for (const user of INITIAL_USERS) {
    if (!roleIdForAuth(user.role)) continue;
    const fresh = await auth.getUserByEmail(user.email);
    console.log(` - ${fresh.email}: customClaims = ${JSON.stringify(fresh.customClaims)}`);
  }

  if (createdCredentials.length > 0) {
    console.log(`\n--- Temporary passwords for ${createdCredentials.length} newly created account(s) (shown once, not stored anywhere) ---`);
    createdCredentials.forEach((c) => console.log(` - ${c.email} (${c.role}): ${c.password}`));
    console.log('\nThese are test credentials for a non-production project. Rotate them (Firebase Console → Authentication → reset password, or ask each user to use "forgot password") before any real staff member relies on this account.');
  } else {
    console.log('\nNo new accounts created (all already existed) — no passwords to display.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
