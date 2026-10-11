/**
 * === AMÉLIORATION AJOUTÉE (transactions, concurrence, pannes en cours de route) ===
 * Scénario sur émulateurs (projet fictif demo-activa, aucune donnée réelle) :
 * - deux personnes modifient le même champ EN MÊME TEMPS : une seule
 *   l'emporte, l'autre reçoit un « conflit » (rien d'écrasé en silence) ;
 * - deux personnes modifient des champs différents en même temps : les deux
 *   modifications sont gardées ;
 * - un envoi rejoué après une coupure (réponse perdue) n'est pas un conflit ;
 * - la personne mise en cause est écartée DÈS l'enregistrement du
 *   signalement, y compris quand le déclarant renvoie son dépôt ;
 * - message et document du déclarant renvoyés deux fois : un seul exemplaire ;
 * - envois simultanés de documents : la limite par dossier n'est jamais dépassée.
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFs } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { REPORTER_FILE_MAX_PER_CASE } from '../src/domain/conversation';

const admin = adminInit({ projectId: 'demo-activa' });
const db = adminFs(admin, 'default');
const auth = adminAuth(admin);

async function staff(username: string, role: string, name: string) {
  const login = `${username}@conc.test`;
  const u = await auth.createUser({ email: login, password: 'Passw0rd!x' }).catch(() => auth.getUserByEmail(login));
  await auth.setCustomUserClaims(u.uid, { role, countries: [], entities: [], name });
  await db.collection('staff_users').doc(u.uid).set({ name, username, email: `${username}@group-activa.com`, role, countries: [], entities: [], active: true });
  return { uid: u.uid, login };
}
const opA = await staff('op.a', 'functional_admin', 'Opérateur A');
const opB = await staff('op.b', 'functional_admin', 'Opérateur B');
const implicated = await staff('inv.c', 'investigator', 'Awa Diallo');

/** Une « session navigateur » par personne : deux applications Firebase indépendantes. */
async function client(name: string, login?: string) {
  const app = initializeApp({ projectId: 'demo-activa', apiKey: 'demo', authDomain: 'demo' }, name);
  const a = getAuth(app);
  connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fns = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  if (login) await signInWithEmailAndPassword(a, login, 'Passw0rd!x');
  return (fn: string) => httpsCallable(fns, fn);
}
const A = await client('a', opA.login);
const B = await client('b', opB.login);
const reporter = await client('reporter');

