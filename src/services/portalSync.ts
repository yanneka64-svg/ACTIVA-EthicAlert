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
import { mergePortalPatches, type PortalPatch } from '../domain/portalUpdate';
import { getPhase4Firebase, getPhase4Functions, isPhase4Configured } from './firebaseClient';

const OUTBOX_KEY = 'activa_portal_outbox_v1';
/** Événement émis après chaque envoi (détail : { caseId, ok, rejected }). */
export const PORTAL_SYNC_EVENT = 'activa-portal-sync';

interface OutboxEntry {
  caseId: string;
  patch: PortalPatch;
  attempts: number;
  queuedAt: string;
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
    return entries.map((e) => (e.caseId === caseId ? { ...e, patch: mergePortalPatches(e.patch, patch) } : e));
  }
  return [...entries, { caseId, patch, attempts: 0, queuedAt: now }];
}

let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function notify(detail: { caseId: string; ok: boolean; rejected?: { part: string; reason: string }[]; error?: string }) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PORTAL_SYNC_EVENT, { detail }));
}

/** Erreurs définitives (droits, données refusées) : inutile de réessayer. */
function isPermanent(code: string | undefined): boolean {
  return ['functions/invalid-argument', 'functions/permission-denied', 'functions/not-found', 'functions/failed-precondition'].includes(code ?? '');
}

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
    const fn = httpsCallable<{ caseId: string; patch: PortalPatch }, { ok: true; applied: string[]; rejected: { part: string; reason: string }[] }>(
      functions,
      'applyPortalUpdate'
    );
    for (const entry of readOutbox()) {
      try {
        const res = await fn({ caseId: entry.caseId, patch: entry.patch });
        writeOutbox(readOutbox().filter((e) => !(e.caseId === entry.caseId && e.queuedAt === entry.queuedAt)));
        if (res.data.rejected?.length) console.warn('[portalSync] partiellement refusé', entry.caseId, res.data.rejected);
        notify({ caseId: entry.caseId, ok: true, rejected: res.data.rejected });
      } catch (e) {
        const code = (e as { code?: string }).code;
        const message = e instanceof Error ? e.message : String(e);
        if (isPermanent(code)) {
          writeOutbox(readOutbox().filter((x) => !(x.caseId === entry.caseId && x.queuedAt === entry.queuedAt)));
          console.warn('[portalSync] refusé par le serveur', entry.caseId, message);
          notify({ caseId: entry.caseId, ok: false, error: message });
        } else {
          writeOutbox(readOutbox().map((x) => (x.caseId === entry.caseId && x.queuedAt === entry.queuedAt ? { ...x, attempts: x.attempts + 1 } : x)));
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
