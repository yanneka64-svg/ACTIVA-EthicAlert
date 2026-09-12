/**
 * ACTIVA Hotline — one-off Firestore seed script (Phase 2 data activation)
 *
 * Migrates the 3 legacy demo alerts (src/data/activaConfig.ts) into the
 * normalized Case model, for real, in the connected Firebase project.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json FIRESTORE_DATABASE_ID=default \
 *     npx tsx scripts/seedFirestore.ts
 *
 * This script is intentionally NOT wired into `npm run build`/`dev` — it is
 * a manual, explicit action (see docs/FIREBASE-SETUP.md), never something
 * that runs automatically.
 */

import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

import { INITIAL_ALERTS } from '../src/data/activaConfig';
import { migrateLegacyAlertsToCases, MIGRATION_SYSTEM_USER } from '../src/data-access/migrateLegacy';
import { FirestoreAdminCaseRepository } from './firestoreAdminRepository';

async function main() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_PATH;
  const databaseId = process.env.FIRESTORE_DATABASE_ID || undefined;

  const credential = keyPath ? cert(JSON.parse(readFileSync(keyPath, 'utf8'))) : applicationDefault();
  const projectId = keyPath ? JSON.parse(readFileSync(keyPath, 'utf8')).project_id : undefined;

  const app = initializeApp({ credential, projectId });
  const repository = new FirestoreAdminCaseRepository(app, getFirestore, databaseId);

  console.log(`--- Seeding Firestore (project ${projectId ?? '(from ADC)'}, database "${databaseId ?? '(default)'}") ---`);
  console.log(`--- Migrating ${INITIAL_ALERTS.length} legacy demo alerts ---`);

  const results = await migrateLegacyAlertsToCases(INITIAL_ALERTS, repository);

  for (const r of results) {
    const kase = await repository.getCase(r.caseId, MIGRATION_SYSTEM_USER);
    const allegations = await repository.listAllegations(r.caseId);
    const persons = await repository.listPersons(r.caseId);
    const evidence = await repository.listEvidence(r.caseId, MIGRATION_SYSTEM_USER);
    const actions = await repository.listCorrectiveActions(r.caseId);
    const timeline = await repository.getTimeline(r.caseId);
    const comms = await repository.listCommunications(r.caseId);
    const notes = await repository.listInvestigationNotes(r.caseId, MIGRATION_SYSTEM_USER);
    console.log(
      `${r.legacyTrackingNumber} -> ${r.caseNumber} (docId ${r.caseId}) | status=${kase?.status} priority=${kase?.priority} riskScore=${kase?.riskScore} | ` +
        `allegations=${allegations.length} persons=${persons.length} evidence=${evidence.length} correctiveActions=${actions.length} communications=${comms.length} notes=${notes.length} timelineEvents=${timeline.length}`
    );
    if (r.warnings.length) r.warnings.forEach((w) => console.log('  ⚠', w));
  }

  const allAudit = await repository.listAuditEvents();
  console.log(`\nTotal audit_logs entries written: ${allAudit.length}`);
  console.log('\nOK — Firestore seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
