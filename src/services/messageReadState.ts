/**
 * === AMÉLIORATION AJOUTÉE (nouveaux messages visibles rapidement) ===
 *
 * Messages du déclarant « non lus » pour un membre du personnel, sur cet
 * appareil : un message du déclarant est non lu s'il est postérieur à la
 * dernière lecture de la conversation par ce compte — à défaut de lecture
 * enregistrée, postérieur à la dernière réponse de l'équipe (une
 * conversation à laquelle l'équipe a déjà répondu n'est pas « nouvelle »).
 * Lecture enregistrée dès que la conversation est affichée.
 */
import type { AlertRecord } from '../types';

const PREFIX = 'activa_msg_read_v1_';
export const READ_STATE_EVENT = 'activa-message-read';

type ReadMap = Record<string, string>;

function key(userId: string) {
  return PREFIX + userId;
}

export function readMap(userId: string): ReadMap {
  try {
    const raw = localStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Nombre de messages du déclarant non lus sur ce dossier (pur, testable). */
export function unreadCount(alert: Pick<AlertRecord, 'messages'>, lastReadAt: string | undefined): number {
  const msgs = alert.messages ?? [];
  let since = lastReadAt;
  if (!since) {
    const lastTeam = [...msgs].reverse().find((m) => m.sender !== 'whistleblower');
    since = lastTeam?.createdAt;
  }
  const t = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
  // Le message automatique du dépôt (`msg-init`) n'est pas un échange.
  return msgs.filter((m) => m.sender === 'whistleblower' && m.id !== 'msg-init' && Date.parse(m.createdAt) > t).length;
}

/** Enregistre la lecture de la conversation (jusqu'au dernier message affiché). */
export function markConversationRead(userId: string, alert: Pick<AlertRecord, 'id' | 'messages'>): void {
  if (!userId || !alert?.id) return;
  const last = alert.messages?.[alert.messages.length - 1]?.createdAt;
  const at = last && Date.parse(last) > Date.now() ? last : new Date().toISOString();
  const map = readMap(userId);
  if (map[alert.id] && Date.parse(map[alert.id]) >= Date.parse(at)) return;
  map[alert.id] = at;
  try {
    localStorage.setItem(key(userId), JSON.stringify(map));
  } catch {
    /* stockage indisponible : simple perte du repère */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(READ_STATE_EVENT));
}
