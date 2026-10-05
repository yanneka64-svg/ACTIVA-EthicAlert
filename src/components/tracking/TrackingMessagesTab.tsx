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
import React, { useRef, useState } from 'react';
import { Lock, Send, Paperclip, X, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { AlertRecord } from '../../types';
// === AMÉLIORATION AJOUTÉE (échanges instantanés, documents, anonymat) ===
import { TypingIndicator } from '../ui/TypingIndicator';
import { MessageAttachments } from '../ui/MessageAttachments';
import type { SendFileResult } from '../../services/reporterCloudAccess';

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
  // === AMÉLIORATION AJOUTÉE (échanges instantanés, documents du déclarant) ===
  /** L'équipe est en train d'écrire (conversation en direct). */
  teamTyping?: boolean;
  /** Signal de frappe du déclarant (conversation en direct uniquement). */
  onTyping?: (text: string) => void;
  /** Envoi d'un document depuis le trombone (conversation en direct uniquement). */
  onSendFile?: (file: File, message: string) => Promise<SendFileResult>;
  isLive?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
  teamTyping,
  onTyping,
  onSendFile,
  isLive,
}) => {
  // === AMÉLIORATION AJOUTÉE (documents du déclarant) === trombone → choix
  // du document → aperçu (nom, taille, retirer) → « Envoyer ».
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const onSubmit = (e: React.FormEvent) => {
    if (pendingFile && onSendFile) {
      e.preventDefault();
      setSendingFile(true);
      void onSendFile(pendingFile, replyContent.trim()).then((res) => {
        setSendingFile(false);
        if (res.ok === true) {
          setPendingFile(null);
          setReplyContent('');
        }
      });
      return;
    }
    handleSendMessage(e);
  };
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
          {/* === AMÉLIORATION AJOUTÉE (échanges instantanés) === */}
          {isLive && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-white/70 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              {t.chat_live}
            </span>
          )}
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
              // === AMÉLIORATION AJOUTÉE (anonymat de l'équipe) === jamais de nom
              // ni d'initiales d'un membre du personnel côté déclarant.
              const initials = isMe ? 'L' : '';
              const teamLabel = t.chat_team_label || 'Équipe d’investigation';
              return (
                <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                      isMe ? 'bg-blue-600' : 'bg-[#0B2545]'
                    }`}
                  >
                    {isMe ? initials : <ShieldCheck className="w-3.5 h-3.5" />}
                  </span>
                  <div className={`flex flex-col max-w-md ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                      <span className="font-semibold text-slate-600">{isMe ? t.track_you_label : teamLabel}</span>
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
                      {/* === AMÉLIORATION AJOUTÉE (documents du déclarant) === */}
                      {m.attachments && m.attachments.length > 0 && <MessageAttachments files={m.attachments} t={t} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {/* === AMÉLIORATION AJOUTÉE (échanges instantanés) === */}
          {teamTyping && <TypingIndicator label={t.chat_team_typing} />}
        </div>

        {/* Message form */}
        <form onSubmit={onSubmit} className="pt-3 border-t border-slate-100 shrink-0 space-y-1.5">
          {/* === AMÉLIORATION AJOUTÉE (documents du déclarant) === document choisi, prêt à envoyer. */}
          {pendingFile && (
            <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
              <FileText className="w-4 h-4 text-blue-700 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-800 truncate">{pendingFile.name}</span>
                <span className="block text-[10px] text-slate-500">{formatSize(pendingFile.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                disabled={sendingFile}
                className="p-1 rounded-lg text-slate-500 hover:bg-white disabled:opacity-40"
                aria-label={t.chat_remove_file}
                title={t.chat_remove_file}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            id="input-tracking-file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.heic,.mp3,.m4a,.wav,.mp4,.mov,.zip"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setPendingFile(f);
              e.target.value = '';
            }}
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              id="input-tracking-reply"
              value={replyContent}
              onChange={(e) => {
                setReplyContent(e.target.value);
                // === AMÉLIORATION AJOUTÉE (échanges instantanés) === signal de frappe.
                onTyping?.(e.target.value);
              }}
              placeholder={t.msg_placeholder}
              className="flex-1 px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="button"
              id="btn-tracking-attach"
              // === AMÉLIORATION AJOUTÉE (documents du déclarant) === le trombone
              // ouvre directement le choix du document (conversation en direct) ;
              // sinon, onglet « Pièces jointes » comme avant.
              onClick={() => (onSendFile ? fileInputRef.current?.click() : setActiveTrackTab('documents'))}
              disabled={sendingFile}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition shrink-0 disabled:opacity-40"
              title={onSendFile ? t.chat_attach : t.track_message_input_helper}
              aria-label={onSendFile ? t.chat_attach : t.track_message_input_helper}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="submit"
              id="btn-tracking-send"
              disabled={sendingFile || (!replyContent.trim() && !pendingFile)}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition"
              title={t.btn_send_msg}
            >
              {sendingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {sendError && <p className="text-[11px] font-semibold text-rose-700">{sendError}</p>}
          {!onSendFile && <p className="text-[10px] text-slate-400">{t.track_message_input_helper}</p>}
        </form>
      </div>
    </div>
  );
};
