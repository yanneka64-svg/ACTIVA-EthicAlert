/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 1) ===
 *
 * Travail du personnel sur un dossier qui n'était jusqu'ici enregistré que
 * dans le navigateur (attribution, statut affiché, clôture, réouverture,
 * escalade, routage indépendant, rapport d'enquête, avancement des tâches,
 * rattachement d'une personne à un compte). Règles PURES, partagées par :
 * - le navigateur : `diffPortalUpdate` calcule, à chaque enregistrement d'un
 *   dossier venant du serveur, ce qui a changé et doit être envoyé ;
 * - la Cloud Function `applyPortalUpdate` : `sanitizePortalPatch` valide
 *   strictement ce qui est reçu (types, longueurs, valeurs autorisées).
 *
 * Le serveur conserve ces informations dans `Case.portal` (relu par
 * caseToAlertSummary.ts), sans toucher au statut réglementaire `Case.status`
 * (toujours modifié par `changeCaseStatus` et son contrôle de transition).
 */
import type { AlertRecord, AlertStatus, SeverityLevel } from '../types';
import type { CaseStatus } from './caseTypes';

export const PORTAL_STATUSES: AlertStatus[] = ['new', 'under_review', 'investigation', 'corrective_action', 'closed', 'archived', 'reopened'];
export const PORTAL_WORKFLOW_STATUSES: CaseStatus[] = [
  'new', 'triage', 'under_review', 'assigned', 'investigation', 'pending_information', 'escalated',
  'conclusion_pending', 'functional_review', 'closed', 'reopened', 'archived', 'duplicate', 'out_of_scope',
];
const SEVERITIES: SeverityLevel[] = ['mineure', 'moderee', 'majeure', 'critique'];

/** Textes longs (synthèse, rapport…) : 20 000 caractères au plus. */
export const PORTAL_LONG_TEXT_FIELDS = ['closureSummary', 'closureMessageToWhistleblower', 'reopenReason', 'investigationReport', 'escalatedReason'] as const;
/** Libellés courts (nom, identifiant) : 200 caractères au plus. */
export const PORTAL_SHORT_TEXT_FIELDS = [
  'closedBy', 'reopenedBy', 'investigationReportBy', 'escalatedBy', 'escalatedOwnerId', 'escalatedRecipientId',
  'independentRoutingFallbackRecipientId', 'targetCompletionDate',
  // === AMÉLIORATION AJOUTÉE (Phase 2) === pièce du serveur contenant le fichier du rapport.
  'investigationReportFileId',
] as const;
/** Dates ISO. */
export const PORTAL_DATE_FIELDS = [
  'closedAt', 'reopenedAt', 'pendingInfoReachedAt', 'reviewReachedAt', 'investigationReportAt', 'escalatedAt',
  'independentRoutingFallbackNotifiedAt',
] as const;

type LongField = (typeof PORTAL_LONG_TEXT_FIELDS)[number];
type ShortField = (typeof PORTAL_SHORT_TEXT_FIELDS)[number];
type DateField = (typeof PORTAL_DATE_FIELDS)[number];

/** Ce que le serveur conserve dans `Case.portal`. */
export type PortalState = Partial<Record<LongField | ShortField | DateField, string>> & {
  status?: AlertStatus;
  workflowStatus?: CaseStatus;
  severity?: SeverityLevel;
  independentRoutingExcludedUserIds?: string[];
  independentRoutingUnresolved?: boolean;
};
export type PortalStateKey = keyof PortalState;

export const PORTAL_KEYS: PortalStateKey[] = [
  'status', 'workflowStatus', 'severity', 'independentRoutingExcludedUserIds', 'independentRoutingUnresolved',
  ...PORTAL_LONG_TEXT_FIELDS, ...PORTAL_SHORT_TEXT_FIELDS, ...PORTAL_DATE_FIELDS,
];

/**
 * Champs que seul le portail connaît (aucune valeur déduite du dossier
 * serveur) : relus du serveur quand il les a, sinon la valeur déjà présente
 * dans le navigateur est conservée puis envoyée une fois au serveur.
 */
export const PORTAL_LOCAL_ONLY_KEYS: PortalStateKey[] = PORTAL_KEYS.filter(
  (k) => k !== 'status' && k !== 'workflowStatus' && k !== 'closedAt' && k !== 'closedBy' && k !== 'targetCompletionDate'
);

export interface PortalTaskUpdate {
  taskId: string;
  status?: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string | null;
  dueDate?: string;
  owner?: string;
  title?: string;
}

export interface PortalPersonLink {
  personId: string;
  linkedUserId: string | null;
}

/** Modifications envoyées au serveur (`null` = effacer le champ). */
export interface PortalPatch {
  portal?: { [K in PortalStateKey]?: PortalState[K] | null };
  assignedInvestigators?: string[];
  taskUpdates?: PortalTaskUpdate[];
  personLinks?: PortalPersonLink[];
}

const TASK_STATUSES = ['not_started', 'in_progress', 'completed', 'cancelled'];

function sameList(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const x = [...(a ?? [])].sort();
  const y = [...(b ?? [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

function portalValue(alert: AlertRecord, key: PortalStateKey): unknown {
  return (alert as unknown as Record<string, unknown>)[key];
}

function equalValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return sameList(a as string[] | undefined, b as string[] | undefined);
  return (a ?? null) === (b ?? null);
}

/**
 * Ce qui a changé entre deux versions d'un dossier et doit être envoyé au
 * serveur. `null` si rien de ce périmètre n'a changé (les messages, notes,
 * tâches ajoutées, personnes ajoutées… ont déjà leur propre envoi).
 */
export function diffPortalUpdate(prev: AlertRecord, next: AlertRecord): PortalPatch | null {
  const patch: PortalPatch = {};

  const portal: NonNullable<PortalPatch['portal']> = {};
  for (const key of PORTAL_KEYS) {
    const before = portalValue(prev, key);
    const after = portalValue(next, key);
    if (equalValue(before, after)) continue;
    (portal as Record<string, unknown>)[key] = after === undefined || after === '' ? null : after;
  }
  if (Object.keys(portal).length) patch.portal = portal;

  if (!sameList(prev.assignedInvestigators, next.assignedInvestigators)) {
    patch.assignedInvestigators = [...(next.assignedInvestigators ?? [])];
  }

  const prevTasks = new Map((prev.tasks ?? []).map((t) => [t.id, t]));
  const taskUpdates: PortalTaskUpdate[] = [];
  for (const t of next.tasks ?? []) {
    const old = prevTasks.get(t.id);
    if (!old) continue; // nouvelle tâche : envoyée par addTask
    const u: PortalTaskUpdate = { taskId: t.id };
    if (old.status !== t.status) u.status = t.status as PortalTaskUpdate['status'];
    if ((old.completedAt ?? null) !== (t.completedAt ?? null)) u.completedAt = t.completedAt ?? null;
    if (old.dueDate !== t.dueDate) u.dueDate = t.dueDate;
    if (old.owner !== t.owner) u.owner = t.owner;
    if (old.title !== t.title) u.title = t.title;
    if (Object.keys(u).length > 1) taskUpdates.push(u);
  }
  if (taskUpdates.length) patch.taskUpdates = taskUpdates;

  const prevPersons = new Map([...(prev.involvedPersons ?? []), ...(prev.witnesses ?? [])].map((p) => [p.id, p]));
  const personLinks: PortalPersonLink[] = [];
  for (const p of [...(next.involvedPersons ?? []), ...(next.witnesses ?? [])]) {
    const old = prevPersons.get(p.id);
    if (!old) continue; // nouvelle personne : envoyée par addPerson
    if ((old.linkedUserId ?? null) !== (p.linkedUserId ?? null)) personLinks.push({ personId: p.id, linkedUserId: p.linkedUserId ?? null });
  }
  if (personLinks.length) patch.personLinks = personLinks;

  return Object.keys(patch).length ? patch : null;
}

/** Fusionne deux envois en attente pour un même dossier (le plus récent l'emporte). */
export function mergePortalPatches(a: PortalPatch, b: PortalPatch): PortalPatch {
  const out: PortalPatch = {};
  if (a.portal || b.portal) out.portal = { ...(a.portal ?? {}), ...(b.portal ?? {}) };
  if (b.assignedInvestigators) out.assignedInvestigators = b.assignedInvestigators;
  else if (a.assignedInvestigators) out.assignedInvestigators = a.assignedInvestigators;
  const tasks = new Map<string, PortalTaskUpdate>();
  for (const u of [...(a.taskUpdates ?? []), ...(b.taskUpdates ?? [])]) tasks.set(u.taskId, { ...(tasks.get(u.taskId) ?? {}), ...u });
  if (tasks.size) out.taskUpdates = [...tasks.values()];
  const links = new Map<string, PortalPersonLink>();
  for (const l of [...(a.personLinks ?? []), ...(b.personLinks ?? [])]) links.set(l.personId, l);
  if (links.size) out.personLinks = [...links.values()];
  return out;
}

const ID_RE = /^[A-Za-z0-9_.@:+-]{1,200}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?([+-]\d{2}:?\d{2})?)?$/;

export class PortalPatchError extends Error {}

function text(v: unknown, max: number, field: string): string {
  if (typeof v !== 'string') throw new PortalPatchError(`${field} must be a string.`);
  if (v.length > max) throw new PortalPatchError(`${field} is too long.`);
  return v;
}

/**
 * Validation stricte d'un envoi reçu par le serveur. Lève PortalPatchError
 * pour toute valeur inattendue (aucune donnée n'est enregistrée dans ce cas).
 */
export function sanitizePortalPatch(input: unknown): PortalPatch {
  if (!input || typeof input !== 'object') throw new PortalPatchError('patch is required.');
  const raw = input as Record<string, unknown>;
  const out: PortalPatch = {};

  if (raw.portal !== undefined) {
    if (!raw.portal || typeof raw.portal !== 'object' || Array.isArray(raw.portal)) throw new PortalPatchError('portal must be an object.');
    const portal: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw.portal as Record<string, unknown>)) {
      if (!(PORTAL_KEYS as string[]).includes(key)) throw new PortalPatchError(`Unknown field ${key}.`);
      if (value === null) {
        portal[key] = null;
        continue;
      }
      if (key === 'status') {
        if (!PORTAL_STATUSES.includes(value as AlertStatus)) throw new PortalPatchError('Invalid status.');
        portal[key] = value;
      } else if (key === 'workflowStatus') {
        if (!PORTAL_WORKFLOW_STATUSES.includes(value as CaseStatus)) throw new PortalPatchError('Invalid workflowStatus.');
        portal[key] = value;
      } else if (key === 'severity') {
        if (!SEVERITIES.includes(value as SeverityLevel)) throw new PortalPatchError('Invalid severity.');
        portal[key] = value;
      } else if (key === 'independentRoutingUnresolved') {
        if (typeof value !== 'boolean') throw new PortalPatchError(`${key} must be a boolean.`);
        portal[key] = value;
      } else if (key === 'independentRoutingExcludedUserIds') {
        if (!Array.isArray(value) || value.length > 50 || value.some((v) => typeof v !== 'string' || !ID_RE.test(v))) {
          throw new PortalPatchError(`${key} must list user ids.`);
        }
        portal[key] = [...new Set(value as string[])];
      } else if ((PORTAL_LONG_TEXT_FIELDS as readonly string[]).includes(key)) {
        portal[key] = text(value, 20000, key);
      } else if ((PORTAL_DATE_FIELDS as readonly string[]).includes(key)) {
        if (!DATE_RE.test(text(value, 40, key))) throw new PortalPatchError(`${key} must be an ISO date.`);
        portal[key] = value;
      } else {
        portal[key] = text(value, 200, key);
      }
    }
    if (Object.keys(portal).length) out.portal = portal as PortalPatch['portal'];
  }

  if (raw.assignedInvestigators !== undefined) {
    const v = raw.assignedInvestigators;
    if (!Array.isArray(v) || v.length > 20 || v.some((x) => typeof x !== 'string' || !ID_RE.test(x))) {
      throw new PortalPatchError('assignedInvestigators must list user ids.');
    }
    out.assignedInvestigators = [...new Set(v as string[])];
  }

  if (raw.taskUpdates !== undefined) {
    const v = raw.taskUpdates;
    if (!Array.isArray(v) || v.length > 100) throw new PortalPatchError('taskUpdates must be a list.');
    out.taskUpdates = v.map((u) => {
      if (!u || typeof u !== 'object') throw new PortalPatchError('Invalid task update.');
      const t = u as Record<string, unknown>;
      if (typeof t.taskId !== 'string' || !ID_RE.test(t.taskId)) throw new PortalPatchError('Invalid taskId.');
      const r: PortalTaskUpdate = { taskId: t.taskId };
      if (t.status !== undefined) {
        if (!TASK_STATUSES.includes(t.status as string)) throw new PortalPatchError('Invalid task status.');
        r.status = t.status as PortalTaskUpdate['status'];
      }
      if (t.completedAt !== undefined) {
        if (t.completedAt !== null && !DATE_RE.test(text(t.completedAt, 40, 'completedAt'))) throw new PortalPatchError('Invalid completedAt.');
        r.completedAt = t.completedAt as string | null;
      }
      if (t.dueDate !== undefined) {
        if (!DATE_RE.test(text(t.dueDate, 40, 'dueDate'))) throw new PortalPatchError('Invalid dueDate.');
        r.dueDate = t.dueDate as string;
      }
      if (t.owner !== undefined) r.owner = text(t.owner, 200, 'owner');
      if (t.title !== undefined) r.title = text(t.title, 300, 'title');
      return r;
    });
  }

  if (raw.personLinks !== undefined) {
    const v = raw.personLinks;
    if (!Array.isArray(v) || v.length > 50) throw new PortalPatchError('personLinks must be a list.');
    out.personLinks = v.map((l) => {
      if (!l || typeof l !== 'object') throw new PortalPatchError('Invalid person link.');
      const p = l as Record<string, unknown>;
      if (typeof p.personId !== 'string' || !ID_RE.test(p.personId)) throw new PortalPatchError('Invalid personId.');
      if (p.linkedUserId !== null && (typeof p.linkedUserId !== 'string' || !ID_RE.test(p.linkedUserId))) {
        throw new PortalPatchError('Invalid linkedUserId.');
      }
      return { personId: p.personId, linkedUserId: p.linkedUserId as string | null };
    });
  }

  if (!Object.keys(out).length) throw new PortalPatchError('Nothing to update.');
  return out;
}

/**
 * Relecture : applique `Case.portal` (enregistré par le serveur) sur la
 * représentation du portail. Les champs absents gardent la valeur déduite
 * du dossier serveur.
 */
export function applyPortalState<T extends object>(record: T, portal: PortalState | undefined | null): T {
  if (!portal || typeof portal !== 'object') return record;
  const out = { ...record } as Record<string, unknown>;
  for (const key of PORTAL_KEYS) {
    const v = (portal as Record<string, unknown>)[key];
    if (v !== undefined && v !== null) out[key] = v;
  }
  return out as T;
}

// === AMÉLIORATION AJOUTÉE (statut vu par le déclarant) ===
const LEGACY_TO_CASE: Record<AlertStatus, CaseStatus> = {
  new: 'new',
  under_review: 'under_review',
  investigation: 'investigation',
  corrective_action: 'conclusion_pending',
  closed: 'closed',
  archived: 'archived',
  reopened: 'reopened',
};
const CASE_TO_LEGACY_BUCKET: Partial<Record<CaseStatus, AlertStatus>> = {
  new: 'new', assigned: 'new', triage: 'under_review', under_review: 'under_review',
  investigation: 'investigation', pending_information: 'investigation', escalated: 'investigation',
  conclusion_pending: 'corrective_action', functional_review: 'corrective_action',
  closed: 'closed', duplicate: 'closed', out_of_scope: 'closed', reopened: 'reopened', archived: 'archived',
};

/**
 * Statut à montrer au déclarant : celui du portail quand il existe (le
 * statut détaillé s'il concorde avec le statut affiché, sinon le statut
 * affiché), à défaut le statut du dossier serveur.
 */
export function portalVisibleCaseStatus(serverStatus: CaseStatus, portal: PortalState | undefined | null): CaseStatus {
  if (!portal) return serverStatus;
  const wf = portal.workflowStatus;
  const legacy = portal.status;
  if (wf && (!legacy || CASE_TO_LEGACY_BUCKET[wf] === legacy)) return wf;
  if (legacy) return LEGACY_TO_CASE[legacy];
  return wf ?? serverStatus;
}

/**
 * === AMÉLIORATION AJOUTÉE (vérification de bout en bout) ===
 * Statut montré au déclarant : l'étape affichée par le portail quand elle
 * existe (ex. « en attente d'informations » reste à l'étape Investigation),
 * sinon le statut détaillé.
 */
export function reporterVisibleCaseStatus(serverStatus: CaseStatus, portal: PortalState | undefined | null): CaseStatus {
  if (portal?.status) return LEGACY_TO_CASE[portal.status];
  return portalVisibleCaseStatus(serverStatus, portal);
}
