/**
 * === AMÉLIORATION AJOUTÉE (échanges instantanés, anonymat de l'équipe,
 * documents du déclarant) ===
 *
 * Règles pures (sans Firebase) partagées par les Cloud Functions et le
 * navigateur, testées dans conversation.test.ts :
 * - ce que le déclarant voit d'un message : JAMAIS le nom ni l'identifiant
 *   d'un membre du personnel (libellé neutre « Équipe d'investigation ») ;
 * - l'indicateur « est en train d'écrire » (valable quelques secondes) ;
 * - les limites des documents envoyés par le déclarant.
 */
import type { Communication } from './caseTypes';

/** Libellé affiché au déclarant pour tout message de l'équipe. */
export const TEAM_DISPLAY_NAME = 'Équipe d’investigation';

/** Pièce jointe décrite dans un message (le contenu est stocké à part). */
export interface MessageAttachment {
  evidenceId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/** Message tel que le déclarant le reçoit : aucun identifiant interne. */
export interface ReporterSafeMessage {
  messageId: string;
  sender: 'reporter' | 'investigator' | 'system';
  senderDisplayName: string;
  content: string;
  createdAt: string;
  attachmentFiles?: MessageAttachment[];
}

/**
 * Vue « déclarant » d'une conversation : nom neutre pour l'équipe, et
 * suppression de tout identifiant interne (createdBy, updatedBy, nom réel
 * de l'auteur), y compris pour les messages envoyés avant cette règle.
 */
export function sanitizeCommunicationsForReporter(comms: (Communication & { attachmentFiles?: MessageAttachment[] })[]): ReporterSafeMessage[] {
  return [...comms]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((c) => ({
      messageId: c.messageId,
      sender: c.sender,
      senderDisplayName: c.sender === 'reporter' ? 'Lanceur d’alerte' : TEAM_DISPLAY_NAME,
      content: c.content,
      createdAt: c.createdAt,
      ...(c.attachmentFiles?.length ? { attachmentFiles: c.attachmentFiles.map(({ evidenceId, fileName, fileType, fileSize }) => ({ evidenceId, fileName, fileType, fileSize })) } : {}),
    }));
}

/** Durée pendant laquelle « … est en train d'écrire » reste affiché après le dernier signal. */
export const TYPING_TTL_MS = 6000;

/** L'autre partie est-elle en train d'écrire ? */
export function isTypingNow(typingAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!typingAt) return false;
  const t = Date.parse(typingAt);
  return !Number.isNaN(t) && now - t >= -2000 && now - t < TYPING_TTL_MS;
}

/** Taille maximale d'un document envoyé par le déclarant (7 Mo). */
export const REPORTER_FILE_MAX_BYTES = 7 * 1024 * 1024;
/** Nombre maximal de documents envoyés par le déclarant sur un dossier. */
export const REPORTER_FILE_MAX_PER_CASE = 30;

/** Nom de fichier sûr (aucun chemin, longueur bornée). */
export function safeFileName(name: string): string {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]+/g, '_').trim().slice(0, 150);
  return cleaned || 'document';
}
