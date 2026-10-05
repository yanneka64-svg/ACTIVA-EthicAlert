/**
 * === AMÉLIORATION AJOUTÉE (échanges instantanés côté équipe) ===
 *
 * Tant qu'une conversation de dossier est ouverte dans le portail (fiche
 * dossier, panneau de la Boîte de réception) : rafraîchissement toutes les
 * 3 s depuis le serveur (réponses et documents du déclarant ajoutés à la
 * conversation), indicateur « le déclarant est en train d'écrire », et
 * signal « l'équipe écrit » envoyé au fil de la frappe (montré au déclarant
 * sans aucun nom). Sans effet pour un dossier non relié à Firebase.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlertRecord } from '../types';
import { isTypingNow } from '../domain/conversation';
import { storage } from '../services/storage';

const POLL_MS = 3000;
const TYPING_SIGNAL_MS = 2500;

export function useLiveConversation(alert: AlertRecord | null | undefined) {
  const caseId = alert?.mirroredCaseId;
  const alertId = alert?.id;
  const [otherTyping, setOtherTyping] = useState(false);
  const lastTypingSent = useRef(0);
  const typingActive = useRef(false);

  useEffect(() => {
    setOtherTyping(false);
    if (!caseId || !alertId) return;
    let stopped = false;
    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const { pollStaffConversation, reporterMessagesFromCommunications } = await import('../services/staffConversation');
      const state = await pollStaffConversation(caseId);
      if (stopped || !state) return;
      setOtherTyping(isTypingNow(state.reporterTypingAt));
      storage.mergeReporterMessagesFromCloud(alertId, reporterMessagesFromCommunications(state.communications, caseId));
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [caseId, alertId]);

  /** À appeler à chaque frappe dans la zone de message. */
  const notifyTyping = useCallback(
    (text: string) => {
      if (!caseId) return;
      const now = Date.now();
      const typing = text.trim().length > 0;
      if (typing && now - lastTypingSent.current < TYPING_SIGNAL_MS) return;
      if (!typing && !typingActive.current) return;
      lastTypingSent.current = typing ? now : 0;
      typingActive.current = typing;
      void import('../services/staffConversation').then(({ pollStaffConversation }) => pollStaffConversation(caseId, typing));
    },
    [caseId]
  );

  return { otherTyping, notifyTyping, live: Boolean(caseId) };
}
