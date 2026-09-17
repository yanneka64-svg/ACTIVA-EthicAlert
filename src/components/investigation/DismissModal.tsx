/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Seizième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112
 * pour les étapes précédentes. Extraction de la modale "Classement sans
 * suite" (Doublon / Hors périmètre) hors du composant monolithique, sans
 * aucun changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleDismissCase` reste possédé par InvestigationDesk.tsx (ferme sur
 * selectedAlert/activeUser/la persistance) : passé en prop tel quel.
 */
import React from 'react';
import { AlertRecord } from '../../types';

interface DismissModalProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  dismissTargetStatus: 'duplicate' | 'out_of_scope';
  setDismissTargetStatus: (v: 'duplicate' | 'out_of_scope') => void;
  dismissReason: string;
  setDismissReason: (v: string) => void;
  setShowDismissModal: (v: boolean) => void;
  handleDismissCase: () => void;
}

export const DismissModal: React.FC<DismissModalProps> = ({
  t,
  selectedAlert,
  dismissTargetStatus,
  setDismissTargetStatus,
  dismissReason,
  setDismissReason,
  setShowDismissModal,
  handleDismissCase,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">{t.btn_dismiss_case}</h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            {t.dismiss_modal_subtitle.replace('{tracking}', selectedAlert.trackingNumber)}
          </p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.dismiss_reason_type_label} *</label>
          <select
            value={dismissTargetStatus}
            onChange={(e) => setDismissTargetStatus(e.target.value as 'duplicate' | 'out_of_scope')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="duplicate">{t.dismiss_reason_duplicate}</option>
            <option value="out_of_scope">{t.dismiss_reason_out_of_scope}</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.dismiss_motive_label} *</label>
          <textarea
            rows={3}
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            placeholder={t.dismiss_motive_placeholder}
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowDismissModal(false)}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleDismissCase}
            disabled={!dismissReason.trim()}
            className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
          >
            {t.btn_dismiss_case_confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
