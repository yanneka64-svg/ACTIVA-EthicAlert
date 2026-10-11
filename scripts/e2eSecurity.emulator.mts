/**
 * === AMÉLIORATION AJOUTÉE (tests hors « happy path » et sécurité) ===
 * Batterie d'attaques et de cas limites exécutée sur les émulateurs Firebase
 * (aucune donnée réelle). Chaque contrôle vérifie que l'application REFUSE
 * proprement ce qu'elle doit refuser : appel sans compte, mauvais rôle,
 * dossier d'un autre, code d'accès erroné, jeton falsifié, données piégées,
 * fichiers trop gros, accès direct à la base… et qu'aucune entrée invalide ne
 * provoque d'erreur interne (code `internal`, signe d'un cas non prévu).
 *
 * Lancement (voir docs/TESTS-SECURITE.md) :
 *   firebase emulators:start --config firebase.e2e.json --project demo-activa --only auth,firestore,functions
 *   npx tsx scripts/e2eSecurity.emulator.mts
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
import { initializeApp as adminInit } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminFs } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, collection, getDocs } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const PROJECT = 'demo-activa';
const FN_BASE = `http://127.0.0.1:5001/${PROJECT}/us-central1`;
const admin = adminInit({ projectId: PROJECT });
const db = adminFs(admin, 'default');
const auth = adminAuth(admin);

const app = initializeApp({ projectId: PROJECT, apiKey: 'demo', authDomain: 'demo' });
const cAuth = getAuth(app);
connectAuthEmulator(cAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'us-central1');
connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const cDb = getFirestore(app, 'default');
connectFirestoreEmulator(cDb, '127.0.0.1', 8080);

let failures = 0;
let passes = 0;
const check = (label: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${label}${!ok && extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 6000) : ''}`);
  if (ok) passes++;
  else failures++;
};
const section = (t: string) => console.log(`\n=== ${t}`);

/** Résultat d'un appel : `ok` (succès) ou le code d'erreur Firebase (sans préfixe). */
interface Attempt {
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  code: string;
  message: string;
}
async function attempt(name: string, data: unknown): Promise<Attempt> {
  try {
    const res = await httpsCallable(fns, name)(data);
    return { ok: true, data: res.data, code: '', message: '' };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, code: String(err.code ?? 'unknown').replace(/^functions\//, ''), message: String(err.message ?? '') };
  }
}
const refused = (r: Attempt, ...codes: string[]) => !r.ok && (codes.length === 0 ? r.code !== 'internal' : codes.includes(r.code));
const codeOf = (r: Attempt) => (r.ok ? 'SUCCÈS' : `${r.code}: ${r.message}`);

const PASSWORD = 'Passw0rd!x';
async function staff(username: string, role: string | null, opts: { countries?: string[]; pwdTemp?: boolean; email?: string } = {}) {
  const login = `${username}@sec.test`;
  const u = await auth.createUser({ email: login, password: PASSWORD }).catch(() => auth.getUserByEmail(login));
  const claims: Record<string, unknown> = role ? { role, countries: opts.countries ?? [], entities: [], name: username } : {};
  if (opts.pwdTemp) claims.pwdTemp = true;
  await auth.setCustomUserClaims(u.uid, claims);
  if (role) {
    await db.collection('staff_users').doc(u.uid).set({
      name: username, username, email: opts.email ?? `${username}@group-activa.com`, role, countries: opts.countries ?? [], entities: [], active: true,
      mustChangePassword: !!opts.pwdTemp, passwordSetAt: new Date().toISOString(),
    });
  }
  return { uid: u.uid, login };
}
async function as(account: { login: string } | null) {
  await signOut(cAuth).catch(() => {});
  if (account) await signInWithEmailAndPassword(cAuth, account.login, PASSWORD);
}

const validCase = (over: Record<string, unknown> = {}) => ({
  category: 'Fraude, Corruption et pots-de-vin', subcategory: 'Détournement de fonds', country: 'Cameroun', entity: 'ACTIVA Assurances',
  description: 'Test sécurité ' + Date.now(), reportingMode: 'anonymous', confidentialityLevel: 'confidential', accessCode: 'Demo1234x',
  submissionId: 'sub-sec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), entityCode: 'AACMR',
  ...over,
});
const clearCreateLimits = async () => {
  const snap = await db.collection('rate_limits').get();
  await Promise.all(snap.docs.filter((d) => d.id.startsWith('create_')).map((d) => d.ref.delete()));
};

// ---------------------------------------------------------------------------
const sysAdmin = await staff('sec.admin', 'system_admin');
const operator = await staff('sec.op', 'functional_admin');
const invA = await staff('sec.inv.a', 'investigator');
const invB = await staff('sec.inv.b', 'investigator');
const consult = await staff('sec.consult', 'consultation');
const exec = await staff('sec.exec', 'executive');
const noRole = await staff('sec.norole', null);
const tempPwd = await staff('sec.temp', 'functional_admin', { pwdTemp: true });
const ghanaOnly = await staff('sec.inv.gh', 'senior_investigator', { countries: ['Ghana'] });

await as(null);
await clearCreateLimits();
const created = await attempt('createCaseAsReporter', validCase());
check('préparation : un signalement public valide est accepté', created.ok, codeOf(created));
const c1 = (created.ok ? created.data : {}) as { caseId: string; trackingNumber: string; sessionToken: string };

// ---------------------------------------------------------------------------
section('1. Formulaire public : données invalides ou piégées');
for (const [label, data] of [
  ['aucune donnée', null],
  ['tableau au lieu d’un objet', [1, 2, 3]],
  ['catégorie de 500 caractères', validCase({ category: 'x'.repeat(500) })],
  ['mode de signalement inconnu', validCase({ reportingMode: 'hacker' })],
  ['niveau de confidentialité inconnu', validCase({ confidentialityLevel: 'top_secret' })],
  ['description absente', validCase({ description: '' })],
  ['description de 200 000 caractères', validCase({ description: 'x'.repeat(200_000) })],
  ['pays de type objet', validCase({ country: { $ne: null } })],
  ['empreinte de code d’accès mal formée', validCase({ accessCode: undefined, accessCodeHash: 'zz', accessCodeSalt: 'zz' })],
  ['numéro de suivi avec « / »', validCase({ externalReference: '../../cases/x' })],
  ['identifiant de dépôt avec « / »', validCase({ submissionId: 'a/b/c' })],
] as const) {
  const r = await attempt('createCaseAsReporter', data);
  check(`refus propre : ${label}`, refused(r, 'invalid-argument'), codeOf(r));
}
{
  const r = await attempt('createCaseAsReporter', validCase({ status: 'closed', assignee: invA.uid, implicatedUserIds: [operator.uid], priority: 'critical', caseId: 'case-forge' }));
  const k = r.ok ? (await db.collection('cases').doc(r.data.caseId).get()).data() : undefined;
  check('champs non prévus ignorés (statut, attribution, mis en cause imposés par le client)', r.ok && k?.status === 'new' && !k?.assignee && (k?.implicatedUserIds ?? []).length === 0 && r.data.caseId !== 'case-forge', { code: codeOf(r), k: k && { status: k.status, assignee: k.assignee } });
}
{
  const xss = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const r = await attempt('createCaseAsReporter', validCase({ description: xss }));
  check('texte contenant du HTML accepté tel quel (affiché comme texte, jamais interprété)', r.ok, codeOf(r));
}

// ---------------------------------------------------------------------------
section('2. Formulaire public : limitation du nombre de dépôts');
await clearCreateLimits();
{
  let accepted = 0;
  for (let i = 0; i < 12; i++) {
    const r = await attempt('createCaseAsReporter', validCase());
    if (r.ok) accepted++;
  }
  check('même réseau : au plus 10 dépôts par heure', accepted <= 10, { accepted });
}
await clearCreateLimits();
{
  // Contournement par un en-tête X-Forwarded-For inventé à chaque requête :
  // le plafond GLOBAL (60/h par défaut) doit tenir. Compteur placé à 55.
  await db.collection('rate_limits').doc('create__global').set({ windowStart: Date.now(), count: 55 });
  let accepted = 0;
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${FN_BASE}/createCaseAsReporter`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${i + 1}` },
      body: JSON.stringify({ data: validCase() }),
    });
    if (res.ok) accepted++;
  }
  check('en-tête X-Forwarded-For falsifié : le plafond global tient quand même (5 places restantes)', accepted <= 5, { accepted });
}
await clearCreateLimits();

