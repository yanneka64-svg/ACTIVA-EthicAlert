/**
 * === AMÉLIORATION AJOUTÉE (échanges instantanés côté équipe) ===
 *
 * Conversation d'un dossier Firebase pour l'équipe : rafraîchie toutes les
 * quelques secondes tant qu'elle est ouverte (réponses du déclarant,
 * « le déclarant est en train d'écrire »), signal « l'équipe écrit » (montré
 * au déclarant SANS nom), et téléchargement des documents du déclarant
 * (accès audité côté serveur). Ne lève jamais.
 */
import type { Communication } from '../domain/caseTypes';
import { getPhase4Functions, isPhase4Configured } from './firebaseClient';

async function callable<I, O>(name: string) {
  const { httpsCallable } = await import('firebase/functions');
  return httpsCallable<I, O>(await getPhase4Functions(), name);
}

export interface StaffConversationState {
  communications: Communication[];
  reporterTypingAt: string | null;
}

export async function pollStaffConversation(caseId: string, typing?: boolean): Promise<StaffConversationState | null> {
  if (!isPhase4Configured() || !caseId) return null;
  try {
    const fn = await callable<{ caseId: string; typing?: boolean }, StaffConversationState>('staffConversation');
    const res = await fn(typing === undefined ? { caseId } : { caseId, typing });
    return res.data;
  } catch {
    return null;
  }
}

/** Télécharge un document du déclarant (fichier enregistré sur l'appareil). */
export async function downloadCaseFile(caseId: string, evidenceId: string): Promise<boolean> {
  if (!isPhase4Configured()) return false;
  try {
    const fn = await callable<{ caseId: string; evidenceId: string }, { fileName: string; fileType: string; dataBase64: string }>('getEvidenceFileForStaff');
    const { data } = await fn({ caseId, evidenceId });
    const bin = atob(data.dataBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: data.fileType || 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Messages du déclarant au format du portail (pièces jointes téléchargeables).
// ---------------------------------------------------------------------------
import type { CaseMessage } from '../types';

export function reporterMessagesFromCommunications(comms: Communication[], caseId: string): CaseMessage[] {
  return comms
    .filter((c) => c.sender === 'reporter')
    .map((c) => ({
      id: c.messageId,
      sender: 'whistleblower' as const,
      senderDisplayName: c.senderDisplayName,
      content: c.content,
      createdAt: c.createdAt,
      ...(c.attachmentFiles?.length
        ? {
            attachments: c.attachmentFiles.map((a) => ({
              id: a.evidenceId,
              name: a.fileName,
              size: a.fileSize,
              type: a.fileType,
              uploadedAt: c.createdAt,
              cloudCaseId: caseId,
            })),
          }
        : {}),
    }));
}
