/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Boîte de réception : liste + panneau détail/attribution/réponse côte à côte
 * (modes `inbox` et `inv_inbox`).
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 */
import React from 'react';
import { Inbox, Building2, ArrowLeft, UserPlus, Send } from 'lucide-react';
import { AlertRecord, Language, PriorityLevel, SeverityLevel } from '../../types';
import { storage } from '../../services/storage';
import { formatCountryLabel } from '../../data/activaConfig';
import { effectivePriority } from '../../domain/advancedSearch';
import { Button, PriorityBadge, EmptyState } from '../ui';
import { trData } from '../../i18n/dataLabels';
import { ConfidentialityBadge } from './ConfidentialityBadge';
import { NOCA_TONE } from './constants';
// === AMÉLIORATION AJOUTÉE (échanges instantanés, documents du déclarant) ===
import { useLiveConversation } from '../../hooks/useLiveConversation';
import { TypingIndicator } from '../ui/TypingIndicator';
import { MessageAttachments } from '../ui/MessageAttachments';
import { useAutoScrollToBottom } from '../../hooks/useAutoScrollToBottom';

interface OperatorInboxPanelProps {
  t: Record<string, string>;
  lang: Language;
  dateLocale: string;
  canActOnRows: boolean;
  canAssign: boolean;
  allPageSelected: boolean;
  toggleSelectAll: () => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  filteredAlerts: AlertRecord[];
  displayEmpty: string;
  panelAlertId: string | null;
  setPanelAlertId: (v: string | null) => void;
  panelAlert: AlertRecord | null;
  urgencyLabels: Record<PriorityLevel, string>;
  severityLabels: Record<SeverityLevel, string>;
  channelLabels: Record<AlertRecord['channel'], string>;
  setAssignTargetIds: (v: string[] | null) => void;
  setAssignSelectedInvestigatorIds: React.Dispatch<React.SetStateAction<string[]>>;
  replyText: string;
  setReplyText: (v: string) => void;
  handleQuickReply: () => void;
  onOpenCase: (trackingNumber: string) => void;
}