let failures = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${label}${extra !== undefined ? ' ' + JSON.stringify(extra) : ''}`);
  if (!ok) failures++;
};
type Res = { applied: string[]; rejected: { part: string; reason: string }[] };

// 1. Mise en cause écartée dès l'enregistrement (et après un dépôt renvoyé)
const submission = {
  category: 'Fraude', subcategory: 'Détournement', country: 'Ghana', entity: 'ACTIVA International Ghana',
  description: 'Test concurrence', reportingMode: 'anonymous', confidentialityLevel: 'confidential',
  accessCode: 'Demo1234x', submissionId: 'sub-conc-' + Date.now(), entityCode: 'AIIG',
  details: { persons: [{ kind: 'subject', name: 'awa DIALLO', position: 'Agent' }] },
};
const [c1, c1bis] = (await Promise.all([reporter('createCaseAsReporter')(submission), reporter('createCaseAsReporter')(submission)])).map(
  (r) => r.data as { caseId: string; sessionToken: string }
);
check('dépôt envoyé deux fois en même temps : un seul dossier', c1.caseId === c1bis.caseId, [c1.caseId, c1bis.caseId]);
const caseId = c1.caseId;
const doc1 = (await db.collection('cases').doc(caseId).get()).data()!;
check('mis en cause écarté dès l’enregistrement (même transaction)', (doc1.implicatedUserIds ?? []).includes(implicated.uid), doc1.implicatedUserIds);
const persons1 = (await db.collection('cases').doc(caseId).collection('persons').get()).docs.map((d) => d.data());
check('personne rattachée à son compte', persons1.some((p) => p.linkedUserId === implicated.uid));
const created = (await db.collection('audit_logs').where('caseId', '==', caseId).where('action', '==', 'CASE_CREATED_BY_REPORTER').get()).size;
check('une seule trace de création', created === 1, created);
const IMP = await client('implicated', implicated.login);
const seen = ((await IMP('getCaseDetails')({ caseIds: [caseId] })).data as { details?: unknown[] }).details ?? [];
check('le mis en cause ne peut pas ouvrir le dossier', seen.length === 0);

// 2. Même champ modifié en même temps par deux personnes
const [rA, rB] = (await Promise.all([
  A('applyPortalUpdate')({ caseId, patch: { portal: { investigationReport: 'Version A' }, expected: { portal: { investigationReport: null } } } }),
  B('applyPortalUpdate')({ caseId, patch: { portal: { investigationReport: 'Version B' }, expected: { portal: { investigationReport: null } } } }),
])).map((r) => r.data as Res);
const conflicted = [rA, rB].filter((r) => r.rejected.some((x) => x.reason === 'conflict'));
const winners = [rA, rB].filter((r) => r.applied.includes('portal'));
check('même champ en même temps : un gagnant, un conflit', winners.length === 1 && conflicted.length === 1, [rA, rB]);
const stored = (await db.collection('cases').doc(caseId).get()).data()!.portal?.investigationReport;
const winnerText = winners[0] === rA ? 'Version A' : 'Version B';
check('la version enregistrée est celle du gagnant (pas un mélange)', stored === winnerText, stored);
const conflictAudit = (await db.collection('audit_logs').where('caseId', '==', caseId).where('action', '==', 'PORTAL_UPDATE_CONFLICT').get()).size;
check('le conflit est tracé dans la piste d’audit', conflictAudit === 1, conflictAudit);

// 3. Envoi rejoué après une coupure : pas de faux conflit
const replay = (await (winners[0] === rA ? A : B)('applyPortalUpdate')({
  caseId, patch: { portal: { investigationReport: winnerText }, expected: { portal: { investigationReport: null } } },
})).data as Res;
check('envoi rejoué (réponse perdue) : accepté, pas de conflit', replay.applied.includes('portal') && replay.rejected.length === 0, replay);

// 4. Champs différents en même temps : rien n'est perdu
await Promise.all([
  A('applyPortalUpdate')({ caseId, patch: { portal: { closureSummary: 'Synthèse A' }, expected: { portal: { closureSummary: null } } } }),
  B('applyPortalUpdate')({ caseId, patch: { portal: { escalatedReason: 'Motif B' }, expected: { portal: { escalatedReason: null } } } }),
]);
const p4 = (await db.collection('cases').doc(caseId).get()).data()!.portal ?? {};
check('champs différents en même temps : les deux sont gardés', p4.closureSummary === 'Synthèse A' && p4.escalatedReason === 'Motif B', p4);

// 5. Ancien navigateur (sans valeur attendue) : comportement inchangé
const legacy = (await A('applyPortalUpdate')({ caseId, patch: { portal: { investigationReport: 'Sans contrôle' } } })).data as Res;
check('envoi sans valeur attendue (ancienne version du site) : accepté', legacy.applied.includes('portal'));

// 6. Message du déclarant renvoyé (réponse perdue) : un seul exemplaire
const msg = { sessionToken: c1.sessionToken, content: 'Bonjour, une précision.', clientMessageId: 'cm-' + Date.now().toString(36) + 'abcd' };
const [m1, m2] = (await Promise.all([reporter('addCommunicationAsReporter')(msg), reporter('addCommunicationAsReporter')(msg)])).map(
  (r) => r.data as { messageId: string; duplicate?: boolean }
);
const comms = (await db.collection('cases').doc(caseId).collection('communications').where('content', '==', msg.content).get()).size;
check('message envoyé deux fois : un seul exemplaire', comms === 1 && m1.messageId === m2.messageId && [m1, m2].filter((m) => m.duplicate).length === 1, { comms, m1, m2 });
try {
  await reporter('addCommunicationAsReporter')({ ...msg, clientMessageId: '../x' });
  check('identifiant d’envoi piégé refusé', false);
} catch (e) {
  check('identifiant d’envoi piégé refusé', (e as { code?: string }).code === 'functions/invalid-argument');
}

// 7. Document renvoyé : un seul exemplaire
const file = { sessionToken: c1.sessionToken, fileName: 'piece.txt', fileType: 'text/plain', dataBase64: Buffer.from('contenu').toString('base64'), clientUploadId: 'up-' + Date.now().toString(36) + 'abcd' };
await Promise.all([reporter('addEvidenceAsReporter')(file), reporter('addEvidenceAsReporter')(file)]);
const evs = (await db.collection('cases').doc(caseId).collection('evidence').where('fileName', '==', 'piece.txt').get()).size;
check('document envoyé deux fois : un seul exemplaire', evs === 1, evs);

// 8. Envois simultanés : la limite de documents par dossier tient
const already = (await db.collection('cases').doc(caseId).collection('evidence').where('createdBy', '==', 'reporter').get()).size;
const now = new Date().toISOString();
const filler = db.batch();
for (let i = already; i < REPORTER_FILE_MAX_PER_CASE - 2; i++) {
  filler.set(db.collection('cases').doc(caseId).collection('evidence').doc(`ev-fill-${i}`), { evidenceId: `ev-fill-${i}`, createdBy: 'reporter', createdAt: now, fileName: 'x' });
}
await filler.commit();
const outcomes = await Promise.allSettled(
  [1, 2, 3, 4].map((n) => reporter('addEvidenceAsReporter')({ ...file, fileName: `simultane-${n}.txt`, clientUploadId: `sim-${n}-` + Date.now().toString(36) }))
);
const total = (await db.collection('cases').doc(caseId).collection('evidence').where('createdBy', '==', 'reporter').get()).size;
const refused = outcomes.filter((o) => o.status === 'rejected' && (o.reason as { code?: string }).code === 'functions/resource-exhausted').length;
check(`4 envois simultanés pour 2 places : limite de ${REPORTER_FILE_MAX_PER_CASE} respectée`, total === REPORTER_FILE_MAX_PER_CASE && refused === 2, { total, refused });

console.log(failures ? `${failures} échec(s)` : 'TOUT EST VERT');
process.exit(failures ? 1 : 0);