// ---------------------------------------------------------------------------
section('3. Suivi par le déclarant : force brute, existence, entrées piégées');
for (const [label, data] of [
  ['aucune donnée', null],
  ['numéro de type objet', { caseNumber: { a: 1 }, accessCode: 'x' }],
  ['code de type nombre', { caseNumber: c1.trackingNumber, accessCode: 12345 }],
  ['numéro contenant « / »', { caseNumber: 'cases/abc', accessCode: 'x' }],
  ['numéro de 5 000 caractères', { caseNumber: 'A'.repeat(5000), accessCode: 'x' }],
] as const) {
  const r = await attempt('getCaseForReporter', data);
  check(`refus propre : ${label}`, refused(r, 'invalid-argument', 'permission-denied'), codeOf(r));
}
{
  const unknown = await attempt('getCaseForReporter', { caseNumber: 'AACMR-99-99-9999', accessCode: 'Nimporte1' });
  const wrong = await attempt('getCaseForReporter', { caseNumber: c1.trackingNumber, accessCode: 'Mauvais12' });
  check('dossier inexistant et mauvais code : même réponse (aucune fuite d’existence)', !unknown.ok && !wrong.ok && unknown.code === wrong.code && unknown.message === wrong.message, { unknown: codeOf(unknown), wrong: codeOf(wrong) });
  for (let i = 0; i < 4; i++) await attempt('getCaseForReporter', { caseNumber: c1.trackingNumber, accessCode: 'Mauvais12' });
  const locked = await attempt('getCaseForReporter', { caseNumber: c1.trackingNumber, accessCode: 'Demo1234x' });
  check('après 5 essais faux, même le bon code est bloqué (verrouillage)', refused(locked, 'resource-exhausted'), codeOf(locked));
  await db.collection('rate_limits').doc(c1.trackingNumber).delete();
  const okAgain = await attempt('getCaseForReporter', { caseNumber: c1.trackingNumber, accessCode: 'Demo1234x' });
  check('après déverrouillage, le bon code fonctionne', okAgain.ok, codeOf(okAgain));
  if (okAgain.ok) {
    const keys = Object.keys(okAgain.data).sort();
    const forbidden = ['assignee', 'persons', 'notes', 'riskScore', 'priority', 'implicatedUserIds', 'confidentialityLevel', 'additionalInvestigators'];
    check('vue déclarant : aucune donnée interne (attribution, personnes, risque…)', !forbidden.some((k) => k in okAgain.data) && !JSON.stringify(okAgain.data).includes(invA.uid), keys);
  }
}

