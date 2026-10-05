/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P1 : Firebase App Check) ===
 *
 * App Check atteste que les appels à Firestore / Auth / Cloud Functions
 * viennent bien de CETTE application (et non d'un script qui aurait
 * récupéré la clé API Web, publique par nature).
 *
 * DORMANT tant que `VITE_FIREBASE_APPCHECK_SITE_KEY` n'est pas défini au
 * build : aucun changement de comportement ni de bundle initial (le SDK
 * `firebase/app-check` n'est chargé dynamiquement que si la clé existe).
 *
 * Mise en service (docs/DEVOPS-RUNBOOK.md §App Check) :
 * 1. créer une clé reCAPTCHA Enterprise pour les domaines de l'app ;
 * 2. l'enregistrer dans Firebase Console → App Check (application Web) ;
 * 3. définir le secret GitHub VITE_FIREBASE_APPCHECK_SITE_KEY et redéployer ;
 * 4. observer les métriques « vérifiées / non vérifiées » quelques jours,
 *    PUIS seulement activer l'application stricte (« Enforce ») par service.
 *
 * === AMÉLIORATION AJOUTÉE (correctif App Check) === le SDK est désormais
 * importé statiquement (voir plus bas) : sans clé, il reste chargé mais
 * inactif (aucun appel réseau, aucun script reCAPTCHA).
 */
import type { FirebaseApp } from 'firebase/app';
import type { AppCheck } from 'firebase/app-check';
// === AMÉLIORATION AJOUTÉE (correctif App Check — requêtes « non validées ») ===
// Import STATIQUE : App Check doit être initialisé AVANT getAuth() /
// getFirestore() (exigence Firebase). Avec l'ancien `await import(...)`,
// l'initialisation arrivait après la création d'Auth/Firestore : les
// premières requêtes de chaque visite partaient sans jeton et étaient
// comptées « non validées » (≈ 47 % Firestore / 22 % Auth en console).
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken as getAppCheckTokenSdk } from 'firebase/app-check';

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

const activated = new WeakSet<FirebaseApp>();
// === AMÉLIORATION AJOUTÉE (revue PR #139 — appelant vérifié pour notifyEmail) ===
// Instance App Check par application, pour pouvoir en extraire un jeton
// (getAppCheckToken) à joindre aux appels HTTP qui ne passent pas par un SDK.
const instances = new WeakMap<FirebaseApp, AppCheck>();

export function getAppCheckSiteKey(): string {
  // === AMÉLIORATION AJOUTÉE (correctif App Check) === repli sur la forme
  // littérale `import.meta.env.X` (remplacée de la même façon par Vite au
  // build) : la forme castée ci-dessus n'est pas transformée par Vitest,
  // ce qui empêchait de tester l'activation (appCheck.test.ts).
  const literal = (() => {
    try {
      return import.meta.env?.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;
    } catch {
      return undefined;
    }
  })();
  return (metaEnv.VITE_FIREBASE_APPCHECK_SITE_KEY || literal || '').trim();
}

/**
 * Active App Check (reCAPTCHA Enterprise) une seule fois par instance
 * Firebase. Sans effet si la clé n'est pas configurée ou hors navigateur.
 * Ne lève jamais : un échec est journalisé et l'application continue comme
 * avant (en mode « surveillance », les requêtes non attestées passent).
 */
export async function activateAppCheck(app: FirebaseApp | null | undefined): Promise<boolean> {
  const siteKey = getAppCheckSiteKey();
  if (!app || !siteKey || typeof window === 'undefined' || activated.has(app)) return false;
  activated.add(app);
  try {
    // === AMÉLIORATION AJOUTÉE (correctif App Check) === initialisation
    // synchrone (aucun `await` avant) : effective dès le retour de l'appel
    // `void activateAppCheck(app)`, donc avant getAuth()/getFirestore().
    const instance = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
    instances.set(app, instance);
    return true;
  } catch (err) {
    console.warn('ACTIVA EthicAlert: App Check non activé', err);
    return false;
  }
}

/**
 * === AMÉLIORATION AJOUTÉE (revue PR #139 — appelant vérifié pour notifyEmail) ===
 * Jeton App Check courant de `app`, ou `null` si App Check n'est pas actif
 * (clé absente, activation en cours ou en échec). Ne lève jamais.
 */
export async function getAppCheckToken(app: FirebaseApp | null | undefined): Promise<string | null> {
  const instance = app ? instances.get(app) : undefined;
  if (!instance) return null;
  try {
    // === AMÉLIORATION AJOUTÉE (correctif App Check) === SDK importé statiquement.
    return (await getAppCheckTokenSdk(instance, false)).token;
  } catch {
    return null;
  }
}
