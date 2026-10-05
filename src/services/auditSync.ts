/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 4) ===
 *
 * Piste d'audit commune à tous les postes :
 * - `queuePortalAudit` (appelé par storage.logAudit) copie chaque événement
 *   du portail sur le serveur, par lots, avec une file d'attente hors ligne ;
 *   seule une session du personnel peut l'envoyer (auteur fixé par le serveur) ;
 * - `fetchServerAuditLogs` lit le journal commun (comptes habilités).
 */
import { PORTAL_AUDIT_BATCH_MAX, type ServerAuditRecord } from '../domain/auditTrail';
import type { AuditLogEntry } from '../types';
import { getPhase4Firebase, getPhase4Functions, isPhase4Configured } from './firebaseClient';

const OUTBOX_KEY = 'activa_audit_outbox_v1';
/** Au-delà, les plus anciens événements non transmis sont abandonnés (le journal local les garde). */
const OUTBOX_MAX = 500;

type OutboxEntry = Pick<AuditLogEntry, 'id' | 'actionType' | 'details' | 'alertId' | 'trackingNumber' | 'timestamp'>;

function readOutbox(): OutboxEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  try {
    if (entries.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries.slice(-OUTBOX_MAX)));
    else localStorage.removeItem(OUTBOX_KEY);
  } catch {
    /* stockage indisponible */
  }
}

function signedIn(): boolean {
  try {
    return isPhase4Configured() && Boolean(getPhase4Firebase().auth.currentUser);
  } catch {
    return false;
  }
}

async function callable<Req, Res>(name: string) {
  const functions = await getPhase4Functions();
  const { httpsCallable } = await import('firebase/functions');
  return httpsCallable<Req, Res>(functions, name);
}

let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function flushAuditOutbox(): Promise<void> {
  if (flushing || !signedIn()) return;
  flushing = true;
  try {
    const fn = await callable<{ entries: OutboxEntry[] }, { ok: true }>('recordPortalAudit');
    for (let guard = 0; guard < 20; guard++) {
      const batch = readOutbox().slice(0, PORTAL_AUDIT_BATCH_MAX);
      if (!batch.length) break;
      try {
        await fn({ entries: batch });
      } catch (e) {
        if ((e as { code?: string }).code !== 'functions/invalid-argument') break; // réseau : plus tard
      }
      const sent = new Set(batch.map((b) => b.id));
      writeOutbox(readOutbox().filter((x) => !sent.has(x.id)));
    }
  } catch {
    /* Firebase indisponible */
  } finally {
    flushing = false;
  }
}

/** Point d'entrée de storage.logAudit. */
export function queuePortalAudit(entry: AuditLogEntry): void {
  const { id, actionType, details, alertId, trackingNumber, timestamp } = entry;
  writeOutbox([...readOutbox(), { id, actionType, details, alertId, trackingNumber, timestamp }]);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushAuditOutbox();
  }, 1500);
}

/** Journal commun (null si indisponible ou non autorisé). */
export async function fetchServerAuditLogs(limit = 500): Promise<ServerAuditRecord[] | null> {
  if (!signedIn()) return null;
  try {
    await flushAuditOutbox();
    const fn = await callable<{ limit: number }, { entries: ServerAuditRecord[] }>('listAuditLogs');
    return (await fn({ limit })).data.entries;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushAuditOutbox());
  setInterval(() => {
    if (readOutbox().length) void flushAuditOutbox();
  }, 30 * 1000);
}