// ---------------------------------------------------------------------------
section('4. Session du déclarant : jeton falsifié ou détourné');
{
  const [payload, sig] = c1.sessionToken.split('.');
  const other = await attempt('createCaseAsReporter', validCase());
  const otherId = other.ok ? other.data.caseId : 'case-x';
  const forgedPayload = Buffer.from(JSON.stringify({ c: otherId, e: Date.now() + 3_600_000 })).toString('base64url');
  for (const [label, token] of [
    ['jeton vide', ''],
    ['jeton aléatoire', 'abc.def'],
    ['autre dossier, ancienne signature', `${forgedPayload}.${sig}`],
    ['expiration prolongée, ancienne signature', `${Buffer.from(JSON.stringify({ c: c1.caseId, e: Date.now() + 99_999_999 })).toString('base64url')}.${sig}`],
    ['jeton de 10 000 caractères', 'a'.repeat(10_000)],
    ['jeton de type objet', { x: 1 }],
  ] as const) {
    const r = await attempt('reporterConversation', { sessionToken: token });
    check(`refus : ${label}`, refused(r, 'unauthenticated', 'invalid-argument'), codeOf(r));
  }
  const good = await attempt('reporterConversation', { sessionToken: `${payload}.${sig}` });
  check('le vrai jeton fonctionne', good.ok, codeOf(good));
}

