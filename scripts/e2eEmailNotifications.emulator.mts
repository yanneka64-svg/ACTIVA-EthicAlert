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
async function staff(username: string, role: string, email: string, countries: string[] = [], name = username) {
  const login = `${username}@notif.test`;
  const u = await auth.createUser({ email: login, password: 'Passw0rd!x' }).catch(() => auth.getUserByEmail(login));
  await auth.setCustomUserClaims(u.uid, { role, countries, entities: [], name });
  await db.collection('staff_users').doc(u.uid).set({ name, username, email, role, countries, entities: [], active: true });
  return { uid: u.uid, login };
}
const adm = await staff('admin.notif', 'system_admin', 'admin.notif@group-activa.com');
const op = await staff('op.notif', 'functional_admin', 'operateur@group-activa.com');
const supCm = await staff('sup.cm', 'senior_investigator', 'superviseur.cameroun@group-activa.com', ['Cameroun']);
await staff('sup.gh', 'senior_investigator', 'superviseur.ghana@group-activa.com', ['Ghana']);
const darcAcc = await staff('darc', 'darc_compliance', 'darc@group-activa.com');
const inv = await staff('inv.notif', 'investigator', 'enqueteur@group-activa.com', [], 'Jean-Paul Mbarga');

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

// === AMÉLIORATION AJOUTÉE (acheminement selon la personne mise en cause) ===
const report = async (tag: string, persons: unknown[]) =>
  (await call('createCaseAsReporter')({
    category: 'Fraude, Corruption et pots-de-vin', subcategory: 'Détournement de fonds', country: 'Cameroun', entity: 'ACTIVA Assurances',
    description: 'Test acheminement ' + tag, reportingMode: 'anonymous', confidentialityLevel: 'confidential', accessCode: 'Demo1234x',
    submissionId: `sub-${tag}-` + Date.now(), entityCode: 'AACMR',
    details: { risk: { financialImpact: 2, hierarchicalLevel: 1, recurrence: 1, reputationRisk: 2, totalScore: 6, priority: 'high' }, persons },
  })).data as { caseId: string; trackingNumber: string };
await signOut(cAuth);

// 6. Un enquêteur est mis en cause (nommé, sans accents) → directement à la DARC
reset();
const c6 = await report('inv', [{ kind: 'subject', name: 'jean paul MBARGA', position: 'Agent' }]);
await wait(500);
check('enquêteur mis en cause : DARC seule (ni superviseurs, ni l’enquêteur)',
  JSON.stringify(to(captured())) === JSON.stringify(['boite.darc@group-activa.com', 'darc@group-activa.com']), to(captured()));
const c6doc = (await db.collection('cases').doc(c6.caseId).get()).data()!;
const p6 = (await db.collection('cases').doc(c6.caseId).collection('persons').get()).docs.map((d) => d.data());
check('enquêteur rattaché automatiquement et écarté du dossier', (c6doc.implicatedUserIds ?? []).includes(inv.uid) && p6.some((p) => p.linkedUserId === inv.uid), c6doc.implicatedUserIds);
// même si on tente de lui attribuer le dossier, il ne peut pas l'ouvrir
await signInWithEmailAndPassword(cAuth, op.login, 'Passw0rd!x');
await call('applyPortalUpdate')({ caseId: c6.caseId, patch: { assignedInvestigators: [inv.uid] } }).catch(() => undefined);
await signOut(cAuth);
await signInWithEmailAndPassword(cAuth, inv.login, 'Passw0rd!x');
const seen = ((await call('getCaseDetails')({ caseIds: [c6.caseId] })).data as { details?: unknown[] }).details ?? [];
check('l’enquêteur mis en cause ne peut pas ouvrir le dossier', seen.length === 0, seen.length);
await signOut(cAuth);

// 7. La DARC est mise en cause (par sa fonction) → DGA et DRH
reset();
const c7 = await report('darc', [{ kind: 'subject', name: 'Inconnu', position: 'Directeur Audit, Risques et Conformité' }]);
await wait(500);
const m7 = captured();
check('DARC mise en cause : DGA et DRH uniquement', JSON.stringify(to(m7)) === JSON.stringify(['dga@group-activa.com', 'drh@group-activa.com']), to(m7));
check('motif « escalade automatique » indiqué', m7.every((m) => m.text.includes('escalade automatique')));

// 8. Un superviseur est mis en cause → DARC (pas de superviseur)
reset();
const c8 = await report('sup', [{ kind: 'subject', name: 'X', position: 'Superviseur régional' }]);
await wait(500);
check('superviseur mis en cause : DARC seule', JSON.stringify(to(captured())) === JSON.stringify(['boite.darc@group-activa.com', 'darc@group-activa.com']), to(captured()));

// === AMÉLIORATION AJOUTÉE (escalade respectée sur le portail) ===
// Le niveau mis en cause par sa fonction perd aussi l'accès au dossier.
const canOpen = async (who: { login: string }, caseId: string) => {
  await signInWithEmailAndPassword(cAuth, who.login, 'Passw0rd!x');
  const details = ((await call('getCaseDetails')({ caseIds: [caseId] })).data as { details?: unknown[] }).details ?? [];
  const list = ((await call('listCases')({})).data as { items?: { caseId: string }[] }).items ?? [];
  await signOut(cAuth);
  return { open: details.length > 0, listed: list.some((c) => c.caseId === caseId) };
};
const sup8 = await canOpen(supCm, c8.caseId);
const op8 = await canOpen(op, c8.caseId);
const darc8 = await canOpen(darcAcc, c8.caseId);
check('superviseur cité par sa fonction : aucun superviseur ne voit ni n’ouvre le dossier', !sup8.open && !sup8.listed && !op8.open && !op8.listed, { sup8, op8 });
check('superviseur cité par sa fonction : la DARC voit et ouvre le dossier', darc8.open && darc8.listed, darc8);
const darc7 = await canOpen(darcAcc, c7.caseId);
const sup7 = await canOpen(supCm, c7.caseId);
check('DARC citée par sa fonction : le compte DARC ne voit ni n’ouvre le dossier', !darc7.open && !darc7.listed, darc7);
// === AMÉLIORATION AJOUTÉE (niveaux inférieurs écartés) === une alerte sur la
// DARC n'est vue que par les niveaux qui la reçoivent (DGA, DRH).
const op7 = await canOpen(op, c7.caseId);
check('DARC citée par sa fonction : aucun superviseur ne voit ni n’ouvre le dossier', !sup7.open && !sup7.listed && !op7.open && !op7.listed, { sup7, op7 });
const sup6 = await canOpen(supCm, c6.caseId);
const darc6 = await canOpen(darcAcc, c6.caseId);
check('enquêteur mis en cause : seule la DARC voit le dossier (superviseurs écartés)', !sup6.open && !sup6.listed && darc6.open && darc6.listed, { sup6, darc6 });
const a8 = (await db.collection('audit_logs').where('caseId', '==', c8.caseId).where('action', '==', 'ESCALATION_ACCESS_RESTRICTED').get()).docs;
check('restriction d’accès inscrite dans la piste d’audit (sans nom)', a8.length === 1 && !JSON.stringify(a8[0].data()).includes('Superviseur régional'), a8.map((d) => d.data().newValue));

console.log(failures ? `${failures} échec(s)` : 'TOUT EST VERT');
process.exit(failures ? 1 : 0);
