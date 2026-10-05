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
// === AMÉLIORATION AJOUTÉE (écrans d'administration modernisés) ===
import { Gauge, Coins, Network, Repeat, Megaphone, Minus, Plus } from 'lucide-react';
import { AdminPageHeader, SaveBar } from '../ui/AdminControls';

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
  // === AMÉLIORATION AJOUTÉE (écrans d'administration modernisés) === repère
  // des modifications non enregistrées (barre d'enregistrement).
  const [savedSla, setSavedSla] = useState([initialSlaConfig.noca1Days, initialSlaConfig.noca2Days, initialSlaConfig.noca3Days, initialSlaConfig.noca4Days]);
  const slaDirty = [slaNoca1, slaNoca2, slaNoca3, slaNoca4].some((v, i) => v !== savedSla[i]);
  const handleSaveSlaConfig = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updateSlaConfig({ noca1Days: slaNoca1, noca2Days: slaNoca2, noca3Days: slaNoca3, noca4Days: slaNoca4 }, activeUser);
    setSavedSla([slaNoca1, slaNoca2, slaNoca3, slaNoca4]);
    onSaved(t.risk_sla_saved);
  };

  // === AMÉLIORATION AJOUTÉE (écrans d'administration modernisés) ===
  // Barème en tableau aéré (niveaux en pastilles de couleur, critères avec
  // icône) et délais SLA en cartes avec boutons − / +. Mêmes données, même
  // enregistrement (storage.updateSlaConfig) qu'avant.
  const LEVELS = [
    { label: t.risk_low_01, dot: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: t.risk_high_02, dot: 'bg-amber-500', text: 'text-amber-700' },
    { label: t.risk_very_high_03, dot: 'bg-orange-500', text: 'text-orange-700' },
    { label: t.risk_critical_04, dot: 'bg-rose-600', text: 'text-rose-700' },
  ];
  const CRITERIA: { icon: React.ReactNode; label: string; values: string[] }[] = [
    { icon: <Coins />, label: t.risk_financial_impact, values: ['< 5 000 Euro', '5 000 - 10 000 Euro', '10 000 - 20 000 Euro', '> 20 000 Euro'] },
    { icon: <Network />, label: t.risk_hierarchy_level, values: [t.sub_hier_employee, t.sub_hier_manager, t.sub_hier_deputy_director, t.risk_director] },
    { icon: <Repeat />, label: t.risk_recurrence, values: [t.risk_none, t.risk_possible, t.risk_confirmed, t.risk_confirmed_major] },
    { icon: <Megaphone />, label: t.risk_reputational, values: [t.risk_negligible, t.risk_moderate, t.risk_high, t.risk_high_media] },
  ];
  const SLA_CARDS = [
    { id: 1, title: t.risk_noca1, score: t.risk_score_4_6, label: t.risk_standard_processing, value: slaNoca1, set: setSlaNoca1, bar: 'from-emerald-400 to-emerald-600', ring: 'focus-within:ring-emerald-100', pill: 'bg-emerald-50 text-emerald-700', num: 'text-emerald-700' },
    { id: 2, title: t.risk_noca2, score: t.risk_score_7_10, label: t.risk_enhanced_followup, value: slaNoca2, set: setSlaNoca2, bar: 'from-amber-300 to-amber-500', ring: 'focus-within:ring-amber-100', pill: 'bg-amber-50 text-amber-700', num: 'text-amber-700' },
    { id: 3, title: t.risk_noca3, score: t.risk_score_11_13, label: t.risk_urgent_investigation, value: slaNoca3, set: setSlaNoca3, bar: 'from-orange-400 to-orange-600', ring: 'focus-within:ring-orange-100', pill: 'bg-orange-50 text-orange-700', num: 'text-orange-700' },
    { id: 4, title: t.risk_noca4, score: t.risk_score_14_16, label: t.risk_immediate_action, value: slaNoca4, set: setSlaNoca4, bar: 'from-rose-500 to-rose-700', ring: 'focus-within:ring-rose-100', pill: 'bg-rose-50 text-rose-700', num: 'text-rose-700' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6 text-xs">
      <AdminPageHeader icon={<Gauge />} tone="rose" title={t.risk_matrix_title} subtitle={t.risk_matrix_subtitle} />

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[720px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="p-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.risk_criterion}</th>
              {LEVELS.map((l) => (
                <th key={l.label} className="p-3.5">
                  <span className={`inline-flex items-center gap-2 text-[12px] font-bold ${l.text}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${l.dot}`} />
                    {l.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {CRITERIA.map((c) => (
              <tr key={c.label} className="transition-colors hover:bg-slate-50/60">
                <td className="p-3.5">
                  <span className="inline-flex items-center gap-2.5 font-semibold text-[12.5px] text-[#0B2545]">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">{c.icon}</span>
                    {c.label}
                  </span>
                </td>
                {c.values.map((v, i) => (
                  <td key={i} className="p-3.5 text-[12.5px]">{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === AMÉLIORATION AJOUTÉE (Phase 7 — configuration SLA éditable) ===
          Formulaire réel sur storage.getSlaConfig()/updateSlaConfig() : le
          délai enregistré ici est celui posé sur chaque nouveau dossier. */}
      <form onSubmit={handleSaveSlaConfig} className="pt-2 space-y-4">
        <div>
          <h4 className="text-sm font-extrabold tracking-tight text-[#0B2545]">{t.risk_thresholds_title}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{t.risk_sla_subtitle}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {SLA_CARDS.map((c) => (
            <div key={c.id} className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-5 transition-all duration-300 focus-within:ring-4 ${c.ring} hover:shadow-[0_14px_30px_-22px_rgb(15_23_42/0.4)]`}>
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.bar}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-[13px] text-[#0B2545]">{c.title}</div>
                <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap ${c.pill}`}>{c.score}</span>
              </div>
              <div className="text-[12px] text-slate-500 mt-1">{c.label}</div>
              <div className="mt-4 flex items-center gap-2">
                <button type="button" aria-label="−" onClick={() => c.set(Math.max(1, c.value - 1))} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  id={`sla-noca${c.id}`}
                  type="number"
                  min={1}
                  value={c.value}
                  onChange={(e) => c.set(Math.max(1, Number(e.target.value)))}
                  className={`w-16 h-9 text-center rounded-lg border border-slate-200 bg-white text-lg font-extrabold tabular-nums outline-none ${c.num}`}
                />
                <button type="button" aria-label="+" onClick={() => c.set(c.value + 1)} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-slate-500">{t.risk_days_max}</span>
              </div>
            </div>
          ))}
        </div>
        <SaveBar id="sla-save" type="submit" dirty={slaDirty} onSave={() => {}} saveLabel={t.risk_save_sla} />
      </form>
    </div>
  );
};