// ---------------------------------------------------------------------------
section('5. Messages et documents du déclarant : limites');
{
  const long = await attempt('addCommunicationAsReporter', { sessionToken: c1.sessionToken, content: 'x'.repeat(10_001) });
  check('message de plus de 10 000 caractères refusé', refused(long, 'invalid-argument'), codeOf(long));
  const obj = await attempt('addCommunicationAsReporter', { sessionToken: c1.sessionToken, content: { a: 1 } });
  check('message de type objet refusé', refused(obj, 'invalid-argument'), codeOf(obj));
  const noSess = await attempt('addEvidenceAsReporter', { fileName: 'a.pdf', dataBase64: 'aGVsbG8=' });
  check('document sans session refusé', refused(noSess, 'unauthenticated'), codeOf(noSess));
  const empty = await attempt('addEvidenceAsReporter', { sessionToken: c1.sessionToken, fileName: 'a.pdf', dataBase64: '' });
  check('document vide refusé', refused(empty, 'invalid-argument'), codeOf(empty));
  const big = await attempt('addEvidenceAsReporter', { sessionToken: c1.sessionToken, fileName: 'a.pdf', dataBase64: Buffer.alloc(12 * 1024 * 1024).toString('base64') });
  check('document de 12 Mo refusé', refused(big), codeOf(big));
  const trav = await attempt('addEvidenceAsReporter', { sessionToken: c1.sessionToken, fileName: '../../etc/passwd', fileType: 'x'.repeat(500), dataBase64: 'aGVsbG8=' });
  const ev = trav.ok ? (await db.collection('cases').doc(c1.caseId).collection('evidence').doc(trav.data.evidenceId).get()).data() : undefined;
  check('nom de fichier piégé neutralisé, type trop long remplacé', trav.ok && !String(ev?.fileName).includes('/') && String(ev?.fileType).length <= 120, { code: codeOf(trav), name: ev?.fileName, type: ev?.fileType });
  const html = await attempt('addEvidenceAsReporter', { sessionToken: c1.sessionToken, fileName: 'piege.html', fileType: 'text/html', dataBase64: Buffer.from('<script>alert(1)</script>').toString('base64') });
  const evh = html.ok ? (await db.collection('cases').doc(c1.caseId).collection('evidence').doc(html.data.evidenceId).get()).data() : undefined;
  check('fichier HTML déposé : type neutralisé (jamais ouvert comme page par le portail)', html.ok && !/html|javascript|svg/i.test(String(evh?.fileType)), { type: evh?.fileType });
}

// ---------------------------------------------------------------------------
section('6. Relais e-mail public (notifyEmail)');
{
  const get = await fetch(`${FN_BASE}/notifyEmail`);
  check('méthode GET refusée', get.status === 405, get.status);
  const anon = await fetch(`${FN_BASE}/notifyEmail`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:5001' }, body: JSON.stringify({ to: 'victime@group-activa.com', subject: '[activa-whistleblowing] Spam', body: 'Bonjour' }) });
  check('appel anonyme sans attestation refusé', anon.status >= 400 && anon.status < 500, anon.status);
  const external = await fetch(`${FN_BASE}/notifyEmail`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: 'pirate@gmail.com', subject: 'x', body: 'y' }) });
  check('destinataire extérieur au domaine refusé', external.status >= 400 && external.status < 500, external.status);
}

