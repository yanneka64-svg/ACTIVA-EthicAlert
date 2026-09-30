/**
 * === AMÉLIORATION AJOUTÉE (Audit DevOps — P0 : plus de perte de données silencieuse) ===
 *
 * Jusqu'ici, quand `localStorage.setItem` échouait (quota ~5 Mo dépassé —
 * typiquement des pièces jointes stockées en base64 — ou stockage bloqué
 * par le navigateur), StorageService se contentait d'un `console.error` :
 * l'écran affichait « envoyé / enregistré » alors que RIEN n'avait été
 * sauvegardé, et tout disparaissait au rechargement de la page.
 *
 * Ce module ne change aucun flux : StorageService continue exactement
 * comme avant (même `console.error`, même absence d'exception), et signale
 * EN PLUS l'échec par un événement navigateur que `PersistFailureBanner`
 * (monté une fois dans App.tsx) affiche à l'utilisateur.
 */

export const PERSIST_FAILURE_EVENT = 'activa:persist-failure';

export interface PersistFailureDetail {
  /** Ce qui n'a pas pu être enregistré (ex. « alerts », « audit logs »). */
  what: string;
  /** `true` quand l'échec vient du quota de stockage du navigateur. */
  quotaExceeded: boolean;
}

/** Reconnaît l'erreur de quota quel que soit le navigateur (Chrome, Firefox, Safari). */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; code?: number };
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
}

// Dernier échec connu : un échec survenu AVANT le montage de la bannière
// (ex. au chargement initial de StorageService) reste affichable.
let lastFailure: PersistFailureDetail | null = null;

export function getLastPersistFailure(): PersistFailureDetail | null {
  return lastFailure;
}

/** Signale un échec d'enregistrement ; sans effet hors navigateur (tests Node, Cloud Functions). */
export function reportPersistFailure(what: string, error: unknown): void {
  const detail: PersistFailureDetail = { what, quotaExceeded: isQuotaExceededError(error) };
  lastFailure = detail;
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new CustomEvent<PersistFailureDetail>(PERSIST_FAILURE_EVENT, { detail }));
  } catch {
    // Le signalement ne doit jamais casser l'appelant (même contrat qu'avant : aucune exception).
  }
}
