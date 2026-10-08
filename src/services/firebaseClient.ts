/**
 * ACTIVA Hotline — Phase 4: real Firebase client connection
 *
 * This is a DELIBERATELY SEPARATE initialization from `services/firebase.ts`
 * (the legacy, best-effort AlertRecord sync used by the Phase 1 app) — it
 * targets the project's real, NAMED Firestore database (`default`, not the
 * special `(default)`; see docs/FIREBASE-SETUP.md) under its own named
 * Firebase App instance, so nothing here can interfere with the existing
 * legacy sync path even if both happen to be configured at once.
 *
 * === IMPORTANT, VERIFIED LIVE (Phase 4) ===
 * Only single-document reads (`getDoc` of one known case/subdocument id)
 * actually work against the deployed `firestore.rules`. Listing/querying
 * (`getDocs`/`onSnapshot` on a collection — "give me every case I can see")
 * is REJECTED OUTRIGHT by Firestore itself, confirmed with real signed-in
 * requests, even for a `functional_admin` who passes every other check:
 * Firestore requires a list query's security rule to be provable from the
 * query's own `where` filters alone for every possible result, and this
 * app's rules deliberately depend on a per-document field
 * (`implicatedUserIds`) that no query can constrain without weakening rule
 * #9 of the brief ("a person implicated in a case must never access it").
 * See the comment above `match /cases/{caseId}` in `firestore.rules` for
 * the full account. Consequently, a real "list of cases" Control Panel
 * requires a Cloud Function (`functions/src/index.ts`, written but not
 * deployed — see docs/FIREBASE-SETUP.md), not this client. Do not add
 * `getDocs(collection(db, 'cases'))`-style calls here expecting them to
 * work; they will fail with `permission-denied` against real data, and
 * building UI on top of them would be exactly the "interface that gives
 * the impression the system works" the brief forbids.
 */

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, Firestore, getFirestore } from 'firebase/firestore';
// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 3 :
// FirestoreCaseRepository) === type-only : le SDK `firebase/functions`
// lui-même est chargé dynamiquement (voir getPhase4Functions ci-dessous),
// jamais importé statiquement ici — `CaseLookup.tsx`, seul consommateur
// actuellement expédié de ce fichier, n'a besoin ni de charger ni
// d'initialiser Cloud Functions ; un import statique aurait fait grossir
// son chunk (~6 kB gzip) sans aucun bénéfice pour cet écran.
import type { Functions } from 'firebase/functions';
// === AMÉLIORATION AJOUTÉE (Audit DevOps — P1) === App Check (dormant sans clé de site).
import { activateAppCheck } from './appCheck';

const APP_NAME = 'activa-hotline-phase4';

const metaEnv = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};

export interface Phase4FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseId: string;
}

export function getPhase4Config(): Phase4FirebaseConfig {
  return {
    apiKey: metaEnv.VITE_FIREBASE_API_KEY || '',
    authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: metaEnv.VITE_FIREBASE_APP_ID || '',
    databaseId: metaEnv.VITE_FIRESTORE_DATABASE_ID || 'default',
  };
}

// === AMÉLIORATION AJOUTÉE (vérification de bout en bout) ===
/** Hôte des émulateurs Firebase locaux (tests uniquement), sinon chaîne vide. */
export function firebaseEmulatorHost(): string {
  const host = (metaEnv.VITE_FIREBASE_EMULATOR_HOST || '').trim();
  return /^(127\.0\.0\.1|localhost)$/.test(host) ? host : '';
}

export function isPhase4Configured(): boolean {
  const c = getPhase4Config();
  return Boolean(c.apiKey && c.projectId && c.appId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/** Lazily initializes (once) and returns the Phase 4 Firebase handles. Throws if not configured. */
export function getPhase4Firebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (app && auth && db) return { app, auth, db };

  const config = getPhase4Config();
  if (!isPhase4Configured()) {
    throw new Error(
      'Firebase (Phase 4) is not configured — set VITE_FIREBASE_* in .env. See docs/FIREBASE-SETUP.md.'
    );
  }

  const existing = getApps().find((a) => a.name === APP_NAME);
  app = existing ?? initializeApp(config, APP_NAME);
  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P1) === sans effet tant que
  // VITE_FIREBASE_APPCHECK_SITE_KEY n'est pas défini (voir appCheck.ts).
  void activateAppCheck(app);
  auth = getAuth(app);
  db = getFirestore(app, config.databaseId);
  // === AMÉLIORATION AJOUTÉE (vérification de bout en bout) === émulateurs
  // Firebase locaux, UNIQUEMENT si VITE_FIREBASE_EMULATOR_HOST est défini
  // (tests ; jamais défini par les workflows de production).
  const emulatorHost = firebaseEmulatorHost();
  if (emulatorHost) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
  }
  return { app, auth, db };
}

// === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 3 :
// FirestoreCaseRepository) ===
let fns: Functions | null = null;

/**
 * Même instance Firebase nommée que `getPhase4Firebase()` ci-dessus, pour
 * appeler les Cloud Functions (functions/src/index.ts) sans recréer un
 * second point d'entrée. Chargement dynamique du SDK `firebase/functions`
 * (jamais un import statique en haut de ce fichier) : seul
 * `FirestoreCaseRepository` (data-access/firestoreCaseRepository.ts) a
 * besoin de Cloud Functions — `CaseLookup.tsx`, seul consommateur
 * actuellement expédié de `getPhase4Firebase()`, n'en a jamais besoin, et
 * ne doit donc jamais payer le coût de ce SDK dans son propre chunk.
 */
export async function getPhase4Functions(): Promise<Functions> {
  if (fns) return fns;
  const { app: phase4App } = getPhase4Firebase();
  const { getFunctions } = await import('firebase/functions');
  // Pas de région explicite : les Cloud Functions (functions/src/index.ts)
  // sont déclarées sans `region()`, donc `us-central1` par défaut des deux
  // côtés — jamais besoin de le préciser ici tant que ça reste vrai.
  // === AMÉLIORATION AJOUTÉE (Audit DevOps — P1) === la région est
  // désormais EXPLICITE côté serveur (setGlobalOptions, us-central1) — même
  // valeur que ce défaut. Si elle change un jour, passer la même région
  // ici : getFunctions(phase4App, '<région>').
  fns = getFunctions(phase4App);
  // === AMÉLIORATION AJOUTÉE (vérification de bout en bout) === voir getPhase4Firebase.
  const emulatorHost = firebaseEmulatorHost();
  if (emulatorHost) {
    const { connectFunctionsEmulator } = await import('firebase/functions');
    connectFunctionsEmulator(fns, emulatorHost, 5001);
  }
  return fns;
}

// === AMÉLIORATION AJOUTÉE (envoi par l'adresse du site) ===
/** Domaines servis par Firebase Hosting, où les réécritures vers les fonctions existent (firebase.json). */
const HOSTING_HOST_RE = /(^|\.)activa-alertes\.com$|\.web\.app$|\.firebaseapp\.com$/i;

/**
 * Adresse du site si les fonctions du déclarant peuvent être appelées par
 * elle (réécritures Firebase Hosting), sinon `null` (développement local,
 * émulateurs, autre hébergeur).
 */
export function sameOriginFunctionsBase(): string | null {
  try {
    if (firebaseEmulatorHost() || typeof window === 'undefined') return null;
    const { protocol, hostname, origin } = window.location;
    return protocol === 'https:' && HOSTING_HOST_RE.test(hostname) ? origin : null;
  } catch {
    return null;
  }
}

let reporterFns: Functions | null = null;

/**
 * === AMÉLIORATION AJOUTÉE (envoi par l'adresse du site) ===
 * Fonctions appelées par le déclarant (dépôt, suivi, messages, pièces) :
 * elles passent par l'adresse du site lui-même (ex. https://activa-alertes.com/
 * createCaseAsReporter, réécrite par Firebase Hosting vers la fonction).
 * Le téléphone qui a chargé la page atteint forcément cette adresse, même
 * quand son réseau (Wi-Fi filtré, opérateur, DNS, bloqueur) ne laisse pas
 * passer l'adresse séparée des fonctions (…cloudfunctions.net) — cause du
 * dépôt du 8 octobre jamais arrivé au serveur. Même origine : pas non plus de
 * requête préalable CORS (un aller-retour réseau de moins sur mobile).
 * Hors Firebase Hosting : mêmes fonctions qu'avant (getPhase4Functions).
 */
export async function getReporterFunctions(): Promise<Functions> {
  if (reporterFns) return reporterFns;
  const base = sameOriginFunctionsBase();
  if (!base) return getPhase4Functions();
  const { app: phase4App } = getPhase4Firebase();
  const { getFunctions } = await import('firebase/functions');
  reporterFns = getFunctions(phase4App, base);
  return reporterFns;
}

// === AMÉLIORATION AJOUTÉE (vérification de bout en bout) ===
/**
 * Attend que Firebase ait rétabli la session (au chargement d'une page, elle
 * n'est connue qu'après quelques instants), au plus `timeoutMs`. `true` si
 * une session du personnel est ouverte.
 */
export async function waitForFirebaseSession(timeoutMs = 6000): Promise<boolean> {
  if (!isPhase4Configured()) return false;
  try {
    const { auth: a } = getPhase4Firebase();
    if (a.currentUser) return true;
    await Promise.race([a.authStateReady(), new Promise((r) => setTimeout(r, timeoutMs))]);
    return Boolean(a.currentUser);
  } catch {
    return false;
  }
}