// ---------------------------------------------------------------------------
section('7. Fonctions du personnel sans compte ou avec un compte invalide');
const STAFF_CALLABLES = [
  'createCase', 'listCases', 'assignCase', 'changeCaseStatus', 'recordFunctionalReviewSignOff', 'addAllegation', 'setAllegationFinding', 'addPerson',
  'removePersonLink', 'addTask', 'addInterview', 'addInvestigationNote', 'addCommunication', 'addCorrectiveAction', 'recordRiskAssessment',
  'declareConflictOfInterest', 'staffConversation', 'getEvidenceFileForStaff', 'getReporterIdentity', 'addEvidence', 'getEvidenceDownloadUrl',
  'getCaseDetails', 'applyPortalUpdate', 'addEvidenceAsStaff', 'getPortalConfig', 'savePortalConfig', 'recordPortalAudit', 'listAuditLogs',
  'sendTestNotificationEmail', 'createStaffAccount', 'updateStaffAccount', 'deleteStaffAccount', 'resetStaffAccountPassword', 'resetStaffAccountMfa',
  'listStaffDirectory', 'changeMyStaffPassword',
];
await as(null);
{
  const leaks: string[] = [];
  for (const name of STAFF_CALLABLES) {
    const r = await attempt(name, { caseId: c1.caseId, caseIds: [c1.caseId] });
    if (!refused(r, 'unauthenticated')) leaks.push(`${name} → ${codeOf(r)}`);
  }
  check(`sans compte : les ${STAFF_CALLABLES.length} fonctions du personnel refusent (« unauthenticated »)`, leaks.length === 0, leaks);
}
await as(noRole);
{
  const leaks: string[] = [];
  for (const name of STAFF_CALLABLES) {
    const r = await attempt(name, { caseId: c1.caseId, caseIds: [c1.caseId] });
    if (!refused(r, 'permission-denied')) leaks.push(`${name} → ${codeOf(r)}`);
  }
  check('compte sans rôle : toutes refusent (« permission-denied »)', leaks.length === 0, leaks);
}
await as(tempPwd);
{
  const leaks: string[] = [];
  for (const name of STAFF_CALLABLES.filter((n) => n !== 'changeMyStaffPassword')) {
    const r = await attempt(name, { caseId: c1.caseId, caseIds: [c1.caseId] });
    if (!refused(r, 'failed-precondition')) leaks.push(`${name} → ${codeOf(r)}`);
  }
  check('mot de passe temporaire non changé : aucun accès métier', leaks.length === 0, leaks);
}

