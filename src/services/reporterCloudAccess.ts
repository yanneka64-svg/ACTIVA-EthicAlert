/**
 * === AMÉLIORATION AJOUTÉE (suivi du déclarant depuis n'importe quel
 * appareil) ===
 *
 * Accès du déclarant à son dossier enregistré dans Firebase, avec son numéro
 * de suivi et son mot de passe (Cloud Functions `getCaseForReporter` et
 * `addCommunicationAsReporter`, sans compte : le serveur vérifie le mot de
 * passe et limite les tentatives). C'est ce qui permet de suivre un
 * signalement depuis un autre téléphone ou ordinateur que celui du dépôt,
 * et de voir les réponses et changements de statut de l'équipe.
 *
 * Ne lève jamais : un résultat `{ ok: false }` indique la raison.
 */
import { getPhase4Functions, getReporterFunctions, isPhase4Configured } from './firebaseClient';
import type { ReporterCasePayload } from '../domain/reporterCaseToAlert';

export type ReporterAccessResult =
  | { ok: true; payload: ReporterCasePayload }
  | { ok: false; reason: 'denied' | 'locked' | 'unavailable' };

function reasonOf(e: unknown): 'denied' | 'locked' | 'unavailable' {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === 'functions/permission-denied' || code === 'functions/invalid-argument' || code === 'functions/not-found') return 'denied';
  if (code === 'functions/resource-exhausted') return 'locked';
  return 'unavailable';
}

async function callable<I, O>(name: string) {
  const { httpsCallable } = await import('firebase/functions');
  // === AMÉLIORATION AJOUTÉE (envoi par l'adresse du site) ===
  return httpsCallable<I, O>(await getReporterFunctions(), name);
}

export function isReporterCloudConfigured(): boolean {
  return isPhase4Configured();
}

export async function openReporterCase(caseNumber: string, accessCode: string): Promise<ReporterAccessResult> {
  if (!isPhase4Configured()) return { ok: false, reason: 'unavailable' };
  try {
    const fn = await callable<{ caseNumber: string; accessCode: string }, ReporterCasePayload>('getCaseForReporter');
    const res = await fn({ caseNumber, accessCode });
    return { ok: true, payload: res.data };
  } catch (e) {
    return { ok: false, reason: reasonOf(e) };
  }
}

export async function sendReporterMessage(caseNumber: string, accessCode: string, content: string): Promise<boolean> {
  if (!isPhase4Configured()) return false;
  try {
    const fn = await callable<{ caseNumber: string; accessCode: string; content: string }, unknown>('addCommunicationAsReporter');
    await fn({ caseNumber, accessCode, content });
    return true;
  } catch {
    return false;
  }
}

// === AMÉLIORATION AJOUTÉE (messagerie déclarant ↔ équipe) ===
// Juste après un dépôt, « Suivre mon signalement » ouvrait la copie LOCALE
// du dossier (sans mot de passe) : elle ne reçoit jamais les réponses de
// l'équipe. Le code d'accès que le déclarant vient de recevoir est gardé
// EN MÉMOIRE seulement (jamais enregistré, perdu au rechargement de la
// page) pour ouvrir directement la version du serveur.
const pendingAccess = new Map<string, string>();

export function rememberReporterAccess(trackingNumber: string, accessCode: string): void {
  if (trackingNumber && accessCode) pendingAccess.set(trackingNumber.trim().toUpperCase(), accessCode);
}

/** Code d'accès gardé en mémoire pour ce numéro (lu une seule fois), ou `null`. */
export function takeReporterAccess(trackingNumber: string): string | null {
  const key = (trackingNumber || '').trim().toUpperCase();
  const code = pendingAccess.get(key) ?? null;
  pendingAccess.delete(key);
  return code;
}

// ---------------------------------------------------------------------------
// === AMÉLIORATION AJOUTÉE (échanges instantanés, documents du déclarant) ===
// Conversation en direct avec une session courte (remise par
// getCaseForReporter) : rafraîchie toutes les quelques secondes, signale
// « en train d'écrire », envoie messages et documents sans revérifier le
// mot de passe à chaque fois.
// ---------------------------------------------------------------------------
import type { ReporterSafeMessage } from '../domain/conversation';

export interface ReporterConversationState {
  status: string;
  communications: ReporterSafeMessage[];
  teamTypingAt: string | null;
  /** Session renouvelée par le serveur (à utiliser pour les appels suivants). */
  sessionToken?: string;
}

/** `typing` : true = le déclarant écrit, false = il a arrêté, absent = simple lecture. */
export async function pollReporterConversation(sessionToken: string, typing?: boolean): Promise<ReporterConversationState | null> {
  if (!isPhase4Configured() || !sessionToken) return null;
  try {
    const fn = await callable<{ sessionToken: string; typing?: boolean }, ReporterConversationState>('reporterConversation');
    const res = await fn(typing === undefined ? { sessionToken } : { sessionToken, typing });
    return res.data;
  } catch {
    return null;
  }
}

export async function sendReporterMessageWithSession(sessionToken: string, content: string): Promise<boolean> {
  if (!isPhase4Configured() || !sessionToken) return false;
  try {
    const fn = await callable<{ sessionToken: string; content: string }, unknown>('addCommunicationAsReporter');
    await fn({ sessionToken, content });
    return true;
  } catch {
    return false;
  }
}

/** Lit un fichier du navigateur en base64 (sans l'en-tête data:). */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type SendFileResult = { ok: true } | { ok: false; reason: 'too_large' | 'too_many' | 'expired' | 'failed' };

/** Envoie un document à l'équipe (avec un message facultatif). */
export async function sendReporterFile(sessionToken: string, file: File, message?: string): Promise<SendFileResult> {
  const { REPORTER_FILE_MAX_BYTES } = await import('../domain/conversation');
  if (file.size > REPORTER_FILE_MAX_BYTES) return { ok: false, reason: 'too_large' };
  if (!isPhase4Configured() || !sessionToken) return { ok: false, reason: 'failed' };
  try {
    const dataBase64 = await fileToBase64(file);
    const fn = await callable<{ sessionToken: string; fileName: string; fileType: string; dataBase64: string; message?: string }, unknown>(
      'addEvidenceAsReporter'
    );
    await fn({ sessionToken, fileName: file.name, fileType: file.type || 'application/octet-stream', dataBase64, ...(message ? { message } : {}) });
    return { ok: true };
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
    if (code === 'functions/resource-exhausted') return { ok: false, reason: 'too_many' };
    if (code === 'functions/unauthenticated') return { ok: false, reason: 'expired' };
    if (code === 'functions/invalid-argument') return { ok: false, reason: 'too_large' };
    return { ok: false, reason: 'failed' };
  }
}
