/**
 * ACTIVA Hotline — Phase 3: relink legacy assignee ids to real Auth UIDs
 *
 * `scripts/seedFirestore.ts` (Phase 2b) ran before `scripts/setupAuthUsers.ts`
 * (Phase 3) existed, so the migrated `Case.assignee` / `additionalInvestigators`
 * fields still hold the legacy demo ids from `src/data/activaConfig.ts`
 * (e.g. "usr-investigator-1") instead of real Firebase Auth UIDs. Since the
 * Security Rules deployed in this phase check `request.auth.uid ==
 * kase.assignee`, that mismatch silently breaks "an investigator can read
 * their own assigned case" — caught by a live rules test, not assumed away.
 *
 * This is a one-off data fix-up, safe to re-run (idempotent: a uid that's
 * already a real Auth uid — i.e. matches an existing user — is left as-is).
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

import { INITIAL_USERS } from '../src/data/activaConfig';

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH;
  if (!keyPath) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS_PATH.');
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const auth = getAuth(app);
  const db = getFirestore(app, process.env.FIRESTORE_DATABASE_ID || 'default');

  console.log('--- Building legacy id → real Auth UID map ---');
  const legacyIdToUid = new Map<string, string>();
  for (const user of INITIAL_USERS) {
    try {
      const record = await auth.getUserByEmail(user.email);
      legacyIdToUid.set(user.id, record.uid);
      console.log(`  ${user.id} (${user.email}) -> ${record.uid}`);
    } catch {
      console.log(`  ${user.id} (${user.email}) -> no Auth account found, skipping`);
    }
  }

  console.log('\n--- Relinking case assignments ---');
  const snap = await db.collection('cases').get();
  for (const doc of snap.docs) {
    const kase = doc.data();
    let changed = false;
    const update: Record<string, unknown> = {};

    if (kase.assignee && legacyIdToUid.has(kase.assignee)) {
      update.assignee = legacyIdToUid.get(kase.assignee);
      changed = true;
    }
    if (Array.isArray(kase.additionalInvestigators)) {
      const remapped = kase.additionalInvestigators.map((id: string) => legacyIdToUid.get(id) ?? id);
      if (JSON.stringify(remapped) !== JSON.stringify(kase.additionalInvestigators)) {
        update.additionalInvestigators = remapped;
        changed = true;
      }
    }

    if (changed) {
      await doc.ref.update(update);
      console.log(`  ${doc.id} (${kase.caseNumber}): assignee ${kase.assignee} -> ${update.assignee ?? kase.assignee}`);
    } else {
      console.log(`  ${doc.id} (${kase.caseNumber}): no change needed`);
    }
  }

  console.log('\nOK — relinking complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Relink failed:', err);
  process.exit(1);
});
