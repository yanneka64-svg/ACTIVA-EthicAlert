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
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Modifier la classification et les délais de traitement
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Le point de contact peut ajuster la priorité et les délais préconfigurés.
          </p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Niveau de priorité</label>
          <select
            value={newPriority}
            onChange={(e: any) => setNewPriority(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold"
          >
            <option value="critique">Critique (Action immédiate 48h)</option>
            <option value="tres_elevee">Très élevée (Enquête urgente 7j)</option>
            <option value="elevee">Élevée (Suivi renforcé 15j)</option>
            <option value="faible">Faible (Traitement standard 30j)</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Délai de traitement cible (en jours)</label>
          <input
            type="number"
            value={newSlaDays}
            onChange={(e) => setNewSlaDays(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Motif de l'ajustement</label>
          <input
            type="text"
            value={priorityOverrideReason}
            onChange={(e) => setPriorityOverrideReason(e.target.value)}
            placeholder="Ex: Confirmation d'un préjudice supérieur à 20k€..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowPriorityModal(false)}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={handleUpdatePriority}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            Appliquer les modifications
          </button>
        </div>
      </div>
    </div>
  );
};
