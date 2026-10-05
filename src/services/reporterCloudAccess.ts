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
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';
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
  return httpsCallable<I, O>(await getPhase4Functions(), name);
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
