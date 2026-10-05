/**
 * === AMÉLIORATION AJOUTÉE (notifications e-mail : superviseurs, DARC, DGA, DRH) ===
 * Scénario de bout en bout des notifications e-mail sur les émulateurs
 * Firebase (aucune donnée réelle, aucun e-mail réel) : les Functions envoient
 * vers un faux service (NOTIFY_RESEND_ENDPOINT, functions/.env.local) qui
 * enregistre chaque e-mail dans CAPTURE_FILE. Lancement :
 *   firebase emulators:start --project demo-activa --only auth,firestore,functions
 *   CAPTURE_FILE=/chemin/sent_emails.jsonl npx tsx scripts/e2eEmailNotifications.emulator.mts
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFs } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const CAPTURE = process.env.CAPTURE_FILE || '';
if (!CAPTURE) throw new Error('CAPTURE_FILE requis.');
const admin = adminInit({ projectId: 'demo-activa' });
const db = adminFs(admin, 'default');
const auth = adminAuth(admin);
async function staff(username: string, role: string, email: string, countries: string[] = []) {
  const login = `${username}@notif.test`;
  const u = await auth.createUser({ email: login, password: 'Passw0rd!x' }).catch(() => auth.getUserByEmail(login));
  await auth.setCustomUserClaims(u.uid, { role, countries, entities: [], name: username });
  await db.collection('staff_users').doc(u.uid).set({ name: username, username, email, role, countries, entities: [], active: true });
  return { uid: u.uid, login };
}
const adm = await staff('admin.notif', 'system_admin', 'admin.notif@group-activa.com');
const op = await staff('op.notif', 'functional_admin', 'operateur@group-activa.com');
await staff('sup.cm', 'senior_investigator', 'superviseur.cameroun@group-activa.com', ['Cameroun']);
await staff('sup.gh', 'senior_investigator', 'superviseur.ghana@group-activa.com', ['Ghana']);
await staff('darc', 'darc_compliance', 'darc@group-activa.com');
const inv = await staff('inv.notif', 'investigator', 'enqueteur@group-activa.com');

const app = initializeApp({ projectId: 'demo-activa', apiKey: 'demo', authDomain: 'demo' });
const cAuth = getAuth(app);
connectAuthEmulator(cAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'us-central1');
connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (n: string) => httpsCallable(fns, n);
let failures = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${label}${extra !== undefined ? ' ' + JSON.stringify(extra) : ''}`);
  if (!ok) failures++;
};
const captured = () =>
  readFileSync(CAPTURE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { to: string[]; subject: string; text: string });
const reset = () => writeFileSync(CAPTURE, '');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const to = (mails: { to: string[] }[]) => mails.map((m) => m.to[0]).sort();

// Réglages : DGA et DRH par adresse
await signInWithEmailAndPassword(cAuth, adm.login, 'Passw0rd!x');
const settings = {
  groups: [
    { id: 'supervisors', enabled: true, roles: ['functional_admin', 'senior_investigator'], extraEmails: [], events: { new_report: ['always'], assigned: ['always'], escalated: ['always'], closed: ['always'], reopened: ['always'] } },
    { id: 'darc', enabled: true, roles: ['darc_compliance'], extraEmails: ['boite.darc@group-activa.com'], events: { new_report: ['always'], escalated: ['always'], closed: ['always'], reopened: ['always'] } },
    { id: 'dga', enabled: true, roles: [], extraEmails: ['dga@group-activa.com'], events: { new_report: ['critical', 'senior_implicated'], escalated: ['always'], closed: ['critical', 'senior_implicated'] } },
    { id: 'drh', enabled: true, roles: [], extraEmails: ['drh@group-activa.com'], events: { new_report: ['hr'], closed: ['hr'] } },
  ],
  hrCategories: ['Ressources Humaines et diversité'],
};
await call('savePortalConfig')({ section: 'emailNotifications', value: settings });
reset();
const test = (await call('sendTestNotificationEmail')({ groupId: 'dga' })).data as { results: { email: string; ok: boolean }[] };
check('e-mail d’essai au DGA', test.results.length === 1 && test.results[0].ok && captured()[0]?.to[0] === 'dga@group-activa.com', test.results);
await signOut(cAuth);

// 1. Signalement ordinaire (Cameroun, fraude, priorité élevée)
reset();
const c1 = (await call('createCaseAsReporter')({
  category: 'Fraude, Corruption et pots-de-vin', subcategory: 'Détournement de fonds', country: 'Cameroun', entity: 'ACTIVA Assurances',
  description: 'Test notification ordinaire', reportingMode: 'anonymous', confidentialityLevel: 'confidential', accessCode: 'Demo1234x',
  submissionId: 'sub-n1-' + Date.now(), entityCode: 'AACMR',
  details: { risk: { financialImpact: 2, hierarchicalLevel: 1, recurrence: 1, reputationRisk: 2, totalScore: 6, priority: 'high' } },
})).data as { caseId: string; trackingNumber: string };
await wait(500);
check('nouveau signalement ordinaire : opérateur, superviseur Cameroun, DARC (comptes + boîte) — ni Ghana, ni DGA, ni DRH',
  JSON.stringify(to(captured())) === JSON.stringify(['boite.darc@group-activa.com', 'darc@group-activa.com', 'operateur@group-activa.com', 'superviseur.cameroun@group-activa.com']),
  to(captured()));
const mail = captured()[0];
check('contenu : référence et lien, aucun détail des faits', mail.subject.includes(c1.trackingNumber) && mail.text.includes(`https://portail-test.example/cases/${c1.trackingNumber}`) && !mail.text.includes('Test notification ordinaire'));

// 2. Signalement RH, critique, directeur mis en cause
reset();
const c2 = (await call('createCaseAsReporter')({
  category: 'Ressources Humaines et diversité', subcategory: 'Harcèlement moral ou sexuel', country: 'Cameroun', entity: 'ACTIVA Assurances',
  description: 'Test notification RH', reportingMode: 'anonymous', confidentialityLevel: 'confidential', accessCode: 'Demo1234x',
  submissionId: 'sub-n2-' + Date.now(), entityCode: 'AACMR',
  details: {
    risk: { financialImpact: 4, hierarchicalLevel: 4, recurrence: 4, reputationRisk: 4, totalScore: 16, priority: 'critical' },
    persons: [{ kind: 'subject', name: 'Directeur X', hierarchyLevel: 'director_plus' }],
  },
})).data as { caseId: string; trackingNumber: string };
await wait(500);
const m2 = captured();
check('dossier RH critique avec directeur mis en cause : DGA et DRH prévenus en plus', ['dga@group-activa.com', 'drh@group-activa.com'].every((e) => to(m2).includes(e)), to(m2));
check('motif indiqué au DGA', m2.find((m) => m.to[0] === 'dga@group-activa.com')!.text.includes('motif'));
check('aucun nom de personne mise en cause dans les e-mails', m2.every((m) => !m.text.includes('Directeur X')));

// 3. Attribution par l'opérateur → superviseurs (sans l'opérateur lui-même)
reset();
await signInWithEmailAndPassword(cAuth, op.login, 'Passw0rd!x');
await call('applyPortalUpdate')({ caseId: c2.caseId, patch: { assignedInvestigators: [inv.uid], portal: { status: 'investigation' } } });
await wait(500);
check('attribution : superviseur Cameroun prévenu, pas l’auteur de l’action', to(captured()).includes('superviseur.cameroun@group-activa.com') && !to(captured()).includes('operateur@group-activa.com'), to(captured()));

// 4. Escalade → superviseurs, DARC, DGA
reset();
await call('applyPortalUpdate')({ caseId: c2.caseId, patch: { portal: { escalatedAt: new Date().toISOString(), escalatedReason: 'Gravité' } } });
await wait(500);
check('escalade : DGA et DARC prévenus', ['dga@group-activa.com', 'darc@group-activa.com'].every((e) => to(captured()).includes(e)), to(captured()));

// 5. Clôture → superviseurs, DARC, DGA (critique), DRH (RH)
reset();
await call('applyPortalUpdate')({ caseId: c2.caseId, patch: { portal: { status: 'closed', workflowStatus: 'closed', closureSummary: 'Faits établis' } } });
await wait(500);
check('clôture : DARC, DGA et DRH prévenus', ['darc@group-activa.com', 'dga@group-activa.com', 'drh@group-activa.com'].every((e) => to(captured()).includes(e)), to(captured()));
check('objet « Dossier clôturé »', captured().every((m) => m.subject.includes('Dossier clôturé')));

const audit = (await db.collection('audit_logs').where('caseId', '==', c2.caseId).get()).docs.map((d) => d.data().action).filter((a) => a.startsWith('EMAIL_'));
check('chaque envoi est inscrit dans la piste d’audit', audit.length >= 10 && audit.every((a) => a === 'EMAIL_NOTIFICATION_SENT'), audit.length);

console.log(failures ? `${failures} échec(s)` : 'TOUT EST VERT');
process.exit(failures ? 1 : 0);
