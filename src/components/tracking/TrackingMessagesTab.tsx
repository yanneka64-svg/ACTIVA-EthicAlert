/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
 * section) ===
 *
 * Onglet « Messages » (messagerie sécurisée).
 *
 * Code strictement déplacé depuis AlertTrackingView.tsx, pas réécrit —
 * aucun changement de comportement. L'état, la connexion (hash salé +
 * verrou anti-brute-force) et tous les handlers restent possédés par
 * AlertTrackingView.tsx et sont passés en props tels quels.
 */
import React from 'react';
import { Lock, Send, Paperclip } from 'lucide-react';
import { AlertRecord } from '../../types';

interface TrackingMessagesTabProps {
  t: Record<string, string>;
  activeAlert: AlertRecord;
  replyContent: string;
  setReplyContent: React.Dispatch<React.SetStateAction<string>>;
  setActiveTrackTab: React.Dispatch<React.SetStateAction<'overview' | 'messages' | 'documents' | 'updates'>>;
  handleSendMessage: (e: React.FormEvent) => void;
  formatDateTime: (iso: string) => string;
  // === AMÉLIORATION AJOUTÉE (suivi depuis n'importe quel appareil) ===
  // message affiché si l'envoi vers l'équipe a échoué.
  sendError?: string;
}

export const TrackingMessagesTab: React.FC<TrackingMessagesTabProps> = ({
  t,
  activeAlert,
  replyContent,
  setReplyContent,
  setActiveTrackTab,
  handleSendMessage,
  formatDateTime,
  sendError,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">{t.track_tab_messages}</h3>

      <div className="flex flex-col h-[440px]">
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 shrink-0">
          <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <div className="text-xs font-bold text-emerald-900">{t.msg_box_title}</div>
            <div className="text-[11px] text-emerald-700">{t.msg_box_subtitle}</div>
          </div>
        </div>

        {/* Messages scroll box */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
          {activeAlert.messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              {t.track_no_messages}
            </div>
          ) : (
            activeAlert.messages.map((m) => {
              const isMe = m.sender === 'whistleblower';
              const initials = isMe ? 'L' : m.senderDisplayName.slice(0, 2).toUpperCase();
              return (
                <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                      isMe ? 'bg-blue-600' : 'bg-[#0B2545]'
                    }`}
                  >
                    {initials}
                  </span>
                  <div className={`flex flex-col max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                      <span className="font-semibold text-slate-600">{isMe ? t.track_you_label : m.senderDisplayName}</span>
                      <span>•</span>
                      <span>{formatDateTime(m.createdAt)}</span>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed border ${
                        isMe
                          ? 'bg-blue-50 border-blue-100 text-slate-800 rounded-br-none'
                          : 'bg-slate-50 border-slate-100 text-slate-800 rounded-bl-none'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Message form */}
        <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-100 shrink-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              id="input-tracking-reply"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder={t.msg_placeholder}
              className="flex-1 px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setActiveTrackTab('documents')}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition shrink-0"
              title={t.track_message_input_helper}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="submit"
              id="btn-tracking-send"
              disabled={!replyContent.trim()}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition"
              title={t.btn_send_msg}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {sendError && <p className="text-[11px] font-semibold text-rose-700">{sendError}</p>}
          <p className="text-[10px] text-slate-400">{t.track_message_input_helper}</p>
        </form>
      </div>
    </div>
  );
};
