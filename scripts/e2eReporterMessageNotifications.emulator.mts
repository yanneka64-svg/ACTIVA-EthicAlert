/**
 * === AMÉLIORATION AJOUTÉE (message du déclarant) ===
 * Scénario sur émulateurs (aucune donnée ni e-mail réels) : quand le déclarant
 * écrit depuis son espace de suivi,
 * - dossier non attribué → les opérateurs sont prévenus (jamais un enquêteur) ;
 * - dossier attribué → l'enquêteur attribué, et lui seul ;
 * - messages successifs → un e-mail au plus toutes les 10 minutes ;
 * - l'opérateur lit tout l'historique des échanges ; un enquêteur non attribué n'y a pas accès.
 * Les Functions envoient vers un faux service (NOTIFY_RESEND_ENDPOINT,
 * functions/.env.local) qui enregistre chaque e-mail dans CAPTURE_FILE.
 *   firebase emulators:start --project demo-activa --only auth,firestore,functions
 *   CAPTURE_FILE=/chemin/sent.jsonl npx tsx scripts/e2eReporterMessageNotifications.emulator.mts
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
const stamp = Date.now().toString(36);
async function staff(username: string, role: string, email: string, countries: string[] = []) {
  const login = `${username}.${stamp}@msg.test`;
  const u = await auth.createUser({ email: login, password: 'Passw0rd!x' });
  await auth.setCustomUserClaims(u.uid, { role, countries, entities: [], name: username });
  await db.collection('staff_users').doc(u.uid).set({ name: username, username, email, role, countries, entities: [], active: true });
  return { uid: u.uid, login };
}
// Base propre : seuls les comptes de ce scénario.
for (const d of (await db.collection('staff_users').get()).docs) await d.ref.delete();
const op = await staff('Awa Operatrice', 'functional_admin', 'operatrice@group-activa.com');
await staff('Paul Responsable', 'senior_investigator', 'responsable@group-activa.com', ['Cameroun']);
await staff('Kofi Ghana', 'senior_investigator', 'responsable.ghana@group-activa.com', ['Ghana']);
const inv1 = await staff('Jean Enqueteur', 'investigator', 'enqueteur1@group-activa.com');
const inv2 = await staff('Marie Enqueteuse', 'investigator', 'enqueteur2@group-activa.com');
await staff('Lea Consultation', 'consultation', 'consultation@group-activa.com');

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
const sent = () => readFileSync(CAPTURE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { to: string[]; subject: string; text: string });
const reset = () => writeFileSync(CAPTURE, '');
const recipients = () => sent().map((m) => m.to[0]).sort();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Dépôt public (Cameroun), puis session du déclarant.
const created = (await call('createCaseAsReporter')({
  category: 'Fraude', country: 'Cameroun', entity: 'ACTIVA Assurances', description: 'Test e2e message',
  reportingMode: 'anonymous', confidentialityLevel: 'confidential', entityCode: 'AACMR', submissionId: `sub-msg-${stamp}`, accessCode: 'CodeMsg12345',
})).data as { caseId: string; trackingNumber: string };
const session = ((await call('getCaseForReporter')({ caseNumber: created.trackingNumber, accessCode: 'CodeMsg12345' })).data as { sessionToken: string }).sessionToken;
await wait(500);
reset();

// 1. Dossier non attribué : les opérateurs de son périmètre.
await call('addCommunicationAsReporter')({ sessionToken: session, content: 'Premier message (secret)' });
await wait(500);
check('non attribué → opérateurs du périmètre (jamais un enquêteur ni la consultation)',
  JSON.stringify(recipients()) === JSON.stringify(['operatrice@group-activa.com', 'responsable@group-activa.com']), recipients());
check('objet de l’e-mail', sent()[0]?.subject === `Nouveau message du déclarant — ${created.trackingNumber}`, sent()[0]?.subject);
check('le contenu du message n’est jamais dans l’e-mail', sent().every((m) => !m.text.includes('secret')));

// 2. Message suivant tout de suite : pas de nouvel e-mail.
reset();
await call('addCommunicationAsReporter')({ sessionToken: session, content: 'Deuxième message' });
await wait(500);
check('messages successifs → un e-mail au plus toutes les 10 minutes', sent().length === 0, recipients());

// 3. Attribution à inv1, puis message (délai remis à zéro pour le test).
await signInWithEmailAndPassword(cAuth, op.login, 'Passw0rd!x');
await call('assignCase')({ caseId: created.caseId, assignee: inv1.uid });
await signOut(cAuth);
await db.collection('cases').doc(created.caseId).collection('notifications').doc('reporter_message').delete();
await wait(500);
reset();
await call('addCommunicationAsReporter')({ sessionToken: session, content: 'Troisième message' });
await wait(500);
check('attribué → l’enquêteur attribué, et lui seul', JSON.stringify(recipients()) === JSON.stringify(['enqueteur1@group-activa.com']), recipients());
check('e-mail personnalisé à l’enquêteur', (sent()[0]?.text ?? '').startsWith('Bonjour Jean,'));

// 4. Historique des échanges.
await signInWithEmailAndPassword(cAuth, op.login, 'Passw0rd!x');
const opView = (await call('staffConversation')({ caseId: created.caseId })).data as { communications: { sender: string }[] };
await signOut(cAuth);
check('l’opérateur lit tout l’historique', opView.communications.filter((c) => c.sender === 'reporter').length === 3, opView.communications.length);
await signInWithEmailAndPassword(cAuth, inv1.login, 'Passw0rd!x');
const invView = (await call('staffConversation')({ caseId: created.caseId })).data as { communications: unknown[] };
await signOut(cAuth);
check('l’enquêteur attribué lit l’historique', invView.communications.length >= 3);
await signInWithEmailAndPassword(cAuth, inv2.login, 'Passw0rd!x');
const denied = await call('staffConversation')({ caseId: created.caseId }).then(() => false, () => true);
await signOut(cAuth);
check('un enquêteur non attribué n’y a pas accès', denied);

// 5. Piste d'audit.
const audit = await db.collection('audit_logs').where('caseId', '==', created.caseId).where('action', '==', 'EMAIL_NOTIFICATION_SENT').get();
const msgAudit = audit.docs.map((d) => d.data()).filter((a) => a.newValue?.event === 'reporter_message');
check('chaque envoi est dans la piste d’audit', msgAudit.length === 3, msgAudit.map((a) => a.objectId));

console.log(failures ? `\n${failures} échec(s)` : '\nTout est conforme.');
process.exit(failures ? 1 : 0);
