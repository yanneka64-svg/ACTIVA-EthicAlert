/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Onzième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108 pour les étapes
 * précédentes. Extraction du contenu de l'onglet "Vue d'ensemble" hors du
 * composant monolithique, sans aucun changement de comportement. Code
 * strictement déplacé, pas réécrit.
 *
 * Réutilise `PersonRow` (déjà extrait, voir PersonRow.tsx), comme
 * PersonsSection.tsx.
 *
 * `editingDescription`/`descriptionDraft`/`handleSaveDescription`/
 * `setReportDraft`/`setReportFile`/`setShowReportModal`/`setAddPersonKind`/
 * `setLinkingPerson`/`setLinkingUserId`/`evidenceFileInputRef` restent
 * possédés par InvestigationDesk.tsx (les modales associées — édition de
 * description en ligne exceptée, qui reste ici — rapport, ajout de
 * personne, liaison de compte — et l'`<input type="file">` caché ne sont
 * pas encore extraits) : passés en props tels quels.
 */
import React from 'react';
import { FileText, SlidersHorizontal, ArrowUpCircle, ClipboardList, Plus, Paperclip } from 'lucide-react';
import { AlertRecord, Language, UserProfile, EvidenceFile } from '../../types';
import { storage } from '../../services/storage';
import { PersonRow } from './PersonRow';

