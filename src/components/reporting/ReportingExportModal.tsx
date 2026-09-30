/**
 * === AMÉLIORATION AJOUTÉE (Refactor ReportingDashboard — extraction par
 * section) ===
 *
 * Modale « Exporter des données » (format CSV/PDF, champs à inclure).
 * Son affichage conditionnel (`showExportModal &&`) reste dans
 * ReportingDashboard.tsx.
 *
 * Code strictement déplacé depuis ReportingDashboard.tsx, pas réécrit —
 * aucun changement de comportement. L'état (filtres, modale d'export,
 * champs cochés), toutes les statistiques calculées et les handlers
 * d'export restent possédés par ReportingDashboard.tsx et sont passés en
 * props tels quels.
 */
import React from 'react';
import { EXPORT_FIELD_GROUPS } from './exportFieldGroups';
import type { ExportFieldGroupKey } from './exportFieldGroups';

interface ReportingExportModalProps {
  t: Record<string, string>;
  exportFormat: 'csv' | 'pdf';
  setExportFormat: React.Dispatch<React.SetStateAction<'csv' | 'pdf'>>;
  exportFields: Set<ExportFieldGroupKey>;
  setExportFields: React.Dispatch<React.SetStateAction<Set<ExportFieldGroupKey>>>;
  setShowExportModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleExportCSV: (fields?: Set<ExportFieldGroupKey>) => void;
  handlePrint: () => void;
}

export const ReportingExportModal: React.FC<ReportingExportModalProps> = ({
  t,
  exportFormat,
  setExportFormat,
  exportFields,
  setExportFields,
  setShowExportModal,
  handleExportCSV,
  handlePrint,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <h3 className="text-sm font-bold text-slate-900">{t.export_modal_title}</h3>

        <div>
          <label className="block font-semibold text-slate-700 mb-1.5">{t.export_modal_format}</label>
          <div className="flex gap-1.5">
            {(['csv', 'pdf'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setExportFormat(fmt)}
                className={`flex-1 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition ${
                  exportFormat === fmt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {fmt === 'csv' ? t.export_modal_format_csv : t.export_modal_format_pdf}
              </button>
            ))}
          </div>
        </div>

        {exportFormat === 'csv' && (
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">{t.export_modal_fields}</label>
            <div className="space-y-1.5">
              {EXPORT_FIELD_GROUPS.map((g) => (
                <label key={g.key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportFields.has(g.key)}
                    onChange={(e) => {
                      const next = new Set(exportFields);
                      if (e.target.checked) next.add(g.key);
                      else next.delete(g.key);
                      setExportFields(next);
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">{({ general: t.rep_group_general, status_dates: t.rep_group_status_dates, geo: t.rep_group_country_entity, persons: t.rep_group_persons, corrective: t.rep_group_measures } as Record<string, string>)[g.key] ?? g.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={() => setShowExportModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
            {t.btn_cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              // === AMÉLIORATION AJOUTÉE (export PDF réel du tableau de
              // bord Statistiques) === Ferme cette modale AVANT
              // d'imprimer (plutôt qu'après) : sinon elle restait
              // visible derrière la boîte de dialogue d'impression du
              // navigateur, source de confusion signalée par
              // l'utilisateur.
              setShowExportModal(false);
              if (exportFormat === 'csv') handleExportCSV(exportFields);
              else handlePrint();
            }}
            disabled={exportFormat === 'csv' && exportFields.size === 0}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold"
          >
            {t.export_modal_export}
          </button>
        </div>
      </div>
    </div>
  );
};
