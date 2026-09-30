/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * En-tête du Centre de Pilotage (titre, filtre Année, plage Du/Au,
 * bouton « Exporter »).
 *
 * Code strictement déplacé depuis ControlPanel.tsx, pas réécrit — aucun
 * changement de comportement. L'état (période, année, plage, tendance,
 * export), tous les calculs (KPIs, paniers, SLA, charge de travail…) et les
 * handlers restent possédés par ControlPanel.tsx et sont passés en props
 * tels quels.
 */
import React from 'react';
import { LayoutDashboard, FileSpreadsheet } from 'lucide-react';
import type { PeriodKey } from './dashboardHelpers';

interface ControlPanelHeaderProps {
  t: Record<string, string>;
  period: PeriodKey;
  setPeriod: React.Dispatch<React.SetStateAction<PeriodKey>>;
  customStart: string;
  setCustomStart: React.Dispatch<React.SetStateAction<string>>;
  customEnd: string;
  setCustomEnd: React.Dispatch<React.SetStateAction<string>>;
  selectedYear: number | null;
  setSelectedYear: React.Dispatch<React.SetStateAction<number | null>>;
  availableYears: number[];
  setShowExportModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ControlPanelHeader: React.FC<ControlPanelHeaderProps> = ({
  t,
  period,
  setPeriod,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  selectedYear,
  setSelectedYear,
  availableYears,
  setShowExportModal,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-[#0B2545] text-amber-400 flex items-center justify-center shrink-0 shadow-md ring-2 ring-blue-900/20">
          <LayoutDashboard className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{t.cp_title}</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live DARC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{t.cp_subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* === AMÉLIORATION AJOUTÉE (filtre de période + export + suivi
            annuel) === Sur demande explicite : le bouton "30 jours" (qui
            ne filtrait en réalité jamais l'affichage — seul le delta
            d'une carte KPI l'utilisait, voir getPeriodWindow) est
            retiré, ainsi que le bouton "calendrier" + popover qui l'a
            remplacé un temps (libellé "Toute la période" retiré à son
            tour, sur demande explicite) : les deux champs de date Du/Au
            sont désormais affichés directement, sans étape de clic
            intermédiaire. Filtrent réellement tout l'écran (KPIs,
            graphiques, tableau — voir `scopedVisible`), avec un
            sélecteur d'Année en alternative (jamais les deux en même
            temps) pour le suivi année par année, et un bouton de
            téléchargement CSV des dossiers de la période affichée. */}
        <select
          value={period === 'year' && selectedYear ? String(selectedYear) : ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              setPeriod('all_time');
              setSelectedYear(null);
            } else {
              setSelectedYear(Number(v));
              setPeriod('year');
              setCustomStart('');
              setCustomEnd('');
            }
          }}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
        >
          <option value="">{t.cp_year_all}</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-[11px]">
          <input
            type="date"
            value={customStart}
            onChange={(e) => { setCustomStart(e.target.value); setPeriod('custom'); setSelectedYear(null); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-800 shadow-2xs"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => { setCustomEnd(e.target.value); setPeriod('custom'); setSelectedYear(null); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-800 shadow-2xs"
          />
        </div>
        {/* === AMÉLIORATION AJOUTÉE (Correction demandée — bouton
            Exporter, fusion avec `main`) === Remplace l'ancien bouton
            "Télécharger (CSV)" mono-format par un bouton "Exporter"
            ouvrant le choix CSV/PDF (modale ci-dessous), sur demande
            explicite de l'utilisateur. Le bouton "Actualiser"
            (lastRefreshed/handleRefresh) qui vivait ici a été retiré
            indépendamment par `main` lors de son propre refactor du
            filtre de période (remplacé par la mise à jour déjà continue
            via storage.subscribe) — aligné avec cet état actuel plutôt
            que réintroduit lors de cette fusion. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" /> {t.cp_btn_export}
          </button>
        </div>
      </div>
    </div>
  );
};
