/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Douzième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109 pour les étapes
 * précédentes. Première extraction d'une modale (jusqu'ici seules 2 des 15
 * modales du fichier original avaient été migrées vers ConfirmDialog, voir
 * #90) : la modale "Modifier la classification et les délais de
 * traitement", ouverte depuis TriageSection.tsx (onglet Allégations, bouton
 * "Ajuster"), extraite hors du composant monolithique sans aucun
 * changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleUpdatePriority` reste possédé par InvestigationDesk.tsx (ferme
 * sur `selectedAlert`/l'historique d'audit/la persistance) : passé en prop
 * tel quel.
 */
import React from 'react';
import { PriorityLevel } from '../../types';
import { currentT } from '../../i18n/currentLang';

interface PriorityModalProps {
  newPriority: PriorityLevel;
  setNewPriority: (v: PriorityLevel) => void;
  newSlaDays: number;
  setNewSlaDays: (v: number) => void;
  priorityOverrideReason: string;
  setPriorityOverrideReason: (v: string) => void;
  setShowPriorityModal: (v: boolean) => void;
  handleUpdatePriority: () => void;
}

export const PriorityModal: React.FC<PriorityModalProps> = ({
  newPriority,
  setNewPriority,
  newSlaDays,
  setNewSlaDays,
  priorityOverrideReason,
  setPriorityOverrideReason,
  setShowPriorityModal,
  handleUpdatePriority,
}) => {
  // === AMÉLIORATION AJOUTÉE : libellés traduits (FR/EN/PT) ===
  const t = currentT();
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            {t.inv_prio_title}
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            {t.inv_prio_hint}
          </p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.inv_prio_level}</label>
          <select
            value={newPriority}
            onChange={(e: any) => setNewPriority(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold"
          >
            <option value="critique">{t.inv_prio_opt_critical}</option>
            <option value="tres_elevee">{t.inv_prio_opt_very_high}</option>
            <option value="elevee">{t.inv_prio_opt_high}</option>
            <option value="faible">{t.inv_prio_opt_low}</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.inv_prio_days}</label>
          <input
            type="number"
            value={newSlaDays}
            onChange={(e) => setNewSlaDays(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.inv_prio_reason}</label>
          <input
            type="text"
            value={priorityOverrideReason}
            onChange={(e) => setPriorityOverrideReason(e.target.value)}
            placeholder={t.inv_prio_reason_ph}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowPriorityModal(false)}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleUpdatePriority}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            {t.inv_prio_apply}
          </button>
        </div>
      </div>
    </div>
  );
};
