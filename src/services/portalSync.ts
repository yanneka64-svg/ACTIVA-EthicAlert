/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
 *
 * Envoi au serveur (`applyPortalUpdate`) du travail du personnel sur un
 * dossier : attribution, statut, clôture, réouverture, escalade, routage,
 * rapport, avancement des tâches, rattachement d'une personne à un compte.
 *
 * Appelé par storage.ts à chaque enregistrement d'un dossier venant du
 * serveur. File d'attente conservée dans le navigateur : en cas de coupure
 * réseau, l'envoi est rejoué (toutes les 30 s et au retour du réseau) ; deux
 * envois en attente pour le même dossier sont fusionnés.
 */
import { mergePortalPatches, remainingAfterSend, type PortalPatch } from '../domain/portalUpdate';
import { getPhase4Firebase, getPhase4Functions, isPhase4Configured } from './firebaseClient';

const OUTBOX_KEY = 'activa_portal_outbox_v1';
/** Événement émis après chaque envoi (détail : { caseId, ok, rejected }). */
export const PORTAL_SYNC_EVENT = 'activa-portal-sync';

// === AMÉLIORATION AJOUTÉE (file d'envoi : aucune modification perdue) ===
/** Détail de PORTAL_SYNC_EVENT (écouté par PortalSyncBanner). */
export interface PortalSyncDetail {
  caseId: string;
  ok: boolean;
  rejected?: { part: string; reason: string; current?: unknown }[];
  error?: string;
  /** Champs non enregistrés car modifiés entre-temps par quelqu'un d'autre. */
  conflicts?: string[];
  /** Envoi pas encore abouti (réseau, serveur lent) : toujours en attente. */
  pending?: boolean;
}

interface OutboxEntry {
  caseId: string;
  patch: PortalPatch;
  attempts: number;
  queuedAt: string;
  // === AMÉLIORATION AJOUTÉE (file d'envoi : aucune modification perdue) ===
  // Incrémenté à chaque fusion d'une nouvelle modification : un envoi réussi
  // ne retire l'entrée que si elle n'a pas changé pendant le trajet.
  rev?: number;
}

function readOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  try {
    if (entries.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
    else localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* stockage indisponible : l'envoi immédiat reste tenté */
  }
}

/** Ajoute (ou fusionne) un envoi pour ce dossier. Pur vis-à-vis du réseau. */
export function enqueuePortalPatch(entries: OutboxEntry[], caseId: string, patch: PortalPatch, now = new Date().toISOString()): OutboxEntry[] {
  const existing = entries.find((e) => e.caseId === caseId);
  if (existing) {
    return entries.map((e) => (e.caseId === caseId ? { ...e, patch: mergePortalPatches(e.patch, patch), rev: (e.rev ?? 0) + 1 } : e));
  }
  return [...entries, { caseId, patch, attempts: 0, queuedAt: now }];
}

let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * === AMÉLIORATION AJOUTÉE (file d'envoi : aucune modification perdue) ===
 * Retire de la file l'envoi `sent` qui vient d'aboutir (ou d'être refusé
 * définitivement). Si de nouvelles modifications de ce dossier ont été
 * fusionnées pendant le trajet, seules celles-ci restent en attente — avant,
 * elles étaient supprimées avec l'envoi et donc perdues sans avertissement.
 * Pur vis-à-vis du réseau (testé à part).
 */
export function settleOutboxEntry(entries: OutboxEntry[], sent: OutboxEntry, conflictedKeys: string[] = []): OutboxEntry[] {
  const out: OutboxEntry[] = [];
  for (const e of entries) {
    if (!(e.caseId === sent.caseId && e.queuedAt === sent.queuedAt)) {
      out.push(e);
      continue;
    }
    if ((e.rev ?? 0) === (sent.rev ?? 0)) continue;
    const rest = remainingAfterSend(sent.patch, e.patch, conflictedKeys);
    if (rest) out.push({ ...e, patch: rest, attempts: 0, rev: 0, queuedAt: new Date(Date.parse(e.queuedAt) + 1).toISOString() });
  }
  return out;
}

function notify(detail: PortalSyncDetail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PORTAL_SYNC_EVENT, { detail }));
}