interface OverviewSectionProps {
  selectedAlert: AlertRecord;
  lang: Language;
  t: Record<string, string>;
  allUsers: UserProfile[];
  editingDescription: boolean;
  setEditingDescription: (v: boolean) => void;
  descriptionDraft: string;
  setDescriptionDraft: (v: string) => void;
  handleSaveDescription: () => void;
  setReportDraft: (v: string) => void;
  setReportFile: (v: EvidenceFile | undefined) => void;
  setShowReportModal: (v: boolean) => void;
  setAddPersonKind: (kind: 'subject' | 'witness') => void;
  setLinkingPerson: (v: { kind: 'subject' | 'witness'; id: string; currentName: string }) => void;
  setLinkingUserId: (v: string) => void;
  evidenceFileInputRef: React.RefObject<HTMLInputElement>;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  selectedAlert,
  lang,
  t,
  allUsers,
  editingDescription,
  setEditingDescription,
  descriptionDraft,
  setDescriptionDraft,
  handleSaveDescription,
  setReportDraft,
  setReportFile,
  setShowReportModal,
  setAddPersonKind,
  setLinkingPerson,
  setLinkingUserId,
  evidenceFileInputRef,
}) => {
  return (
    <div className="p-6 space-y-5 max-h-[640px] overflow-y-auto text-xs">
      {/* Description of facts */}
      <div className="p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            {t.inv_facts}
          </h4>
          {!editingDescription && (
            <button
              onClick={() => { setDescriptionDraft(selectedAlert.detailedDescription); setEditingDescription(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t.case_btn_edit}
            </button>
          )}
        </div>
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              rows={4}
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingDescription(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">{t.btn_cancel}</button>
              <button onClick={handleSaveDescription} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">{t.users_save}</button>
            </div>
          </div>
        ) : (
          <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">{selectedAlert.detailedDescription}</p>
        )}
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Visibilité de l'escalade —
          impasse UX corrigée) === BUG PRÉEXISTANT CORRIGÉ :
          escalatedAt/By/Reason/OwnerId/RecipientId étaient déjà
          calculés et stockés par storage.escalateAlert, mais
          jamais affichés nulle part dans l'interface — seule la
          Chronologie (onglet dédié, peu visible) exposait
          l'entrée d'audit CASE_ESCALATED. Cette carte donne au
          dossier ET au nouveau destinataire un contexte visible
          et permanent (trace historique, contrairement au badge
          ci-dessus qui disparaît une fois le dossier avancé) :
          qui a escaladé, vers qui, quand, pourquoi, et si un
          accès réel a été accordé (jamais un accès fictif —
          correctif confidentialité déjà appliqué côté storage.ts). */}
      {selectedAlert.escalatedRecipientId && (() => {
        const recipient = storage.getEscalationRecipients().find((r) => r.id === selectedAlert.escalatedRecipientId);
        const actor = allUsers.find((u) => u.id === selectedAlert.escalatedBy);
        if (!recipient) return null;
        return (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-1.5">
              <ArrowUpCircle className="w-4 h-4 text-rose-600" />
              {t.case_escalated_card_title}
            </h4>
            <p className="text-slate-700">
              {t.case_escalated_card_meta
                .replace('{date}', selectedAlert.escalatedAt ? new Date(selectedAlert.escalatedAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR') : '')
                .replace('{recipient}', recipient.nom)
                .replace('{fonction}', recipient.fonction)
                .replace('{actor}', actor?.name ?? '—')}
            </p>
            {selectedAlert.escalatedReason && (
              <p className="text-slate-600 mt-1">
                <span className="font-semibold">{t.case_escalated_card_reason_label}</span> {selectedAlert.escalatedReason}
              </p>
            )}
            <p className={`mt-1.5 text-[11px] font-semibold ${selectedAlert.escalatedOwnerId ? 'text-emerald-700' : 'text-slate-500'}`}>
              {selectedAlert.escalatedOwnerId ? t.case_escalated_card_access_granted : t.case_escalated_card_access_email_only}
            </p>
          </div>
        );
      })()}

      {/* === AMÉLIORATION AJOUTÉE (Rapport d'investigation
          obligatoire avant l'envoi en revue) === Même gabarit que
          la carte Description ci-dessus (lecture + bouton
          "Rédiger" qui ouvre la modale partagée), pour que le
          rapport reste visible/consultable une fois rédigé —
          jamais une action "invisible" une fois faite. Texte et
          fichier importé sont affichés côte à côte quand les deux
          sont présents. */}
      <div className="p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-600" />
            {t.report_card_title}
          </h4>
          {!['closed', 'archived'].includes(selectedAlert.status) && (
            <button
              onClick={() => {
                setReportDraft(selectedAlert.investigationReport ?? '');
                setReportFile(selectedAlert.investigationReportFile);
                setShowReportModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t.btn_write_report}
            </button>
          )}
        </div>
        {selectedAlert.investigationReport || selectedAlert.investigationReportFile ? (
          <>
            {selectedAlert.investigationReport && (
              <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">{selectedAlert.investigationReport}</p>
            )}
            {selectedAlert.investigationReportFile && (
              <div className={`flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 ${selectedAlert.investigationReport ? 'mt-3' : ''}`}>
                <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800 block truncate">{selectedAlert.investigationReportFile.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{Math.round(selectedAlert.investigationReportFile.size / 1024)} Ko</span>
              </div>
            )}
            {selectedAlert.investigationReportAt && (
              <p className="text-slate-400 text-[10px] mt-2">
                {t.report_card_meta
                  .replace('{author}', selectedAlert.investigationReportBy ?? '')
                  .replace('{date}', new Date(selectedAlert.investigationReportAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR'))}
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-400 italic">{t.report_card_empty}</p>
        )}
      </div>

      {/* Implicated & Witnesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['subject', 'witness'] as const).map((kind) => {
          const list = kind === 'subject' ? selectedAlert.involvedPersons : selectedAlert.witnesses;
          return (
            <div key={kind} className="p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-bold text-slate-900">
                  {(kind === 'subject' ? t.inv_persons_involved_n : t.inv_witnesses_n).replace('{n}', String(list.length))}
                </h5>
                <button
                  onClick={() => setAddPersonKind(kind)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.case_btn_add}
                </button>
              </div>
              {list.length === 0 ? (
                <p className="text-slate-400 italic">{t.inv_not_specified}</p>
              ) : (
                <div className="space-y-1.5">
                  {list.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      users={allUsers}
                      dense
                      onLinkClick={() => { setLinkingPerson({ kind, id: p.id, currentName: p.name }); setLinkingUserId(p.linkedUserId ?? ''); }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Evidences list */}
      <div className="p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h5 className="font-bold text-slate-900 flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-blue-600" />
            {t.inv_evidence_n.replace('{n}', String(selectedAlert.evidences.length))}
          </h5>
          <button
            onClick={() => evidenceFileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.case_btn_add}
          </button>
        </div>
        {selectedAlert.evidences.length === 0 ? (
          <p className="text-slate-400 italic">{t.inv_no_documents}</p>
        ) : (
          <div className="space-y-1.5">
            {selectedAlert.evidences.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800 block truncate">{ev.name}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(ev.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{Math.round(ev.size / 1024)} Ko</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
