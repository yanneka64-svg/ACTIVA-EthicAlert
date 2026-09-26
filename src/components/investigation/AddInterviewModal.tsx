/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Dix-neuvième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/#113/
 * #114/#115/#116 pour les étapes précédentes. Extraction de la modale
 * "+ Nouvel entretien" hors du composant monolithique, sans aucun
 * changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleAddInterview` reste possédé par InvestigationDesk.tsx (ferme sur
 * selectedAlert/activeUser/la persistance) : passé en prop tel quel.
 */
import React from 'react';
import { AlertRecord, CaseInterview } from '../../types';

interface AddInterviewModalProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  interviewLinkedPersonId: string;
  setInterviewLinkedPersonId: (v: string) => void;
  interviewIntervieweeName: string;
  setInterviewIntervieweeName: (v: string) => void;
  interviewScheduledAt: string;
  setInterviewScheduledAt: (v: string) => void;
  interviewStatus: CaseInterview['status'];
  setInterviewStatus: (v: CaseInterview['status']) => void;
  interviewSummary: string;
  setInterviewSummary: (v: string) => void;
  setShowAddInterviewModal: (v: boolean) => void;
  handleAddInterview: (e: React.FormEvent) => void;
}

export const AddInterviewModal: React.FC<AddInterviewModalProps> = ({
  t,
  selectedAlert,
  interviewLinkedPersonId,
  setInterviewLinkedPersonId,
  interviewIntervieweeName,
  setInterviewIntervieweeName,
  interviewScheduledAt,
  setInterviewScheduledAt,
  interviewStatus,
  setInterviewStatus,
  interviewSummary,
  setInterviewSummary,
  setShowAddInterviewModal,
  handleAddInterview,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">{t.btn_add_interview}</h3>
          <p className="text-slate-500 text-[11px] mt-0.5">{selectedAlert.trackingNumber}</p>
        </div>

        <form onSubmit={handleAddInterview} className="space-y-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.interview_link_person_label}</label>
            <select
              value={interviewLinkedPersonId}
              onChange={(e) => { setInterviewLinkedPersonId(e.target.value); if (e.target.value) setInterviewIntervieweeName(''); }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">—</option>
              {[...selectedAlert.involvedPersons, ...selectedAlert.witnesses].map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {!interviewLinkedPersonId && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.interview_interviewee_label} *</label>
              <input
                type="text"
                value={interviewIntervieweeName}
                onChange={(e) => setInterviewIntervieweeName(e.target.value)}
                placeholder={t.interview_interviewee_placeholder}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.interview_scheduled_label}</label>
              <input
                type="date"
                value={interviewScheduledAt}
                onChange={(e) => setInterviewScheduledAt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.interview_status_label}</label>
              <div className="flex gap-1.5">
                {(['planned', 'completed', 'cancelled'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInterviewStatus(s)}
                    className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-bold border transition ${
                      interviewStatus === s ? 'bg-[#0B2545] text-white border-[#0B2545]' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {s === 'planned' ? t.interview_status_planned : s === 'completed' ? t.interview_status_completed : t.interview_status_cancelled}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.interview_summary_label}</label>
            <textarea
              rows={3}
              value={interviewSummary}
              onChange={(e) => setInterviewSummary(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setShowAddInterviewModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
              {t.btn_cancel}
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {t.btn_add_interview}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