export const OperatorInboxPanel: React.FC<OperatorInboxPanelProps> = ({
  t,
  lang,
  dateLocale,
  canActOnRows,
  canAssign,
  allPageSelected,
  toggleSelectAll,
  selectedIds,
  toggleSelect,
  filteredAlerts,
  displayEmpty,
  panelAlertId,
  setPanelAlertId,
  panelAlert,
  urgencyLabels,
  severityLabels,
  channelLabels,
  setAssignTargetIds,
  setAssignSelectedInvestigatorIds,
  replyText,
  setReplyText,
  handleQuickReply,
  onOpenCase,
}) => {
  // === AMÉLIORATION AJOUTÉE (échanges instantanés) === conversation du
  // signalement ouvert, rafraîchie toutes les 3 s.
  const { otherTyping, notifyTyping } = useLiveConversation(panelAlert);
  const recentMessages = panelAlert ? panelAlert.messages.slice(-6) : [];
  const scrollRef = useAutoScrollToBottom<HTMLDivElement>(`${panelAlert?.id}-${panelAlert?.messages.length ?? 0}-${otherTyping ? 1 : 0}`);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
            {canActOnRows && <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="rounded text-blue-600" />}
            {t.op_reports_count.replace('{n}', String(filteredAlerts.length))}
          </label>
        </div>
        {filteredAlerts.length === 0 ? (
          <div className="p-4"><EmptyState title={displayEmpty} /></div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {filteredAlerts.map((a) => (
              <button
                key={a.id}
                onClick={() => setPanelAlertId(a.id)}
                className={`w-full text-left p-3.5 flex items-start gap-2.5 hover:bg-slate-50 transition ${panelAlertId === a.id ? 'bg-blue-50' : ''}`}
              >
                {canActOnRows && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(a.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(a.id)}
                    className="mt-1 rounded text-blue-600 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[#0B2545] text-xs">{a.trackingNumber}</span>
                    <PriorityBadge priority={effectivePriority(a)} label={urgencyLabels[effectivePriority(a)]} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{trData(a.category, lang)} — {a.concernedEntity}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{new Date(a.createdAt).toLocaleDateString(dateLocale)} · {channelLabels[a.channel]}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        {!panelAlert ? (
          <EmptyState icon={Inbox} title={t.op_select_prompt} description={t.op_select_prompt_desc} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#0B2545]">{panelAlert.trackingNumber}</span>
                  <ConfidentialityBadge level={panelAlert.confidentialityLevel} lang={lang} />
                </div>
                <p className="text-xs text-slate-600 mt-1">{trData(panelAlert.category, lang)} — {trData(panelAlert.subCategory, lang)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> {panelAlert.concernedEntity} ({formatCountryLabel(storage.getCountries(), panelAlert.country)})</p>
              </div>
              <button onClick={() => setPanelAlertId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className={`px-2 py-0.5 rounded font-bold border ${NOCA_TONE[panelAlert.riskEvaluation.nocaThreshold]}`}>{panelAlert.riskEvaluation.nocaThreshold}</span>
              <PriorityBadge priority={effectivePriority(panelAlert)} label={urgencyLabels[effectivePriority(panelAlert)]} />
              {panelAlert.severity && <span className="px-2 py-0.5 rounded font-bold border bg-slate-100 text-slate-700 border-slate-200">{severityLabels[panelAlert.severity]}</span>}
              <span className="px-2 py-0.5 rounded font-bold border bg-slate-100 text-slate-700 border-slate-200">{channelLabels[panelAlert.channel]}</span>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100 line-clamp-4">{panelAlert.detailedDescription}</p>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-500">
                {panelAlert.assignedInvestigatorNames.length > 0 ? t.op_assigned_to.replace('{names}', panelAlert.assignedInvestigatorNames.join(', ')) : t.op_not_assigned}
              </span>
              {canAssign && (
                <Button
                  size="sm"
                  icon={<UserPlus className="w-3.5 h-3.5" />}
                  onClick={() => { setAssignTargetIds([panelAlert.id]); setAssignSelectedInvestigatorIds(panelAlert.assignedInvestigators); }}
                >
                  {t.op_assign}
                </Button>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              {/* === AMÉLIORATION AJOUTÉE (échanges instantanés) === derniers échanges du dossier. */}
              {(recentMessages.length > 0 || otherTyping) && (
                <div ref={scrollRef} className="mb-3 max-h-64 overflow-y-auto space-y-2 pr-1">
                  {recentMessages.map((m) => {
                    const isWb = m.sender === 'whistleblower';
                    return (
                      <div key={m.id} className={`flex flex-col ${isWb ? 'items-start' : 'items-end'}`}>
                        <span className="text-[10px] text-slate-400 mb-0.5">
                          {m.senderDisplayName} · {new Date(m.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div
                          className={`max-w-[90%] px-3 py-2 rounded-2xl text-xs whitespace-pre-wrap ${
                            isWb ? 'bg-amber-50 border border-amber-200 text-amber-950 rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'
                          }`}
                        >
                          {m.content}
                          {m.attachments && m.attachments.length > 0 && (
                            <MessageAttachments files={m.attachments} t={t} allowCloudDownload tone={isWb ? 'light' : 'dark'} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {otherTyping && <TypingIndicator label={t.chat_reporter_typing} />}
                </div>
              )}
              <label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">{t.op_reply_wb}</label>
              <div className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    // === AMÉLIORATION AJOUTÉE (échanges instantanés) === signal de frappe.
                    notifyTyping(e.target.value);
                  }}
                  rows={2}
                  placeholder={t.op_reply_ph}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
                <button onClick={handleQuickReply} disabled={!replyText.trim()} className="p-2.5 rounded-xl bg-brand text-white disabled:opacity-40 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={() => onOpenCase(panelAlert.trackingNumber)}
              className="w-full text-center py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {t.op_open_full}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
