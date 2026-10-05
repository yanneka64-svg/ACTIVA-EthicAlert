/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Sixième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101 pour les étapes précédentes. Extraction du contenu de
 * l'onglet "Communications" (canal d'échange sécurisé avec le lanceur
 * d'alerte) hors du composant monolithique, sans aucun changement de
 * comportement. Code strictement déplacé, pas réécrit.
 *
 * `investigatorMsgText`/`setInvestigatorMsgText`/
 * `handleSendInvestigatorMessage` restent possédés par
 * InvestigationDesk.tsx (le handler journalise l'envoi via `activeUser`/
 * `selectedAlert` déjà fermés sur ce composant) : passés en props tels
 * quels.
 */
import React from 'react';
import { Send } from 'lucide-react';
import { AlertRecord } from '../../types';
import { currentT } from '../../i18n/currentLang';
// === AMÉLIORATION AJOUTÉE (échanges instantanés, documents du déclarant) ===
import { useLiveConversation } from '../../hooks/useLiveConversation';
import { TypingIndicator } from '../ui/TypingIndicator';
import { MessageAttachments } from '../ui/MessageAttachments';
import { useAutoScrollToBottom } from '../../hooks/useAutoScrollToBottom';

interface MessagesSectionProps {
  selectedAlert: AlertRecord;
  investigatorMsgText: string;
  setInvestigatorMsgText: (v: string) => void;
  handleSendInvestigatorMessage: (e: React.FormEvent) => void;
}

export const MessagesSection: React.FC<MessagesSectionProps> = ({
  selectedAlert,
  investigatorMsgText,
  setInvestigatorMsgText,
  handleSendInvestigatorMessage,
}) => {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  // === AMÉLIORATION AJOUTÉE (échanges instantanés) === rafraîchissement 3 s,
  // « le déclarant est en train d'écrire », signal de frappe (anonyme).
  const { otherTyping, notifyTyping, live } = useLiveConversation(selectedAlert);
  const scrollRef = useAutoScrollToBottom<HTMLDivElement>(`${selectedAlert.messages.length}-${otherTyping ? 1 : 0}`);
  return (
    <div className="p-6 flex flex-col h-[560px] text-xs">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-2">
          {t.inv_msg_title}
          {/* === AMÉLIORATION AJOUTÉE (échanges instantanés) === */}
          {live && (
            <span className="inline-flex items-center gap-1 normal-case tracking-normal text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              {t.chat_live}
            </span>
          )}
        </h4>
        <p className="text-slate-500 text-[11px]">
          {t.inv_msg_hint}
        </p>
      </div>

      {/* Messages list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
        {selectedAlert.messages.map((m) => {
          const isWb = m.sender === 'whistleblower';
          return (
            <div key={m.id} className={`flex flex-col ${isWb ? 'items-start' : 'items-end'}`}>
              <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                <span className="font-semibold text-slate-700">{m.senderDisplayName}</span>
                <span>•</span>
                <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`max-w-md p-3.5 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                isWb
                  ? 'bg-amber-50 text-amber-950 border border-amber-200 rounded-tl-none'
                  : 'bg-blue-600 text-white rounded-tr-none'
              }`}>
                {m.content}
                {/* === AMÉLIORATION AJOUTÉE (documents du déclarant) === */}
                {m.attachments && m.attachments.length > 0 && (
                  <MessageAttachments files={m.attachments} t={t} allowCloudDownload tone={isWb ? 'light' : 'dark'} />
                )}
              </div>
            </div>
          );
        })}
        {/* === AMÉLIORATION AJOUTÉE (échanges instantanés) === */}
        {otherTyping && <TypingIndicator label={t.chat_reporter_typing} />}
      </div>

      {/* Message input */}
      <form onSubmit={handleSendInvestigatorMessage} className="pt-3 border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={investigatorMsgText}
          onChange={(e) => {
            setInvestigatorMsgText(e.target.value);
            // === AMÉLIORATION AJOUTÉE (échanges instantanés) === signal de frappe.
            notifyTyping(e.target.value);
          }}
          placeholder={t.inv_msg_ph}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!investigatorMsgText.trim()}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold flex items-center gap-1.5"
        >
          <span>{t.common_send}</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