// ---------------------------------------------------------------------------
section('8. Cloisonnement entre membres du personnel');
await as(operator);
{
  const r = await attempt('applyPortalUpdate', { caseId: c1.caseId, patch: { assignedInvestigators: [invA.uid] } });
  check('préparation : l’opérateur attribue le dossier à l’enquêteur A', r.ok, codeOf(r));
  const toAdmin = await attempt('applyPortalUpdate', { caseId: c1.caseId, patch: { assignedInvestigators: [sysAdmin.uid] } });
  check('attribution à un administrateur système refusée (sans accès aux dossiers)', !toAdmin.ok || (toAdmin.data.rejected ?? []).length > 0, codeOf(toAdmin));
}
await as(invB);
{
  const d = await attempt('getCaseDetails', { caseIds: [c1.caseId] });
  check('enquêteur B (non attribué) : le dossier n’apparaît pas', d.ok && d.data.details.length === 0, codeOf(d));
  const u = await attempt('applyPortalUpdate', { caseId: c1.caseId, patch: { portal: { status: 'closed', workflowStatus: 'closed' } } });
  check('enquêteur B : ne peut pas clôturer le dossier d’un autre', refused(u, 'permission-denied'), codeOf(u));
  const m = await attempt('addCommunication', { caseId: c1.caseId, content: 'intrusion' });
  check('enquêteur B : ne peut pas écrire au déclarant', refused(m, 'permission-denied', 'invalid-argument'), codeOf(m));
  const s = await attempt('staffConversation', { caseId: c1.caseId });
  check('enquêteur B : ne peut pas lire la conversation', refused(s, 'permission-denied'), codeOf(s));
  const l = await attempt('listCases', {});
  check('enquêteur B : la liste ne contient pas le dossier', l.ok && !JSON.stringify(l.data).includes(c1.caseId), codeOf(l));
}
await as(invA);
{
  const d = await attempt('getCaseDetails', { caseIds: [c1.caseId] });
  check('enquêteur A (attribué) : voit le dossier', d.ok && d.data.details.length === 1, codeOf(d));
  const id = await attempt('getReporterIdentity', { caseId: c1.caseId });
  check('enquêteur A : n’a pas accès à l’identité du déclarant', refused(id, 'permission-denied'), codeOf(id));
  const reassign = await attempt('applyPortalUpdate', { caseId: c1.caseId, patch: { assignedInvestigators: [invB.uid] } });
  check('enquêteur A : ne peut pas réattribuer le dossier', !reassign.ok || !(reassign.data.applied ?? []).includes('assignment'), codeOf(reassign));
  const create = await attempt('createStaffAccount', { account: { name: 'Pirate', username: 'pirate', email: 'p@group-activa.com', role: 'system_admin' } });
  check('enquêteur A : ne peut pas créer de compte', refused(create, 'permission-denied'), codeOf(create));
  const self = await attempt('updateStaffAccount', { id: invA.uid, changes: { role: 'system_admin' } });
  check('enquêteur A : ne peut pas se donner le rôle administrateur', refused(self, 'permission-denied'), codeOf(self));
  const audit = await attempt('listAuditLogs', {});
  check('enquêteur A : pas d’accès à la piste d’audit', refused(audit, 'permission-denied'), codeOf(audit));
  const cfg = await attempt('savePortalConfig', { section: 'emailNotifications', value: {} });
  check('enquêteur A : ne peut pas modifier la configuration', refused(cfg, 'permission-denied'), codeOf(cfg));
}
await as(ghanaOnly);
{
  const d = await attempt('getCaseDetails', { caseIds: [c1.caseId] });
  check('responsable limité au Ghana : ne voit pas un dossier du Cameroun', d.ok && d.data.details.length === 0, codeOf(d));
}
await as(consult);
{
  const u = await attempt('applyPortalUpdate', { caseId: c1.caseId, patch: { portal: { status: 'closed', workflowStatus: 'closed' } } });
  check('consultation (lecture seule) : ne peut rien modifier', refused(u, 'permission-denied'), codeOf(u));
}
await as(exec);
{
  const d = await attempt('getCaseDetails', { caseIds: [c1.caseId] });
  check('direction (tableaux agrégés) : aucun contenu de dossier', !d.ok || d.data.details.length === 0, codeOf(d));
}
await as(sysAdmin);
{
  const d = await attempt('getCaseDetails', { caseIds: [c1.caseId] });
  check('administrateur système : aucun accès au contenu des dossiers', !d.ok || d.data.details.length === 0, codeOf(d));
  const delSelf = await attempt('deleteStaffAccount', { id: sysAdmin.uid });
  check('administrateur : ne peut pas supprimer son propre compte', refused(delSelf, 'failed-precondition'), codeOf(delSelf));
}

// ---------------------------------------------------------------------------
section('8b. Double authentification exigée par le serveur pour les administrateurs');
await db.collection('system').doc('emulator_flags').set({ adminMfa: 'on' });
await as(sysAdmin);
{
  const cfg = await attempt('getPortalConfig', {});
  check('administrateur sans double authentification : fonctions métier refusées', refused(cfg, 'failed-precondition'), codeOf(cfg));
  const create = await attempt('createStaffAccount', { account: { name: 'Test', username: 'test.mfa', email: 't@group-activa.com', role: 'investigator' } });
  check('administrateur sans double authentification : gestion des comptes refusée', refused(create, 'failed-precondition'), codeOf(create));
  const profile = await attempt('getMyStaffProfile', {});
  check('administrateur sans double authentification : son profil reste lisible (activation à la connexion)', profile.ok, codeOf(profile));
}
await as(operator);
{
  const d = await attempt('getCaseDetails', { caseIds: [c1.caseId] });
  check('opérateur (double authentification facultative) : non concerné', d.ok, codeOf(d));
}
await db.collection('system').doc('emulator_flags').delete();

