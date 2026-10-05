/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 2) ===
 * Scénario de bout en bout des documents sur les émulateurs Firebase (aucune
 * donnée réelle) : fichier joint au formulaire de signalement, pièce ajoutée
 * par le personnel, téléchargement par l'équipe. Lancement :
 *   firebase emulators:start --project demo-activa --only auth,firestore,functions
 *   npx tsx scripts/e2eDocuments.emulator.mts
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFs } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const admin = adminInit({ projectId: 'demo-activa' });
const db = adminFs(admin, 'default');
const auth = adminAuth(admin);
const op = await auth.createUser({ email: 'docop@demo.test', password: 'Passw0rd!x' }).catch(() => auth.getUserByEmail('docop@demo.test'));
await auth.setCustomUserClaims(op.uid, { role: 'functional_admin', countries: [], entities: [] });

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

const pdf = Buffer.from('%PDF-1.4 facture de test ' + Date.now());
// 1. Dépôt public avec une pièce jointe décrite
const created = (await call('createCaseAsReporter')({
  category: 'Fraude', subcategory: 'Détournement', country: 'Ghana', entity: 'ACTIVA International Ghana',
  description: 'Signalement de test émulateur', reportingMode: 'anonymous', confidentialityLevel: 'confidential',
  accessCode: 'Demo1234x', submissionId: 'sub-' + Date.now(), entityCode: 'AIIG',
  details: { evidence: [{ name: 'facture-octobre.pdf', type: 'application/pdf', size: pdf.length }] },
})).data as { caseId: string; trackingNumber: string; sessionToken?: string };
check('le dépôt renvoie une session au déclarant', typeof created.sessionToken === 'string' && created.sessionToken.length > 20);

// 2. Le navigateur du déclarant transmet le fichier
const up = (await call('addSubmissionEvidenceAsReporter')({
  sessionToken: created.sessionToken, fileName: 'facture-octobre.pdf', fileType: 'application/pdf', dataBase64: pdf.toString('base64'),
})).data as { evidenceId?: string };
const evs = (await db.collection('cases').doc(created.caseId).collection('evidence').get()).docs.map((d) => d.data());
check('la pièce décrite au dépôt reçoit son contenu (pas de doublon)', evs.length === 1 && String(evs[0].storagePath).startsWith('firestore:') && evs[0].evidenceId === up.evidenceId, evs.map((e) => e.evidenceId));
const again = (await call('addSubmissionEvidenceAsReporter')({
  sessionToken: created.sessionToken, fileName: 'facture-octobre.pdf', fileType: 'application/pdf', dataBase64: pdf.toString('base64'),
})).data as { duplicate?: boolean };
check('un nouvel essai est reconnu comme doublon', again.duplicate === true);
const comms = await db.collection('cases').doc(created.caseId).collection('communications').get();
check('aucun message parasite dans la conversation', comms.size === 0);

// 3. L'équipe télécharge le fichier
await signInWithEmailAndPassword(cAuth, 'docop@demo.test', 'Passw0rd!x');
const dl = (await call('getEvidenceFileForStaff')({ caseId: created.caseId, evidenceId: up.evidenceId })).data as { dataBase64: string };
check('l’équipe télécharge exactement le fichier déposé', Buffer.from(dl.dataBase64, 'base64').equals(pdf));

// 4. Pièce ajoutée par le personnel, même identifiant que le portail
const staffFile = Buffer.from('rapport ' + Date.now());
const st = (await call('addEvidenceAsStaff')({
  caseId: created.caseId, fileName: 'rapport.docx', fileType: 'application/octet-stream', dataBase64: staffFile.toString('base64'),
  description: 'Rapport d’investigation', clientId: 'ev-report-123',
})).data as { evidenceId: string };
check('pièce du personnel enregistrée sous l’identifiant du portail', st.evidenceId === 'ev-report-123');
const dl2 = (await call('getEvidenceFileForStaff')({ caseId: created.caseId, evidenceId: 'ev-report-123' })).data as { dataBase64: string };
check('pièce du personnel téléchargeable', Buffer.from(dl2.dataBase64, 'base64').equals(staffFile));
const actions = (await db.collection('audit_logs').where('caseId', '==', created.caseId).get()).docs.map((d) => d.data().action);
check('piste d’audit (dépôt, pièces, téléchargements)', ['EVIDENCE_ADDED_BY_REPORTER', 'EVIDENCE_UPLOADED', 'EVIDENCE_DOWNLOADED'].every((a) => actions.includes(a)), actions);

console.log(failures ? `${failures} échec(s)` : 'TOUT EST VERT');
process.exit(failures ? 1 : 0);
