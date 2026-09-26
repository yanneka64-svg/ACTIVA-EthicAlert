/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingt-deuxième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/
 * #113/#114/#115/#116 pour les étapes précédentes. Extraction de la modale
 * "Déclarer un conflit d'intérêt" (Phase 6) hors du composant monolithique,
 * sans aucun changement de comportement. Code strictement déplacé, pas
 * réécrit.
 *
 * `handleDeclareConflict` reste possédé par InvestigationDesk.tsx (ferme
 * sur selectedAlert/activeUser/la persistance) : passé en prop tel quel.
 */
import React from 'react';
import { AlertRecord, ConflictDeclaration, UserProfile } from '../../types';

interface ConflictModalProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  activeUser: UserProfile;
  conflictOutcome: ConflictDeclaration['outcome'];
  setConflictOutcome: (v: ConflictDeclaration['outcome']) => void;
  conflictDetails: string;
  setConflictDetails: (v: string) => void;
  setShowConflictModal: (v: boolean) => void;
  handleDeclareConflict: (e: React.FormEvent) => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  t,
  selectedAlert,
  activeUser,
  conflictOutcome,
  setConflictOutcome,
  conflictDetails,
  setConflictDetails,
  setShowConflictModal,
  handleDeclareConflict,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">{t.conflict_modal_title}</h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            {t.conflict_modal_subtitle} <span className="font-semibold text-slate-700">{activeUser.name}</span> — {selectedAlert.trackingNumber}
          </p>
        </div>

        <form onSubmit={handleDeclareConflict} className="space-y-3">
          <div className="space-y-2">
            <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${conflictOutcome === 'no_conflict' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="conflict-outcome" checked={conflictOutcome === 'no_conflict'} onChange={() => setConflictOutcome('no_conflict')} className="mt-0.5 accent-emerald-600" />
              <span>
                <span className="font-semibold text-slate-800 block">{t.conflict_outcome_none}</span>
                <span className="text-slate-500 text-[11px]">{t.conflict_outcome_none_desc}</span>
              </span>
            </label>
            <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${conflictOutcome === 'conflict_identified' ? 'border-rose-400 bg-rose-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="conflict-outcome" checked={conflictOutcome === 'conflict_identified'} onChange={() => setConflictOutcome('conflict_identified')} className="mt-0.5 accent-rose-600" />
              <span>
                <span className="font-semibold text-slate-800 block">{t.conflict_outcome_identified}</span>
                <span className="text-slate-500 text-[11px]">{t.conflict_outcome_identified_desc}</span>
              </span>
            </label>
          </div>

          {conflictOutcome === 'conflict_identified' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.conflict_details_label} *</label>
              <textarea
                rows={3}
                value={conflictDetails}
                onChange={(e) => setConflictDetails(e.target.value)}
                /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.conflict_details_placeholder}) */
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setShowConflictModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
              {t.btn_cancel}
            </button>
            <button
              type="submit"
              disabled={conflictOutcome === 'conflict_identified' && !conflictDetails.trim()}
              className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white font-bold"
            >
              {t.conflict_btn_submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