// ---------------------------------------------------------------------------
section('9. Accès direct à la base (sans passer par le serveur)');
for (const [who, account] of [['anonyme', null], ['enquêteur A', invA], ['administrateur', sysAdmin], ['opérateur', operator]] as const) {
  await as(account);
  const denied: string[] = [];
  const allowed: string[] = [];
  for (const path of [
    `reporter_credentials/${c1.caseId}`, `reporter_identities/${c1.caseId}`, `rate_limits/${c1.trackingNumber}`, 'system/reporter_session',
    'counters/cases', `external_references/${c1.trackingNumber}`, `staff_users/${invA.uid}`, 'audit_logs/x',
  ]) {
    try {
      await getDoc(doc(cDb, path));
      allowed.push(`lecture ${path}`);
    } catch {
      denied.push(path);
    }
    try {
      await setDoc(doc(cDb, path), { pirate: true });
      allowed.push(`écriture ${path}`);
    } catch {
      /* refusé */
    }
  }
  try {
    await setDoc(doc(cDb, `cases/${c1.caseId}`), { status: 'closed' }, { merge: true });
    allowed.push('écriture du dossier');
  } catch {
    /* refusé */
  }
  try {
    await getDocs(collection(cDb, 'cases'));
    allowed.push('liste de tous les dossiers');
  } catch {
    /* refusé */
  }
  check(`${who} : secrets, compteurs, comptes et dossiers fermés en lecture/écriture directe`, allowed.length === 0, allowed);
}

// ---------------------------------------------------------------------------
section('10. Robustesse : entrées absurdes envoyées à chaque fonction (aucune erreur interne)');
const GARBAGE: unknown[] = [null, {}, { caseId: { $gt: '' } }, { caseId: 'a/b/c' }, { caseId: 'x'.repeat(2000) }, { caseIds: 'pas-un-tableau' }, { caseId: c1.caseId, patch: { taskUpdates: [{ taskId: 'a/b' }] } }, { id: ['x'] }, { section: '__proto__', value: { polluted: true } }];
for (const [who, account] of [['opérateur', operator], ['administrateur', sysAdmin], ['enquêteur A', invA]] as const) {
  await as(account);
  const internals: string[] = [];
  for (const name of STAFF_CALLABLES.filter((n) => !['deleteStaffAccount', 'resetStaffAccountPassword', 'resetStaffAccountMfa', 'changeMyStaffPassword'].includes(n))) {
    for (const g of GARBAGE) {
      const r = await attempt(name, g);
      if (!r.ok && r.code === 'internal') internals.push(`${name}(${JSON.stringify(g).slice(0, 40)})`);
    }
  }
  check(`${who} : aucune erreur interne sur ${GARBAGE.length} entrées absurdes × toutes les fonctions`, internals.length === 0, internals);
}
await as(null);
{
  const internals: string[] = [];
  for (const name of ['getCaseForReporter', 'addCommunicationAsReporter', 'reporterConversation', 'addEvidenceAsReporter', 'addSubmissionEvidenceAsReporter', 'createCaseAsReporter']) {
    for (const g of [null, {}, { caseNumber: 1, accessCode: [] }, { sessionToken: 5 }, { sessionToken: 'a.b', dataBase64: 7 }, 'texte']) {
      const r = await attempt(name, g);
      if (!r.ok && r.code === 'internal') internals.push(`${name}(${JSON.stringify(g)})`);
    }
  }
  check('fonctions publiques : aucune erreur interne sur des entrées absurdes', internals.length === 0, internals);
}
const polluted = ({} as Record<string, unknown>).polluted;
check('aucune pollution de prototype', polluted === undefined);

console.log(`\n${passes} contrôles réussis, ${failures} en échec.`);
process.exit(failures ? 1 : 0);
