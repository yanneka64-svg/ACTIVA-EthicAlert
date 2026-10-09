/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
 * Scénario de bout en bout de `applyPortalUpdate` sur les émulateurs Firebase
 * (aucune donnée réelle). Lancement :
 *   firebase emulators:start --project demo-activa --only auth,firestore,functions
 *   npx tsx scripts/e2ePortalUpdate.emulator.mts
 */
// Scénario de bout en bout sur émulateurs (aucune donnée réelle).
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFs } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const admin = adminInit({ projectId: 'demo-activa' });
const db = adminFs(admin, 'default');
const auth = adminAuth(admin);

async function user(email: string, role: string) {
  const u = await auth.createUser({ email, password: 'Passw0rd!x' }).catch(() => auth.getUserByEmail(email));
  await auth.setCustomUserClaims(u.uid, { role, countries: [], entities: [] });
  return u.uid;
}
const opUid = await user('op@demo.test', 'functional_admin');
const invUid = await user('inv@demo.test', 'senior_investigator');
const inv2Uid = await user('inv2@demo.test', 'investigator');
const inv3Uid = await user('inv3@demo.test', 'investigator');

const caseId = 'case-e2e-' + Date.now();
const now = new Date().toISOString();
await db.collection('cases').doc(caseId).set({
  caseId, caseNumber: 'CASE-2026-009999', externalReference: 'AIIG-26-10-0099', status: 'new',
  category: 'Fraude', subcategory: 'x', country: 'Ghana', entity: 'ACTIVA International Ghana', reportingMode: 'anonymous',
  priority: 'high', riskScore: 7, confidentialityLevel: 'confidential', additionalInvestigators: [], implicatedUserIds: [],
  slaStatus: 'on_track', receivedAt: now, incidentDateUnknown: true, description: 'test', createdAt: now, createdBy: 'reporter', updatedAt: now, updatedBy: 'reporter',
});
await db.collection('cases').doc(caseId).collection('tasks').doc('tsk-local-1').set({ taskId: 'tsk-local-1', caseId, title: 'T', owner: invUid, priority: 'high', dueDate: '2026-10-20', status: 'not_started', createdAt: now, createdBy: opUid, updatedAt: now, updatedBy: opUid });
await db.collection('cases').doc(caseId).collection('persons').doc('per-local-1').set({ personId: 'per-local-1', caseId, kind: 'subject', name: 'P', createdAt: now, createdBy: opUid, updatedAt: now, updatedBy: opUid });

const app = initializeApp({ projectId: 'demo-activa', apiKey: 'demo', authDomain: 'demo' });
const cAuth = getAuth(app);
connectAuthEmulator(cAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'us-central1');
connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (name: string) => httpsCallable(fns, name);

let failures = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${label}${extra !== undefined ? ' ' + JSON.stringify(extra) : ''}`);
  if (!ok) failures++;
};

// 1. Opérateur : attribution + clôture + tâche + rattachement
await signInWithEmailAndPassword(cAuth, 'op@demo.test', 'Passw0rd!x');
const r1 = (await call('applyPortalUpdate')({
  caseId,
  patch: {
    assignedInvestigators: [invUid, inv3Uid],
    portal: { status: 'closed', workflowStatus: 'closed', closureSummary: 'Faits établis', closedAt: now, closedBy: 'Opérateur' },
    taskUpdates: [{ taskId: 'tsk-local-1', status: 'completed', completedAt: now }],
    personLinks: [{ personId: 'per-local-1', linkedUserId: inv2Uid }],
  },
})).data as { applied: string[]; rejected: unknown[] };
check('opérateur : 4 parties appliquées', r1.applied.length === 4 && r1.rejected.length === 0, r1);
const kase = (await db.collection('cases').doc(caseId).get()).data()!;
check('assignee + enquêteur additionnel enregistrés', kase.assignee === invUid && kase.additionalInvestigators?.[0] === inv3Uid);
check('portal.status / closureSummary enregistrés', kase.portal?.status === 'closed' && kase.portal?.closureSummary === 'Faits établis');
check('implicatedUserIds mis à jour', JSON.stringify(kase.implicatedUserIds) === JSON.stringify([inv2Uid]));
check('tâche terminée', (await db.collection('cases').doc(caseId).collection('tasks').doc('tsk-local-1').get()).data()?.status === 'completed');
const audits = await db.collection('audit_logs').where('caseId', '==', caseId).get();
// === AMÉLIORATION AJOUTÉE (test mis à jour) === les envois d'e-mails, ajoutés
// depuis et vérifiés par e2eEmailNotifications, sont exclus de cette comparaison.
const caseActions = audits.docs.map((d) => d.data().action as string).filter((a) => !a.startsWith('EMAIL_NOTIFICATION_'));
check('piste d’audit', caseActions.sort().join(',') === 'CASE_ASSIGNED,PERSON_LINKED_TO_USER,PORTAL_CASE_UPDATED,TASKS_UPDATED', caseActions);

// 2. Champ refusé
try {
  await call('applyPortalUpdate')({ caseId, patch: { portal: { status: 'piraté' } } });
  check('valeur invalide refusée', false);
} catch (e) {
  check('valeur invalide refusée', (e as { code?: string }).code === 'functions/invalid-argument');
}

// 3. Enquêteur : voit le dossier, ne peut pas attribuer
await signOut(cAuth);
await signInWithEmailAndPassword(cAuth, 'inv@demo.test', 'Passw0rd!x');
const list = (await call('listCases')({})).data as { items: { caseId: string; portal?: { status?: string } }[] };
const mine = list.items.find((c) => c.caseId === caseId);
check('l’enquêteur attribué voit le dossier (avec son statut portail)', mine?.portal?.status === 'closed');
await signOut(cAuth);
await signInWithEmailAndPassword(cAuth, 'inv3@demo.test', 'Passw0rd!x');
const r3 = (await call('applyPortalUpdate')({ caseId, patch: { portal: { investigationReport: 'Rapport' }, assignedInvestigators: [opUid] } })).data as { applied: string[]; rejected: { part: string }[] };
check('enquêteur simple : rapport accepté, attribution refusée', r3.applied.join() === 'portal' && r3.rejected[0]?.part === 'assignment', r3);
const reporterView = (await db.collection('cases').doc(caseId).get()).data()!;
check('rapport enregistré, attribution inchangée', reporterView.portal?.investigationReport === 'Rapport' && reporterView.assignee === invUid);

// 4. La personne mise en cause ne voit plus le dossier
await signOut(cAuth);
await signInWithEmailAndPassword(cAuth, 'inv2@demo.test', 'Passw0rd!x');
const list2 = (await call('listCases')({})).data as { items: { caseId: string }[] };
check('la personne rattachée (mise en cause) ne voit pas le dossier', !list2.items.some((c) => c.caseId === caseId));
try {
  await call('applyPortalUpdate')({ caseId, patch: { portal: { investigationReport: 'x' } } });
  check('la personne mise en cause ne peut rien modifier', false);
} catch (e) {
  check('la personne mise en cause ne peut rien modifier', (e as { code?: string }).code === 'functions/permission-denied');
}

console.log(failures ? `${failures} échec(s)` : 'TOUT EST VERT');
process.exit(failures ? 1 : 0);
