/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Communications" (mockup: groupe INVESTIGATION).
 * Agrège `AlertRecord.messages` de tous les dossiers visibles par
 * l'utilisateur — les mêmes messages réels échangés avec les lanceurs
 * d'alerte via `AlertTrackingView`/`InvestigationDesk`, jamais une donnée
 * séparée. Renvoie vers le dossier concerné en un clic.
 *
 * === AMÉLIORATION AJOUTÉE (Repère visuel — Communications) ===
 * Reconstruction complète en vue "messagerie" façon maquette : liste des
 * fils de discussion (un par dossier) à gauche, thread complet à droite
 * avec bulles par expéditeur, plus un vrai composeur de réponse. Ce
 * dernier est réellement câblé (contrairement au bouton "+ Nouveau" écarté
 * sur les écrans Tâches/Preuves) car ici le dossier destinataire est déjà
 * déterminé par le fil sélectionné — aucun sélecteur manquant. Réutilise
 * exactement le même mécanisme d'envoi que l'onglet "Communications"
 * interne à un dossier (InvestigationDesk.tsx `handleSendInvestigatorMessage`) :
 * `storage.saveAlert()` + entrée d'audit `MESSAGE_SENT`, même convention
 * d'expéditeur (`sender: 'investigator'`, libellé `DARC (nom)`).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send, ExternalLink } from 'lucide-react';
import { Language, AlertRecord, UserProfile, CaseMessage } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { EmptyState } from './ui';

interface CommunicationsRegistryProps {
  lang: Language;
  activeUser: UserProfile;
  onOpenCase: (trackingNumber: string) => void;
}

const SENDER_LABEL: Record<CaseMessage['sender'], string> = {
  whistleblower: 'Lanceur d’alerte',
  investigator: 'Investigateur',
  admin: 'Administrateur',
};

interface Thread {
  alert: AlertRecord;
  messages: CaseMessage[];
}

export const CommunicationsRegistry: React.FC<CommunicationsRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  // Remplace le filtre dupliqué (rôle assigné) par le hook partagé, qui
  // applique en plus le périmètre pays/entité et la confidentialité — voir
  // src/hooks/useVisibleAlerts.ts.
  const visibleAlerts = useVisibleAlerts(alerts, activeUser);

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Communications) ===
  // Un fil de discussion par dossier ayant au moins un message, trié par
  // message le plus récent d'abord.
  const threads: Thread[] = useMemo(() => {
    return visibleAlerts
      .filter((a) => (a.messages ?? []).length > 0)
      .map((a) => ({ alert: a, messages: [...a.messages].sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()) }))
      .sort((a, b) => {
        const lastA = a.messages[a.messages.length - 1];
        const lastB = b.messages[b.messages.length - 1];
        return new Date(lastB.createdAt).getTime() - new Date(lastA.createdAt).getTime();
      });
  }, [visibleAlerts]);

  const selectedThread = threads.find((th) => th.alert.id === selectedAlertId) ?? threads[0] ?? null;

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread) return;

    // === AMÉLIORATION AJOUTÉE (Repère visuel — Communications) === même
    // mécanisme que InvestigationDesk.tsx `handleSendInvestigatorMessage` —
    // voir le commentaire d'en-tête de ce fichier.
    const newMsg: CaseMessage = {
      id: 'msg-' + Date.now(),
      sender: 'investigator',
      senderDisplayName: `DARC (${activeUser.name})`,
      content: replyText.trim(),
      createdAt: new Date().toISOString(),
    };
    const updatedAlert: AlertRecord = {
      ...selectedThread.alert,
      messages: [...selectedThread.alert.messages, newMsg],
      updatedAt: new Date().toISOString(),
    };
    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'MESSAGE_SENT',
      `Message sécurisé transmis au lanceur d'alerte pour le dossier ${selectedThread.alert.trackingNumber}.`,
      { id: selectedThread.alert.id, trackingNumber: selectedThread.alert.trackingNumber },
      activeUser
    );
    setReplyText('');
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-700" />
          {t.reg_comms_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_comms_subtitle}</p>
      </div>

      {threads.length === 0 ? (
        <EmptyState title={t.reg_comms_empty} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row" style={{ minHeight: 480 }}>
          {/* Liste des fils */}
          <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-72 md:max-h-[560px]">
            {threads.map((th) => {
              const last = th.messages[th.messages.length - 1];
              const active = selectedThread?.alert.id === th.alert.id;
              return (
                <button
                  key={th.alert.id}
                  onClick={() => setSelectedAlertId(th.alert.id)}
                  className={`w-full text-left px-3.5 py-3 border-b border-slate-100 transition ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#0B2545]">{th.alert.trackingNumber}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{new Date(last.createdAt).toLocaleDateString(lang)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{th.alert.category}</p>
                  <p className="text-[11px] text-slate-700 line-clamp-1 mt-1">
                    <span className="font-semibold">{SENDER_LABEL[last.sender]} : </span>
                    {last.content}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full px-1.5 py-0.5">
                    {th.messages.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Thread sélectionné */}
          {selectedThread && (
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-bold text-[#0B2545] block">{selectedThread.alert.trackingNumber}</span>
                  <span className="text-[11px] text-slate-500 truncate block">{selectedThread.alert.category}</span>
                </div>
                <button
                  onClick={() => onOpenCase(selectedThread.alert.trackingNumber)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> {t.reg_comms_open_case}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 380 }}>
                {selectedThread.messages.map((m) => {
                  const isStaff = m.sender === 'investigator' || m.sender === 'admin';
                  return (
                    <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs ${isStaff ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                        <div className={`text-[10px] font-bold mb-0.5 ${isStaff ? 'text-blue-100' : 'text-slate-500'}`}>
                          {m.senderDisplayName || SENDER_LABEL[m.sender]}
                        </div>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <div className={`text-[9px] mt-1 ${isStaff ? 'text-blue-100/80' : 'text-slate-400'}`}>
                          {new Date(m.createdAt).toLocaleString(lang)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSendReply} className="p-3 border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t.reg_comms_reply_placeholder}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
