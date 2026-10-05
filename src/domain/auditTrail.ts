/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 4) ===
 *
 * Piste d'audit centralisée sur le serveur (`audit_logs`) :
 * - chaque événement enregistré par le portail (storage.logAudit) y est
 *   copié (recordPortalAudit : auteur et adresse IP fixés par le serveur,
 *   jamais par le navigateur) ;
 * - les actions faites directement sur le serveur (attribution, statut,
 *   pièces, téléchargements, comptes…) y sont déjà inscrites.
 * L'écran « Piste d'audit » affiche ce journal commun à tous les postes.
 * Règles pures partagées par le navigateur et les Cloud Functions.
 */
import type { AuditLogEntry } from '../types';

export const PORTAL_AUDIT_BATCH_MAX = 50;
const ENTRY_ID_RE = /^[A-Za-z0-9_.:-]{3,80}$/;
const ACTION_RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

export interface PortalAuditInput {
  id: string;
  actionType: string;
  details: string;
  alertId?: string;
  trackingNumber?: string;
  timestamp: string;
}

/** Validation stricte d'un lot reçu par le serveur (entrées invalides ignorées). */
export function sanitizePortalAuditBatch(raw: unknown): PortalAuditInput[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > PORTAL_AUDIT_BATCH_MAX) {
    throw new Error(`entries must list 1 to ${PORTAL_AUDIT_BATCH_MAX} events.`);
  }
  const out: PortalAuditInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (typeof e.id !== 'string' || !ENTRY_ID_RE.test(e.id)) continue;
    if (typeof e.actionType !== 'string' || !ACTION_RE.test(e.actionType)) continue;
    if (typeof e.timestamp !== 'string' || !DATE_RE.test(e.timestamp)) continue;
    out.push({
      id: e.id,
      actionType: e.actionType,
      details: typeof e.details === 'string' ? e.details.slice(0, 4000) : '',
      ...(typeof e.alertId === 'string' && e.alertId.length <= 128 ? { alertId: e.alertId } : {}),
      ...(typeof e.trackingNumber === 'string' && e.trackingNumber.length <= 64 ? { trackingNumber: e.trackingNumber } : {}),
      timestamp: e.timestamp,
    });
  }
  return out;
}

/** Événement tel que renvoyé par listAuditLogs. */
export interface ServerAuditRecord {
  id: string;
  source?: 'portal' | 'server';
  portalEntryId?: string;
  action: string;
  details?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  caseId?: string;
  alertId?: string;
  trackingNumber?: string;
  objectType?: string;
  objectId?: string;
  reason?: string;
  timestamp: string;
  ipAddress?: string;
}

/** Libellés des actions inscrites directement par le serveur. */
const SERVER_ACTION_LABELS: Record<string, string> = {
  CASE_CREATED_BY_REPORTER: 'Signalement déposé (serveur)',
  CASE_CREATED: 'Dossier créé (serveur)',
  CASE_ASSIGNED: 'Attribution du dossier enregistrée sur le serveur',
  STATUS_CHANGED: 'Changement de statut enregistré sur le serveur',
  STATUS_CHANGE_REJECTED: 'Changement de statut refusé par le serveur',
  PORTAL_CASE_UPDATED: 'Travail sur le dossier enregistré sur le serveur',
  TASKS_UPDATED: 'Avancement des tâches enregistré sur le serveur',
  PERSON_LINKED_TO_USER: 'Personne rattachée à un compte',
  PERSON_LINK_REMOVED: 'Rattachement d’une personne retiré',
  EVIDENCE_ADDED_BY_REPORTER: 'Document transmis par le déclarant',
  EVIDENCE_UPLOADED: 'Pièce ajoutée par l’équipe',
  EVIDENCE_DOWNLOADED: 'Pièce téléchargée',
  REPORTER_IDENTITY_ACCESSED: 'Consultation de l’identité du déclarant',
  CONFIG_UPDATED: 'Configuration partagée modifiée',
};

/** Convertit un événement du serveur dans la forme affichée par l'écran. */
export function serverAuditToEntry(r: ServerAuditRecord): AuditLogEntry {
  const label = SERVER_ACTION_LABELS[r.action] ?? r.action;
  const extra = [r.objectType && r.objectId ? `${r.objectType} ${r.objectId}` : '', r.reason ?? ''].filter(Boolean).join(' — ');
  return {
    id: r.portalEntryId ?? r.id,
    ...(r.alertId ? { alertId: r.alertId } : {}),
    ...(r.trackingNumber ? { trackingNumber: r.trackingNumber } : {}),
    authorId: r.actorId ?? '',
    authorName: r.actorName || (r.actorId === 'reporter' ? 'Lanceur d’alerte' : r.actorId === 'maintenance' ? 'Maintenance' : r.actorId ?? ''),
    authorRole: r.actorRole ?? '',
    actionType: r.action as AuditLogEntry['actionType'],
    details: r.source === 'portal' ? r.details ?? '' : `${label}${extra ? ` (${extra})` : ''}`,
    timestamp: r.timestamp,
    ...(r.ipAddress ? { ipAddress: r.ipAddress } : {}),
  };
}

/**
 * Journal affiché : celui du serveur (tous les postes), complété par les
 * événements de ce navigateur pas encore transmis. Du plus récent au plus ancien.
 */
export function mergeAuditLogs(local: AuditLogEntry[], server: ServerAuditRecord[] | null): AuditLogEntry[] {
  if (!server) return local;
  const fromServer = server.map(serverAuditToEntry);
  const known = new Set(fromServer.map((e) => e.id));
  return [...fromServer, ...local.filter((e) => !known.has(e.id))].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}
