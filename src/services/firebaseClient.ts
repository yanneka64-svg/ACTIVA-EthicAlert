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
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

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
  auth = getAuth(app);
  db = getFirestore(app, config.databaseId);
  return { app, auth, db };
}
