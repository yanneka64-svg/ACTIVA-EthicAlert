/// <reference types="vite/client" />
import { initializeApp, getApps, FirebaseApp, deleteApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  onSnapshot 
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { AlertRecord, AuditLogEntry } from '../types';

const metaEnv = (import.meta as any).env || {};

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const LOCAL_STORAGE_FIREBASE_KEY = 'activa_firebase_custom_config_v1';

// Read config priority: 1) LocalStorage overrides, 2) Environment variables
export const getActiveFirebaseConfig = (): FirebaseConfigOptions => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_FIREBASE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch {
      // ignore parsing error
    }
  }

  return {
    apiKey: metaEnv.VITE_FIREBASE_API_KEY || '',
    authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: metaEnv.VITE_FIREBASE_APP_ID || '',
  };
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isInitialized = false;

// Check if valid Firebase configuration is present
export const isFirebaseConfigured = (): boolean => {
  const conf = getActiveFirebaseConfig();
  return Boolean(
    conf.apiKey && 
    conf.projectId && 
    conf.apiKey.length > 5
  );
};

export const initFirebase = (forceReinit = false) => {
  if (isInitialized && !forceReinit) {
    return { app, db, auth, isConfigured: isFirebaseConfigured() };
  }

  const conf = getActiveFirebaseConfig();

  if (conf.apiKey && conf.projectId) {
    try {
      if (getApps().length > 0) {
        app = getApps()[0];
      } else {
        app = initializeApp(conf);
      }
      db = getFirestore(app);
      auth = getAuth(app);
      console.log(`ACTIVA EthicAlert: Firebase Firestore initialisé pour le projet [${conf.projectId}].`);
    } catch (err) {
      console.warn('ACTIVA EthicAlert: Erreur initialisation Firebase, passage en mode résilient local', err);
    }
  } else {
    console.info('ACTIVA EthicAlert: Configuration Firebase en attente de rattachement au projet ACTIVA EthicAlert.');
  }

  isInitialized = true;
  return { app, db, auth, isConfigured: isFirebaseConfigured() };
};

// Save custom Firebase config into storage for instant runtime connection
export const setCustomFirebaseConfig = (config: FirebaseConfigOptions) => {
  localStorage.setItem(LOCAL_STORAGE_FIREBASE_KEY, JSON.stringify(config));
  isInitialized = false;
  return initFirebase(true);
};

// Clear custom Firebase config
export const clearCustomFirebaseConfig = () => {
  localStorage.removeItem(LOCAL_STORAGE_FIREBASE_KEY);
  isInitialized = false;
  return initFirebase(true);
};

// Cloud save helper for Alerts
export const saveAlertToCloud = async (alert: AlertRecord): Promise<boolean> => {
  const { db, isConfigured } = initFirebase();
  if (!isConfigured || !db) return false;

  try {
    const alertRef = doc(db, 'alerts', alert.id);
    await setDoc(alertRef, alert, { merge: true });
    return true;
  } catch (err) {
    console.warn('Erreur synchronisation Firestore pour le dossier ' + alert.trackingNumber, err);
    return false;
  }
};

// Cloud save audit log helper
export const saveAuditLogToCloud = async (log: AuditLogEntry): Promise<boolean> => {
  const { db, isConfigured } = initFirebase();
  if (!isConfigured || !db) return false;

  try {
    const logRef = doc(db, 'audit_logs', log.id);
    await setDoc(logRef, log);
    return true;
  } catch (err) {
    console.warn('Erreur écriture audit log Firestore', err);
    return false;
  }
};

// Fetch alerts from cloud
export const fetchAlertsFromCloud = async (): Promise<AlertRecord[]> => {
  const { db, isConfigured } = initFirebase();
  if (!isConfigured || !db) return [];

  try {
    const colRef = collection(db, 'alerts');
    const snapshot = await getDocs(colRef);
    const results: AlertRecord[] = [];
    snapshot.forEach((doc) => {
      results.push(doc.data() as AlertRecord);
    });
    return results;
  } catch (err) {
    console.warn('Erreur lecture Firestore alerts', err);
    return [];
  }
};

// Export active db instance
export { db, auth };