/** Erreurs définitives (droits, données refusées) : inutile de réessayer. */
function isPermanent(code: string | undefined): boolean {
  return ['functions/invalid-argument', 'functions/permission-denied', 'functions/failed-precondition'].includes(code ?? '');
}

/**
 * « Introuvable » peut aussi signifier que la fonction serveur n'est pas
 * encore déployée (quelques minutes lors d'une mise à jour) : envoi conservé
 * et rejoué, abandonné seulement après de nombreux essais (~1 h).
 */
const MAX_NOT_FOUND_ATTEMPTS = 120;

export async function flushPortalOutbox(): Promise<void> {
  if (flushing || !isPhase4Configured()) return;
  // Seule une session du personnel peut enregistrer ce travail : sans
  // session (déclarant, session expirée), les envois restent en attente.
  try {
    if (!getPhase4Firebase().auth.currentUser) return;
  } catch {
    return;
  }
  flushing = true;
  try {
    const functions = await getPhase4Functions();
    const { httpsCallable } = await import('firebase/functions');
    const fn = httpsCallable<{ caseId: string; patch: PortalPatch }, { ok: true; applied: string[]; rejected: { part: string; reason: string; current?: unknown }[] }>(
      functions,
      'applyPortalUpdate'
    );
    for (const entry of readOutbox()) {
      try {
        const res = await fn({ caseId: entry.caseId, patch: entry.patch });
        // === AMÉLIORATION AJOUTÉE (file d'envoi : aucune modification perdue) ===
        const conflicts = (res.data.rejected ?? []).filter((r) => r.reason === 'conflict').map((r) => r.part.replace(/^portal\./, ''));
        writeOutbox(settleOutboxEntry(readOutbox(), entry, conflicts));
        if (res.data.rejected?.length) console.warn('[portalSync] partiellement refusé', entry.caseId, res.data.rejected);
        notify({ caseId: entry.caseId, ok: true, rejected: res.data.rejected, conflicts: conflicts.length ? conflicts : undefined });
      } catch (e) {
        const code = (e as { code?: string }).code;
        const message = e instanceof Error ? e.message : String(e);
        if (isPermanent(code) || (code === 'functions/not-found' && entry.attempts + 1 >= MAX_NOT_FOUND_ATTEMPTS)) {
          // === AMÉLIORATION AJOUTÉE (file d'envoi : aucune modification perdue) ===
          writeOutbox(settleOutboxEntry(readOutbox(), entry));
          console.warn('[portalSync] refusé par le serveur', entry.caseId, message);
          notify({ caseId: entry.caseId, ok: false, error: message });
        } else {
          writeOutbox(readOutbox().map((x) => (x.caseId === entry.caseId && x.queuedAt === entry.queuedAt ? { ...x, attempts: x.attempts + 1 } : x)));
          // === AMÉLIORATION AJOUTÉE (base lente ou injoignable) === après 3
          // essais (~1 min), la personne est prévenue que son travail n'est pas
          // encore enregistré sur le serveur (il reste en attente et sera
          // renvoyé automatiquement).
          if (entry.attempts + 1 === 3) notify({ caseId: entry.caseId, ok: false, pending: true, error: message });
        }
      }
    }
  } catch {
    /* Firebase indisponible : nouvel essai plus tard */
  } finally {
    flushing = false;
  }
}

function scheduleFlush(delayMs: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushPortalOutbox();
  }, delayMs);
}

/** Point d'entrée de storage.ts. */
export function queuePortalUpdate(caseId: string, patch: PortalPatch): void {
  writeOutbox(enqueuePortalPatch(readOutbox(), caseId, patch));
  // court délai : regroupe les enregistrements successifs d'une même action.
  scheduleFlush(400);
}

/** Nombre d'envois en attente (affichable). */
export function pendingPortalUpdates(): number {
  return readOutbox().length;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => scheduleFlush(500));
  setInterval(() => {
    if (readOutbox().length) void flushPortalOutbox();
  }, 30 * 1000);
  if (readOutbox().length) scheduleFlush(3000);
}
