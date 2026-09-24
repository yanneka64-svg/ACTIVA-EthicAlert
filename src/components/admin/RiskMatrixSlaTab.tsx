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
import { Language, UserProfile } from '../../types';
// === AMÉLIORATION AJOUTÉE : onglet traduit (FR/EN/PT) ===
import { TRANSLATIONS } from '../../i18n/translations';
import { storage } from '../../services/storage';

interface RiskMatrixSlaTabProps {
  activeUser: UserProfile;
  onSaved: (msg: string) => void;
  lang?: Language;
}

export const RiskMatrixSlaTab: React.FC<RiskMatrixSlaTabProps> = ({ activeUser, onSaved, lang = 'fr' }) => {
  const t = TRANSLATIONS[lang];
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
    onSaved(t.risk_sla_saved);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">
          {t.risk_matrix_title}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
              <th className="p-3">{t.risk_criterion}</th>
              <th className="p-3 text-emerald-800">{t.risk_low_01}</th>
              <th className="p-3 text-amber-800">{t.risk_high_02}</th>
              <th className="p-3 text-orange-800">{t.risk_very_high_03}</th>
              <th className="p-3 text-rose-800">{t.risk_critical_04}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr>
              <td className="p-3 font-semibold text-slate-900">{t.risk_financial_impact}</td>
              <td className="p-3">&lt; 5 000 Euro</td>
              <td className="p-3">5 000 - 10 000 Euro</td>
              <td className="p-3">10 000 - 20 000 Euro</td>
              <td className="p-3">&gt; 20 000 Euro</td>
            </tr>
            <tr>
              <td className="p-3 font-semibold text-slate-900">{t.risk_hierarchy_level}</td>
              <td className="p-3">{t.sub_hier_employee}</td>
              <td className="p-3">{t.sub_hier_manager}</td>
              <td className="p-3">{t.sub_hier_deputy_director}</td>
              <td className="p-3">{t.risk_director}</td>
            </tr>
            <tr>
              <td className="p-3 font-semibold text-slate-900">{t.risk_recurrence}</td>
              <td className="p-3">{t.risk_none}</td>
              <td className="p-3">{t.risk_possible}</td>
              <td className="p-3">{t.risk_confirmed}</td>
              <td className="p-3">{t.risk_confirmed_major}</td>
            </tr>
            <tr>
              <td className="p-3 font-semibold text-slate-900">{t.risk_reputational}</td>
              <td className="p-3">{t.risk_negligible}</td>
              <td className="p-3">{t.risk_moderate}</td>
              <td className="p-3">{t.risk_high}</td>
              <td className="p-3">{t.risk_high_media}</td>
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
          {t.risk_thresholds_title}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
            <div className="font-bold text-emerald-900">{t.risk_noca1}</div>
            <div className="text-[11px] text-emerald-800">{t.risk_score_4_6}</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">{t.risk_standard_processing}</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca1}
                onChange={(e) => setSlaNoca1(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-emerald-300 rounded-lg bg-white font-bold text-emerald-900"
              />
              <span className="text-[11px] text-slate-500">{t.risk_days_max}</span>
            </label>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
            <div className="font-bold text-amber-900">{t.risk_noca2}</div>
            <div className="text-[11px] text-amber-800">{t.risk_score_7_10}</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">{t.risk_enhanced_followup}</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca2}
                onChange={(e) => setSlaNoca2(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-amber-300 rounded-lg bg-white font-bold text-amber-900"
              />
              <span className="text-[11px] text-slate-500">{t.risk_days_max}</span>
            </label>
          </div>

          <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/60">
            <div className="font-bold text-orange-900">{t.risk_noca3}</div>
            <div className="text-[11px] text-orange-800">{t.risk_score_11_13}</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">{t.risk_urgent_investigation}</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca3}
                onChange={(e) => setSlaNoca3(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-orange-300 rounded-lg bg-white font-bold text-orange-900"
              />
              <span className="text-[11px] text-slate-500">{t.risk_days_max}</span>
            </label>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
            <div className="font-bold text-rose-900">{t.risk_noca4}</div>
            <div className="text-[11px] text-rose-800">{t.risk_score_14_16}</div>
            <div className="text-xs font-semibold mt-2 text-slate-800">{t.risk_immediate_action}</div>
            <label className="flex items-center gap-1.5 mt-1.5">
              <input
                type="number"
                min={1}
                value={slaNoca4}
                onChange={(e) => setSlaNoca4(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 border border-rose-300 rounded-lg bg-white font-bold text-rose-900"
              />
              <span className="text-[11px] text-slate-500">{t.risk_days_max}</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold text-xs shadow-xs transition"
          >
            {t.risk_save_sla}
          </button>
        </div>
      </form>
    </div>
  );
};
