/**
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 4 : miroir de
 * la soumission publique) ===
 *
 * Écriture miroir best-effort, silencieuse, additive du vrai backend
 * (Case/Firestore/Cloud Functions) lors d'une soumission publique — même
 * principe exact que `saveAlertToCloud` (services/firebase.ts) pour le
 * modèle legacy : ne bloque jamais, ne remonte jamais d'erreur à
 * l'appelant, ne change rien à ce que voit le déclarant (le numéro de
 * suivi et le mot de passe affichés restent ceux du modèle local
 * `storage.ts`, seule source de vérité tant que les phases 5/6 n'ont pas
 * migré l'UI — voir docs/DATABASE.md).
 *
 * Appelle la nouvelle Cloud Function `createCaseAsReporter`
 * (functions/src/index.ts, Phase 4) plutôt que `createCase` : ce dernier
 * exige un vrai jeton Firebase Auth avec la permission `cases.create`
 * (personnel uniquement — `reporter` n'a aucune permission dans
 * permissions.ts), injoignable depuis ce formulaire public et anonyme.
 *
 * Toujours un no-op silencieux tant que les Cloud Functions ne sont pas
 * déployées (voir isPhase4Configured — même garde que `isFirebaseConfigured`
 * pour le modèle legacy).
 *
 * === AMÉLIORATION AJOUTÉE (Brancher le vrai backend — Phase 7 : lien
 * dossier local ↔ dossier réel) === Renvoie désormais l'identifiant/numéro
 * du dossier réel créé (au lieu d'un simple booléen) — `null` dans tous les
 * cas d'échec/non-configuré, comme avant. Seul changement de contrat côté
 * appelant : lire `caseId`/`caseNumber` sur le résultat au lieu de tester un
 * booléen ; le comportement best-effort/jamais-bloquant/jamais-rejeté reste
 * identique. Permet à `AlertSubmissionFlow.tsx` de persister ce lien sur
 * l'`AlertRecord` local (types.ts `mirroredCaseId`/`mirroredCaseNumber`),
 * préalable à toute future mise en miroir des mutations ultérieures.
 */
import { Case } from '../domain/caseTypes';
// === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) ===
import type { ReporterCaseDetails } from '../domain/reporterCaseDetails';
import { clampReporterCore } from '../domain/alertToReporterSubmission';
import { firebaseEmulatorHost, getPhase4Config, getPhase4Functions, isPhase4Configured } from './firebaseClient';

export interface CaseMirrorInput {
  category: string;
  subcategory?: string;
  country: string;
  entity: string;
  description: string;
  reportingMode: Case['reportingMode'];
  confidentialityLevel: Case['confidentialityLevel'];
  // === AMÉLIORATION AJOUTÉE (revue PR #139) === identifiants de suivi déjà
  // remis au lanceur d'alerte : le dossier réel s'ouvre avec eux
  // (getCaseForReporter). Le code n'est transmis qu'à notre propre backend,
  // en HTTPS, qui n'en stocke que l'empreinte PBKDF2.
  accessCode?: string;
  externalReference?: string;
  // === AMÉLIORATION AJOUTÉE (numéro de suivi attribué par le serveur) ===
  /** Sans `externalReference` : le serveur attribue le numéro de suivi avec ce code d'entité. */
  entityCode?: string;
  /** Identifiant du dépôt : un nouvel essai renvoie le dossier déjà créé (jamais de doublon). */
  submissionId?: string;
  // === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) ===
  /** Reste du formulaire : dates, lieu, personnes, témoins, impact, risque, identité, pièces. */
  details?: ReporterCaseDetails;
  /** Signalement ancien (code en clair inconnu) : empreinte + sel du code d'accès. */
  accessCodeHash?: string;
  accessCodeSalt?: string;
}

export interface CaseMirrorResult {
  caseId: string;
  caseNumber: string;
  // === AMÉLIORATION AJOUTÉE (numéro de suivi attribué par le serveur) ===
  /** Numéro de suivi remis au déclarant (attribué ou confirmé par le serveur). */
  trackingNumber?: string;
  /** === AMÉLIORATION AJOUTÉE (Phase 2) === session courte pour transmettre les fichiers joints. */
  sessionToken?: string;
}

/** Toujours résout (succès best-effort) — ne rejette jamais, ne doit jamais être `await`é de façon bloquante par l'appelant. `null` si non configuré ou en cas d'échec. */
export async function mirrorSubmissionToRealBackend(input: CaseMirrorInput): Promise<CaseMirrorResult | null> {
  if (!isPhase4Configured()) return null;
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<CaseMirrorInput, CaseMirrorResult>(functions, 'createCaseAsReporter');
    const response = await fn(input);
    return response.data;
  } catch {
    return null;
  }
}

// === AMÉLIORATION AJOUTÉE (dépôt confirmé par le serveur) ===
export type SubmitReportResult =
  | { ok: true; result: CaseMirrorResult }
  | { ok: false; retryable: boolean };

