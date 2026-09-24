/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Dix-septième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/
 * #112/#113 pour les étapes précédentes. Extraction de la modale
 * "Documenter une mesure corrective" hors du composant monolithique, sans
 * aucun changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleAddCorrectiveMeasure` reste possédé par InvestigationDesk.tsx
 * (ferme sur selectedAlert/activeUser/la persistance) : passé en prop tel
 * quel.
 */
import React from 'react';
import { CorrectiveMeasure } from '../../types';
import { currentT } from '../../i18n/currentLang';

interface AddMeasureModalProps {
  measureTitle: string;
  setMeasureTitle: (v: string) => void;
  measureDesc: string;
  setMeasureDesc: (v: string) => void;
  measureResp: string;
  setMeasureResp: (v: string) => void;
  measureDueDate: string;
  setMeasureDueDate: (v: string) => void;
  measureStatus: CorrectiveMeasure['status'];
  setMeasureStatus: (v: CorrectiveMeasure['status']) => void;
  setShowAddMeasureModal: (v: boolean) => void;
  handleAddCorrectiveMeasure: (e: React.FormEvent) => void;
}

export const AddMeasureModal: React.FC<AddMeasureModalProps> = ({
  measureTitle,
  setMeasureTitle,
  measureDesc,
  setMeasureDesc,
  measureResp,
  setMeasureResp,
  measureDueDate,
  setMeasureDueDate,
  measureStatus,
  setMeasureStatus,
  setShowAddMeasureModal,
  handleAddCorrectiveMeasure,
}) => {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            {t.inv_measure_title}
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            {t.inv_measure_required}
          </p>
        </div>

        <form onSubmit={handleAddCorrectiveMeasure} className="space-y-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.inv_measure_name}</label>
            <input
              type="text"
              value={measureTitle}
              onChange={(e) => setMeasureTitle(e.target.value)}
              /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.inv_measure_name_ph}) */
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.inv_measure_desc}</label>
            <textarea
              rows={3}
              value={measureDesc}
              onChange={(e) => setMeasureDesc(e.target.value)}
              placeholder={t.inv_measure_desc_ph}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.inv_measure_owner}</label>
              <input
                type="text"
                value={measureResp}
                onChange={(e) => setMeasureResp(e.target.value)}
                /* === AMÉLIORATION AJOUTÉE : exemple de saisie retiré (était placeholder={t.inv_measure_owner_ph}) */
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.inv_measure_deadline}</label>
              <input
                type="date"
                value={measureDueDate}
                onChange={(e) => setMeasureDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.inv_measure_status}</label>
            <select
              value={measureStatus}
              onChange={(e: any) => setMeasureStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="planned">{t.inv_measure_planned}</option>
              <option value="in_progress">{t.inv_measure_in_progress}</option>
              <option value="implemented">{t.inv_measure_implemented}</option>
              <option value="verified">{t.inv_measure_verified}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddMeasureModal(false)}
              className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
            >
              {t.btn_cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {t.inv_measure_save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
