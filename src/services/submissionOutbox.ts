/**
 * === AMÉLIORATION AJOUTÉE (dépôt confirmé par le serveur) ===
 *
 * File d'attente des signalements qui n'ont pas pu être transmis à Firebase
 * au moment du dépôt (réseau mobile coupé, serveur injoignable…). Chaque
 * signalement en attente est renvoyé automatiquement : au chargement de
 * l'application, au retour de la connexion (`online`) et toutes les 60 s.
 *
 * Chaque envoi porte le même `submissionId` : un essai qui aurait abouti
 * côté serveur sans réponse côté navigateur ne crée jamais de doublon, et le
 * numéro de suivi déjà remis au déclarant (`externalReference`) reste
 * valable. Une fois transmis, le signalement est retiré de la file et la
 * copie locale est liée au dossier Firebase.
 *
 * Le code d'accès du déclarant est conservé dans la file jusqu'à
 * l'envoi (le serveur n'en garde que l'empreinte) ; la copie locale du
 * signalement est de toute façon déjà présente sur cet appareil.
 */
import { CaseMirrorInput, submitReportToBackend } from './casesCloudSync';
import { storage } from './storage';
// === AMÉLIORATION AJOUTÉE (aucun signalement perdu) ===
import { buildBackfillSubmission, isLocalOnlyPublicReport } from '../domain/alertToReporterSubmission';

const KEY = 'activa_submission_outbox_v1';
const MAX_ATTEMPTS = 500;

export interface OutboxItem {
  localId: string;
  input: CaseMirrorInput;
  attempts: number;
  queuedAt: string;
  // === AMÉLIORATION AJOUTÉE (aucun signalement perdu) ===
  /** Envoi refusé par le serveur : conservé (jamais supprimé), renvoyé une fois par jour. */
  rejectedAt?: string;
  /** Déjà renvoyé sans ses détails après un refus (dernier recours avant `rejectedAt`). */
  detailsStripped?: boolean;
}

// === AMÉLIORATION AJOUTÉE (aucun signalement perdu) ===
const REJECTED_RETRY_MS = 24 * 60 * 60 * 1000;

function isDue(item: OutboxItem, now: number): boolean {
  if (!item.rejectedAt) return true;
  const t = Date.parse(item.rejectedAt);
  return Number.isNaN(t) || now - t >= REJECTED_RETRY_MS;
}

/** Copie de l'envoi réduite au cœur du signalement (sans détails ni empreinte), pour un dernier essai. */
function withoutDetails(input: CaseMirrorInput): CaseMirrorInput {
  const { details: _details, accessCodeHash: _hash, accessCodeSalt: _salt, ...core } = input;
  return core;
}

/**
 * === AMÉLIORATION AJOUTÉE (aucun signalement perdu) ===
 * Ajoute à la file chaque signalement du formulaire public resté sur cet
 * appareil sans jamais avoir été transmis (déposé avant l'envoi au serveur,
 * ou perdu par une ancienne version). Renvoie le nombre de signalements ajoutés.
 */
export function enqueueLocalOnlyReports(): number {
  let alerts;
  try {
    alerts = storage.getAlerts();
  } catch {
    return 0;
  }
  const items = read();
  const queued = new Set(items.map((i) => i.localId));
  let added = 0;
  for (const alert of alerts) {
    if (queued.has(alert.id) || !isLocalOnlyPublicReport(alert)) continue;
    items.push({ localId: alert.id, input: buildBackfillSubmission(alert), attempts: 0, queuedAt: new Date().toISOString() });
    added += 1;
  }
  if (added) write(items);
  return added;
}

function read(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* stockage indisponible : rien à faire */
  }
}

export function pendingSubmissionCount(): number {
  return read().length;
}

export function enqueueSubmission(localId: string, input: CaseMirrorInput): void {
  const items = read().filter((i) => i.localId !== localId);
  items.push({ localId, input, attempts: 0, queuedAt: new Date().toISOString() });
  write(items);
}

let flushing: Promise<number> | null = null;

/** Renvoie les signalements en attente. Renvoie le nombre de signalements transmis. */
export function flushSubmissionOutbox(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    const now = Date.now();
    for (const item of read()) {
      // === AMÉLIORATION AJOUTÉE (aucun signalement perdu) === un envoi
      // refusé n'est plus jamais supprimé : renvoyé sans ses détails, puis
      // conservé et renvoyé une fois par jour.
      if (!isDue(item, now)) continue;
      const res = await submitReportToBackend(item.input);
      const remaining = read().filter((i) => i.localId !== item.localId);
      if (res.ok === true) {
        storage.linkMirroredCase(item.localId, res.result.caseId, res.result.caseNumber);
        write(remaining);
        sent += 1;
      } else if (!res.retryable && !item.detailsStripped && (item.input.details || item.input.accessCodeHash)) {
        write([...remaining, { ...item, input: withoutDetails(item.input), detailsStripped: true, attempts: item.attempts + 1 }]);
      } else if (!res.retryable || item.attempts + 1 >= MAX_ATTEMPTS) {
        console.error('ACTIVA EthicAlert: signalement refusé par le serveur, conservé pour un nouvel essai', item.localId);
        write([...remaining, { ...item, attempts: item.attempts + 1, rejectedAt: new Date().toISOString() }]);
      } else {
        write([...remaining, { ...item, attempts: item.attempts + 1 }]);
      }
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Démarre le renvoi automatique (au démarrage, au retour du réseau, toutes les 60 s). Renvoie la fonction d'arrêt. */
export function startSubmissionOutbox(): () => void {
  const tick = () => {
    // === AMÉLIORATION AJOUTÉE (aucun signalement perdu) === rattrapage des
    // signalements restés sur l'appareil, puis envoi.
    enqueueLocalOnlyReports();
    if (read().length > 0) void flushSubmissionOutbox();
  };
  tick();
  window.addEventListener('online', tick);
  const id = window.setInterval(tick, 60 * 1000);
  return () => {
    window.removeEventListener('online', tick);
    window.clearInterval(id);
  };
}
