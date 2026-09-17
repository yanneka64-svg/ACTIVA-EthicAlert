/**
 * === AMÉLIORATION AJOUTÉE (Refactor AdminConfigView — extraction par
 * onglet) ===
 *
 * Sixième étape du refactor InvestigationDesk.tsx/AdminConfigView.tsx —
 * voir les PR précédentes (#90-#94) pour le contexte général et les étapes
 * déjà faites. Extraction de l'onglet "Matrice des risques" (barème
 * officiel en lecture seule + configuration SLA éditable) hors du composant
 * monolithique AdminConfigView.tsx, sans aucun changement de comportement.
 *
 * Le plus autonome des onglets restants : aucune modale, aucun état partagé
 * avec un autre onglet (state SLA entièrement local, seedé une fois depuis
 * storage.getSlaConfig() comme dans l'original). Code strictement déplacé,
 * pas réécrit. `activeUser` devient une prop ; `flashBanner` devient la
 * prop `onSaved`, appelée exactement de la même façon.
 */
import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { storage } from '../../services/storage';

interface RiskMatrixSlaTabProps {
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
}

export const RiskMatrixSlaTab: React.FC<RiskMatrixSlaTabProps> = ({ activeUser, onSaved }) => {
  // --- SLA config state (Phase 7 — configuration SLA éditable) ---
  // Seeded once from storage on first mount, like the Firebase config
  // fields of AdminConfigView already do — edited locally, then saved
  // explicitly.
  const initialSlaConfig = storage.getSlaConfig();
  const [slaNoca1, setSlaNoca1] = useState(initialSlaConfig.noca1Days);
  const [slaNoca2, setSlaNoca2] = useState(initialSlaConfig.noca2Days);
  const [slaNoca3, setSlaNoca3] = useState(initialSlaConfig.noca3Days);
  const [slaNoca4, setSlaNoca4] = useState(initialSlaConfig.noca4Days);
  const handleSaveSlaConfig = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updateSlaConfig({ noca1Days: slaNoca1, noca2Days: slaNoca2, noca3Days: slaNoca3, noca4Days: slaNoca4 }, activeUser);
    onSaved('Délais SLA mis à jour.');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">
          Barème officiel de la Matrice des Risques
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
              <th className="p-3">Critère d'évaluation</th>
              <th className="p-3 text-emerald-800">Faible (01)</th>
              <th className="p-3 text-amber-800">Élevé (02)</th>
              <th className="p-3 text-orange-800">Très élevé (03)</th>
              <th className="p-3 text-rose-800">Critique (04)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr>
              <td className="p-3 font-semibold text-slate-900">Impact financier</td>
              <td className="p-3">&lt; 5 000 Euro</td>
              <td className="p-3">5 000 - 10 000 Euro</td>
              <td className="p-3">10 000 - 20 000 Euro</td>
              <td className="p-3">&gt; 20 000 Euro</td>
            </tr>
            <tr>
              <td className="p-3 font-semibold text-slate-900">Niveau hiérarchique</td>
              <td className="p-3">Employé</td>
              <td className="p-3">Cadre</td>
              <td className="p-3">Sous Directeur</td>
              <td className="p-3">Directeur</td>
            </tr>
            <tr>
              <td className="p-3 font-semibold text-slate-900">Récidive</td>
              <td className="p-3">Aucune</td>
              <td className="p-3">Possible</td>
              <td className="p-3">Confirmée</td>
              <td className="p-3">Confirmée (Majeure)</td>
            </tr>
            <tr>
              <td className="p-3 font-semibold text-slate-900">Risque réputationnel</td>
              <td className="p-3">Négligeable</td>
              <td className="p-3">Modéré</td>
              <td className="p-3">Élevé</td>
              <td className="p-3">Élevé / Médiatique</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
          Thresholds Table — now a real editable form against
          storage.getSlaConfig()/updateSlaConfig(), not a static display.
          Saving here changes the actual delay AlertSubmissionFlow sets
          on every new case's targetCompletionDate, and the
          expectedTreatment text computeRiskEvaluation derives — not
          just this screen's own display. */}
      <form onSubmit={handleSaveSlaConfig} className="pt-4 border-t border-slate-200 space-y-3">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
          Seuils de priorité et délais cibles (modifiable)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
            <div className="font-bold text-emerald-900">NOCA 1 - Faible</div>
            <div className="text-[11px] text-emerald-800">Score 4 à 6</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">Traitement standard</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca1}
                onChange={(e) => setSlaNoca1(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-emerald-300 rounded-lg bg-white font-bold text-emerald-900"
              />
              <span className="text-[11px] text-slate-500">jours max</span>
            </label>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
            <div className="font-bold text-amber-900">NOCA 2 - Élevée</div>
            <div className="text-[11px] text-amber-800">Score 7 à 10</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">Suivi renforcé</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca2}
                onChange={(e) => setSlaNoca2(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-amber-300 rounded-lg bg-white font-bold text-amber-900"
              />
              <span className="text-[11px] text-slate-500">jours max</span>
            </label>
          </div>

          <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/60">
            <div className="font-bold text-orange-900">NOCA 3 - Très élevé</div>
            <div className="text-[11px] text-orange-800">Score 11 à 13</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">Enquête urgente</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca3}
                onChange={(e) => setSlaNoca3(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-orange-300 rounded-lg bg-white font-bold text-orange-900"
              />
              <span className="text-[11px] text-slate-500">jours max</span>
            </label>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
            <div className="font-bold text-rose-900">NOCA 4 - Critique</div>
            <div className="text-[11px] text-rose-800">Score 14 à 16</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">Action immédiate</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca4}
                onChange={(e) => setSlaNoca4(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-rose-300 rounded-lg bg-white font-bold text-rose-900"
              />
              <span className="text-[11px] text-slate-500">jours max</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold text-xs shadow-xs transition"
          >
            Enregistrer les délais SLA
          </button>
        </div>
      </form>
    </div>
  );
};
