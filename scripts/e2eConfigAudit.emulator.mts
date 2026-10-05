/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phases 3 et 4) ===
 * Configuration partagée et piste d'audit commune sur les émulateurs
 * Firebase (aucune donnée réelle). Lancement :
 *   firebase emulators:start --project demo-activa --only auth,firestore,functions
 *   npx tsx scripts/e2eConfigAudit.emulator.mts
 */
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
async function user(email: string, role: string, name: string) {
  const u = await auth.createUser({ email, password: 'Passw0rd!x', displayName: name }).catch(() => auth.getUserByEmail(email));
  await auth.setCustomUserClaims(u.uid, { role, countries: [], entities: [], name });
  return u.uid;
}
await user('cfgadmin@demo.test', 'system_admin', 'Admin Système');
await user('cfginv@demo.test', 'investigator', 'Enquêteur');

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
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e as { code?: string }).code);

// Configuration : l'administrateur enregistre, l'enquêteur lit mais ne peut pas modifier
await signInWithEmailAndPassword(cAuth, 'cfgadmin@demo.test', 'Passw0rd!x');
const entities = [{ id: 'ent-gh', name: 'ACTIVA International Ghana', code: 'AIIG' }];
await call('savePortalConfig')({ section: 'entities', value: entities });
check('section invalide refusée', (await code(call('savePortalConfig')({ section: 'entities', value: { not: 'a list' } }))) === 'functions/invalid-argument');
await signOut(cAuth);
await signInWithEmailAndPassword(cAuth, 'cfginv@demo.test', 'Passw0rd!x');
const cfg = (await call('getPortalConfig')({})).data as { sections: Record<string, string> };
check('un autre poste lit la configuration enregistrée', cfg.sections.entities === JSON.stringify(entities));
check('l’enquêteur ne peut pas modifier la configuration', (await code(call('savePortalConfig')({ section: 'entities', value: [] }))) === 'functions/permission-denied');

// Piste d'audit : événements du portail, auteur fixé par le serveur, sans doublon
const ev = { id: 'aud-' + Date.now(), actionType: 'MESSAGE_SENT', details: 'Message au déclarant', trackingNumber: 'AIIG-26-10-0001', timestamp: new Date().toISOString() };
await call('recordPortalAudit')({ entries: [ev, ev] });
await call('recordPortalAudit')({ entries: [ev] });
const stored = (await db.collection('audit_logs').where('portalEntryId', '==', ev.id).get()).docs.map((d) => d.data());
check('événement du portail enregistré une seule fois', stored.length === 1, stored.length);
check('auteur et rôle fixés par le serveur', stored[0]?.actorName === 'Enquêteur' && stored[0]?.actorRole === 'investigator');
check('l’enquêteur ne lit pas la piste d’audit', (await code(call('listAuditLogs')({}))) === 'functions/permission-denied');
await signOut(cAuth);
await signInWithEmailAndPassword(cAuth, 'cfgadmin@demo.test', 'Passw0rd!x');
const list = (await call('listAuditLogs')({ limit: 50 })).data as { entries: { portalEntryId?: string; action: string; source: string }[] };
check('l’administrateur lit le journal commun (portail + serveur)', list.entries.some((e) => e.portalEntryId === ev.id) && list.entries.some((e) => e.source === 'server' && e.action === 'CONFIG_UPDATED'), list.entries.length);

console.log(failures ? `${failures} échec(s)` : 'TOUT EST VERT');
process.exit(failures ? 1 : 0);
