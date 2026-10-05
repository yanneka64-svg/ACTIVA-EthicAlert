/**
 * === AMÉLIORATION AJOUTÉE (Brancher tout le portail au serveur — Phase 2) ===
 *
 * Envoi au serveur des documents jusqu'ici conservés dans le seul navigateur :
 * - fichiers joints par le déclarant au formulaire de signalement (aussitôt
 *   après le dépôt, avec la session remise par le serveur ; sinon à sa
 *   prochaine connexion à l'espace de suivi depuis le même appareil) ;
 * - pièces et fichier du rapport d'enquête ajoutés par le personnel.
 * Le personnel les télécharge ensuite depuis n'importe quel poste
 * (getEvidenceFileForStaff, accès audité).
 */
import type { AlertRecord, EvidenceFile } from '../types';
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';

/** 7 Mo : même limite que le serveur (domain/conversation.ts). */
const MAX_BYTES = 7 * 1024 * 1024;
const UPLOADED_KEY = 'activa_submission_uploads_v1';

/** Contenu base64 d'une URL `data:` (sans l'en-tête). */
export function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  return i >= 0 ? dataUrl.slice(i + 1) : '';
}

/** Taille réelle (octets) d'un contenu base64. */
export function base64Size(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

async function callable<Req, Res>(name: string) {
  const functions = await getPhase4Functions();
  const { httpsCallable } = await import('firebase/functions');
  return httpsCallable<Req, Res>(functions, name, { timeout: 120000 });
}

function readUploaded(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(UPLOADED_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function markUploaded(trackingNumber: string, evidenceId: string) {
  const map = readUploaded();
  const key = trackingNumber.trim().toUpperCase();
  map[key] = Array.from(new Set([...(map[key] ?? []), evidenceId]));
  try {
    localStorage.setItem(UPLOADED_KEY, JSON.stringify(map));
  } catch {
    /* sans mémoire, un nouvel essai est simplement reconnu comme doublon par le serveur */
  }
}

/** Fichiers du formulaire pas encore transmis (pur, testable). */
export function pendingSubmissionFiles(alert: Pick<AlertRecord, 'trackingNumber' | 'evidences'> | undefined, uploaded = readUploaded()): EvidenceFile[] {
  if (!alert) return [];
  const done = new Set(uploaded[alert.trackingNumber.trim().toUpperCase()] ?? []);
  return (alert.evidences ?? []).filter((e) => e.dataUrl && !e.cloudCaseId && !done.has(e.id));
}

/**
 * Transmet les fichiers joints au formulaire (déclarant). Renvoie le nombre
 * de fichiers transmis. Ne lève jamais d'exception.
 */
export async function uploadSubmissionFiles(sessionToken: string, alert: Pick<AlertRecord, 'trackingNumber' | 'evidences'> | undefined): Promise<number> {
  if (!sessionToken || !isPhase4Configured()) return 0;
  const files = pendingSubmissionFiles(alert);
  if (!files.length || !alert) return 0;
  let sent = 0;
  try {
    const fn = await callable<{ sessionToken: string; fileName: string; fileType: string; dataBase64: string }, { ok: true }>(
      'addSubmissionEvidenceAsReporter'
    );
    for (const f of files) {
      const dataBase64 = dataUrlToBase64(f.dataUrl as string);
      if (!dataBase64 || base64Size(dataBase64) > MAX_BYTES) continue;
      try {
        await fn({ sessionToken, fileName: f.name, fileType: f.type || 'application/octet-stream', dataBase64 });
        markUploaded(alert.trackingNumber, f.id);
        sent++;
      } catch {
        /* nouvel essai à la prochaine connexion à l'espace de suivi */
      }
    }
  } catch {
    /* Firebase indisponible */
  }
  return sent;
}

/**
 * Pièce ajoutée par le personnel (ou fichier du rapport d'enquête) : envoyée
 * au serveur sous le même identifiant. `true` si le serveur l'a enregistrée.
 */
export async function uploadStaffEvidence(caseId: string, file: EvidenceFile, description?: string): Promise<boolean> {
  if (!caseId || !file.dataUrl || !isPhase4Configured()) return false;
  const dataBase64 = dataUrlToBase64(file.dataUrl);
  if (!dataBase64 || base64Size(dataBase64) > MAX_BYTES) return false;
  try {
    const fn = await callable<
      { caseId: string; fileName: string; fileType: string; dataBase64: string; description?: string; clientId: string },
      { ok: true; evidenceId: string }
    >('addEvidenceAsStaff');
    await fn({ caseId, fileName: file.name, fileType: file.type || 'application/octet-stream', dataBase64, description, clientId: file.id });
    return true;
  } catch (e) {
    console.warn('[evidenceUpload] pièce non transmise', e);
    return false;
  }
}

/**
 * === AMÉLIORATION AJOUTÉE (pièces jointes du formulaire transmises) ===
 * Transmet les fichiers du formulaire conservés sur l'appareil
 * (pendingUploads.ts) ; chaque fichier transmis (ou déjà présent sur le
 * serveur) est retiré de l'appareil. Renvoie le nombre de fichiers transmis.
 */
export async function uploadPendingSubmissionBlobs(
  sessionToken: string,
  trackingNumber: string,
  /** Fichiers encore en mémoire (si l'appareil n'a pas pu les conserver). */
  inMemory: { id: string; name: string; type: string; blob: Blob }[] = []
): Promise<number> {
  if (!sessionToken || !trackingNumber || !isPhase4Configured()) return 0;
  const { listPendingUploads, deletePendingUpload } = await import('./pendingUploads');
  const stored = await listPendingUploads(trackingNumber);
  const storedIds = new Set(stored.map((p) => p.id));
  const pending = [...stored, ...inMemory.filter((m) => !storedIds.has(m.id))];
  if (!pending.length) return 0;
  const { fileToBase64 } = await import('./reporterCloudAccess');
  let sent = 0;
  try {
    const fn = await callable<{ sessionToken: string; fileName: string; fileType: string; dataBase64: string }, { ok: true }>(
      'addSubmissionEvidenceAsReporter'
    );
    for (const item of pending) {
      if (item.blob.size > MAX_BYTES) {
        await deletePendingUpload(item.id);
        continue;
      }
      try {
        const dataBase64 = await fileToBase64(item.blob);
        await fn({ sessionToken, fileName: item.name, fileType: item.type || 'application/octet-stream', dataBase64 });
        await deletePendingUpload(item.id);
        markUploaded(trackingNumber, item.id);
        sent++;
      } catch (e) {
        if ((e as { code?: string }).code === 'functions/invalid-argument') await deletePendingUpload(item.id);
      }
    }
  } catch {
    /* Firebase indisponible : nouvel essai à la prochaine connexion au suivi */
  }
  return sent;
}
