/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Neuvième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105 pour les étapes précédentes. Extraction
 * du contenu de l'onglet "Entretiens" hors du composant monolithique, sans
 * aucun changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `setShowAddInterviewModal` reste possédé par InvestigationDesk.tsx (la
 * modale "+ Nouvel entretien" n'est pas encore extraite) : passé en prop
 * tel quel.
 */
import React from 'react';
import { Plus, Mic } from 'lucide-react';
import { AlertRecord, Language } from '../../types';

interface InterviewsSectionProps {
  selectedAlert: AlertRecord;
  lang: Language;
  t: Record<string, string>;
  setShowAddInterviewModal: (v: boolean) => void;
}

export const InterviewsSection: React.FC<InterviewsSectionProps> = ({ selectedAlert, lang, t, setShowAddInterviewModal }) => {
  return (
    <div className="p-6 space-y-4 max-h-[560px] overflow-y-auto text-xs">
      <div className="flex justify-between items-center">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          {t.tab_interviews} ({(selectedAlert.interviews ?? []).length})
        </span>
        <button
          onClick={() => setShowAddInterviewModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.btn_add_interview}</span>
        </button>
      </div>

      {(selectedAlert.interviews ?? []).length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
          {t.interviews_empty}
        </div>
      ) : (
        <div className="space-y-2">
          {(selectedAlert.interviews ?? []).map((interview) => (
            <div key={interview.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{interview.intervieweeName}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                    interview.status === 'completed' ? 'bg-emerald-100 text-emerald-800'
                    : interview.status === 'cancelled' ? 'bg-slate-200 text-slate-600'
                    : 'bg-blue-100 text-blue-800'
                  }`}>
                    {interview.status === 'completed' ? t.interview_status_completed
                      : interview.status === 'cancelled' ? t.interview_status_cancelled
                      : t.interview_status_planned}
                  </span>
                </div>
                {interview.summary && <p className="text-slate-600 mt-0.5">{interview.summary}</p>}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1.5">
                  {(interview.scheduledAt || interview.conductedAt) && (
                    <span>
                      {t.interview_scheduled_label} :{' '}
                      <strong className="text-slate-700">
                        {new Date(interview.conductedAt ?? interview.scheduledAt!).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                      </strong>
                    </span>
                  )}
                  <span>{t.interview_conducted_by_label} : <strong className="text-slate-700">{interview.conductedBy}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
