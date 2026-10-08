/**
 * === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
 * Scénario sur émulateurs (aucune donnée réelle) :
 * - un numéro remis hors ligne déjà attribué à un autre dossier : le nouveau
 *   dossier reçoit un numéro officiel neuf et garde l'ancien en alias ; les
 *   identifiants du déclarant ouvrent SON dossier ;
 * - envoi par le domaine du site (/api/report, réécriture Hosting), sans SDK ;
 * - un nouvel essai du même dépôt ne crée jamais de doublon.
 * Lancement :
 *   firebase emulators:start --project demo-activa --only auth,firestore,functions,hosting
 *   npx tsx scripts/e2eReporterReference.emulator.mts
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getFirestore as adminFs } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const admin = adminInit({ projectId: 'demo-activa' });
const db = adminFs(admin, 'default');
const app = initializeApp({ projectId: 'demo-activa', apiKey: 'demo', authDomain: 'demo' });
const fns = getFunctions(app, 'us-central1');
connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (name: string) => httpsCallable(fns, name);

let failures = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${label}${extra !== undefined ? ' ' + JSON.stringify(extra) : ''}`);
  if (!ok) failures++;
};
const stamp = Date.now().toString(36);
const base = { category: 'Fraude', country: 'Cameroun', entity: 'ACTIVA Assurances', description: 'Test e2e', reportingMode: 'anonymous', confidentialityLevel: 'confidential' };

// 1. Dossier d'hier : numéro officiel attribué par le serveur.
const a = (await call('createCaseAsReporter')({ ...base, entityCode: 'AACMR', submissionId: `sub-a-${stamp}`, accessCode: 'CodeAAAA1111' })).data as any;
check('premier dossier : numéro officiel', /^AACMR-\d{2}-\d{2}-\d{4}$/.test(a.trackingNumber), a.trackingNumber);

// 2. Dépôt d'aujourd'hui, fait hors ligne sur un téléphone avec LE MÊME numéro.
const b = (await call('createCaseAsReporter')({ ...base, externalReference: a.trackingNumber, submissionId: `sub-b-${stamp}`, accessCode: 'CodeBBBB2222' })).data as any;
check('collision : dossier distinct créé', b.caseId !== a.caseId);
check('collision : numéro officiel neuf', /^AACMR-\d{2}-\d{2}-\d{4}$/.test(b.trackingNumber) && b.trackingNumber !== a.trackingNumber, b.trackingNumber);
const bDoc = (await db.collection('cases').doc(b.caseId).get()).data() as any;
check('collision : alias conservé', JSON.stringify(bDoc.reporterAliases) === JSON.stringify([a.trackingNumber]), bDoc.reporterAliases);

// 3. Identifiants du déclarant : chacun ouvre SON dossier.
const viewB = (await call('getCaseForReporter')({ caseNumber: a.trackingNumber, accessCode: 'CodeBBBB2222' })).data as any;
check('déclarant du téléphone : son dossier, son numéro', viewB.caseNumber === bDoc.caseNumber && viewB.reporterCase.externalReference === a.trackingNumber, viewB.reporterCase.externalReference);
const viewA = (await call('getCaseForReporter')({ caseNumber: a.trackingNumber, accessCode: 'CodeAAAA1111' })).data as any;
const aDoc = (await db.collection('cases').doc(a.caseId).get()).data() as any;
check("déclarant d'hier : toujours son dossier", viewA.caseNumber === aDoc.caseNumber);

// 4. Piste d'audit.
const audit = await db.collection('audit_logs').where('caseId', '==', b.caseId).where('action', '==', 'REPORTER_REFERENCE_ALIASED').get();
check("piste d'audit de l'alias", audit.size === 1);

// 5. Envoi par le domaine du site, sans SDK (réécriture Hosting /api/report).
const payload = { data: { ...base, entityCode: 'AACMR', submissionId: `sub-c-${stamp}`, accessCode: 'CodeCCCC3333' } };
const res = await fetch('http://127.0.0.1:5000/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const json = (await res.json()) as any;
check('/api/report : dossier créé', res.status === 200 && typeof json.result?.caseId === 'string', { status: res.status, tracking: json.result?.trackingNumber });

// 6. Nouvel essai du même dépôt par le SDK : aucun doublon.
const again = (await call('createCaseAsReporter')(payload.data)).data as any;
check('nouvel essai : même dossier (pas de doublon)', again.caseId === json.result?.caseId);

// 7. Contenu invalide par /api/report : erreur explicite (non renvoyée).
const bad = await fetch('http://127.0.0.1:5000/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { ...base, reportingMode: 'x' } }) });
const badJson = (await bad.json()) as any;
check('/api/report : contenu invalide refusé', badJson.error?.status === 'INVALID_ARGUMENT', badJson.error?.status);

console.log(failures ? `\n${failures} échec(s)` : '\nTout est conforme.');
process.exit(failures ? 1 : 0);