/**
 * Envoie le signalement à Firebase et ATTEND la réponse (au plus
 * `timeoutMs`). Contrairement à `mirrorSubmissionToRealBackend` (envoi en
 * arrière-plan, sans retour), l'appelant sait si le dossier est réellement
 * enregistré : sinon il le garde en file d'attente (submissionOutbox.ts).
 * `retryable: false` = contenu refusé par le serveur (inutile de réessayer).
 */
export async function submitReportToBackend(input: CaseMirrorInput, timeoutMs = 20000): Promise<SubmitReportResult> {
  if (!isPhase4Configured()) return { ok: false, retryable: false };
  // === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
  // Le SDK peut ne jamais émettre la requête sur certains téléphones (jeton
  // App Check ou de session qui ne revient pas, réseau mobile capricieux) :
  // délai global sur le SDK, puis seconds chemins d'envoi (voir plus bas).
  let sdkCode = '';
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<CaseMirrorInput, CaseMirrorResult>(functions, 'createCaseAsReporter', { timeout: timeoutMs });
    // === AMÉLIORATION AJOUTÉE (signalement enregistré EN ENTIER) === cœur
    // ramené aux tailles acceptées par le serveur : un texte très long ne
    // fait jamais refuser l'enregistrement.
    const response = await withDeadline(fn(clampReporterCore(input)), timeoutMs + 5000);
    return { ok: true, result: response.data };
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
    // === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
    // Réponse explicite du serveur : comportement inchangé.
    if (code === 'functions/invalid-argument') return { ok: false, retryable: false };
    if (SERVER_ANSWER_CODES.has(code)) return { ok: false, retryable: true };
    sdkCode = code || 'sdk-error';
  }
  // === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
  // La requête n'a sans doute jamais atteint le serveur : même envoi par le
  // domaine du site (réécriture Firebase Hosting /api/report), puis par
  // l'adresse directe de la fonction. Même `submissionId` : jamais de doublon.
  for (const url of reportFallbackUrls()) {
    const outcome = await postCallableDirect(url, clampReporterCore(input), timeoutMs);
    if (outcome !== 'unreachable') return outcome;
  }
  console.warn('ACTIVA EthicAlert: serveur injoignable pour le dépôt, mis en file d’attente', sdkCode);
  return { ok: false, retryable: true };
}

// === AMÉLIORATION AJOUTÉE (envoi garanti depuis tous les appareils) ===
/** Codes d'erreur renvoyés par le serveur lui-même (la requête est arrivée). */
const SERVER_ANSWER_CODES = new Set([
  'functions/resource-exhausted',
  'functions/permission-denied',
  'functions/failed-precondition',
  'functions/unauthenticated',
  'functions/already-exists',
  'functions/not-found',
  'functions/out-of-range',
]);

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('deadline'), { code: 'client-deadline' })), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Adresses de repli : domaine du site d'abord (même origine), puis la fonction directement. Aucune en émulateur. */
export function reportFallbackUrls(): string[] {
  try {
    if (firebaseEmulatorHost()) return [];
    const urls: string[] = [];
    if (typeof window !== 'undefined' && /^https:$/.test(window.location?.protocol ?? '')) urls.push('/api/report');
    const projectId = getPhase4Config().projectId;
    if (projectId) urls.push(`https://us-central1-${projectId}.cloudfunctions.net/createCaseAsReporter`);
    return urls;
  } catch {
    return [];
  }
}

/** Jeton App Check s'il est disponible en moins de 3 s (jamais bloquant). */
async function quickAppCheckToken(): Promise<string | null> {
  try {
    const { getPhase4Firebase } = await import('./firebaseClient');
    const { getAppCheckToken } = await import('./appCheck');
    return await withDeadline(getAppCheckToken(getPhase4Firebase().app), 3000);
  } catch {
    return null;
  }
}

/**
 * Appel d'une fonction « callable » sans le SDK (protocole HTTP public :
 * POST `{ data }` → `{ result }` ou `{ error: { status } }`). `'unreachable'`
 * si aucune réponse exploitable du serveur.
 */
export async function postCallableDirect(url: string, data: unknown, timeoutMs: number): Promise<SubmitReportResult | 'unreachable'> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const appCheck = await quickAppCheckToken();
    if (appCheck) headers['X-Firebase-AppCheck'] = appCheck;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ data }), credentials: 'omit', signal: ctrl?.signal });
    let json: { result?: CaseMirrorResult; data?: CaseMirrorResult; error?: { status?: string } } | null = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const result = json?.result ?? json?.data;
    if (res.ok && result && typeof result === 'object' && 'caseId' in result) return { ok: true, result };
    if (json?.error?.status) return { ok: false, retryable: json.error.status !== 'INVALID_ARGUMENT' };
    return 'unreachable';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}

