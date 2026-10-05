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

const KEY = 'activa_submission_outbox_v1';
const MAX_ATTEMPTS = 500;

export interface OutboxItem {
  localId: string;
  input: CaseMirrorInput;
  attempts: number;
  queuedAt: string;
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
    for (const item of read()) {
      const res = await submitReportToBackend(item.input);
      const remaining = read().filter((i) => i.localId !== item.localId);
      if (res.ok === true) {
        storage.linkMirroredCase(item.localId, res.result.caseId, res.result.caseNumber);
        write(remaining);
        sent += 1;
      } else if (!res.retryable || item.attempts + 1 >= MAX_ATTEMPTS) {
        write(remaining);
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
