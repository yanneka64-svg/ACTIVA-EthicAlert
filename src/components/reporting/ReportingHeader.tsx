/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * En-tête de l'écran Rapports (titre + bouton « Exporter »).
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';
import { BarChart3, FileSpreadsheet } from 'lucide-react';

interface ReportingHeaderProps {
  t: Record<string, string>;
  setShowExportModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ReportingHeader: React.FC<ReportingHeaderProps> = ({
  t,
  setShowExportModal,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-blue-700" />
            <h2 className="text-xl font-bold text-slate-900">
              {t.reporting_title}
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            {t.rep_subtitle}
          </p>
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Retours visuels — écran Rapports
            allégé) === bouton unique (PDF + CSV réunis, la case
            "anonymiser" et le bouton "Imprimer" séparé retirés) — ouvre
            toujours la même modale déjà réelle, qui propose le choix du
            format.
            === AMÉLIORATION AJOUTÉE (Retours visuels — bouton bleu, export
            Excel réel) === couleur passée en bleu (au lieu du bleu marine
            #0B2545) sur retour utilisateur explicite. */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button
            id="btn-export-report"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>{t.report_btn_export}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
