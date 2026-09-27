/**
 * === AMÉLIORATION AJOUTÉE (Refactor ControlPanel — extraction par
 * section) ===
 *
 * Modale de choix du format d'export (CSV/PDF). Son affichage
 * conditionnel (`showExportModal &&`) reste dans ControlPanel.tsx.
 *
 * Code strictement déplacé depuis ControlPanel.tsx, pas réécrit — aucun
 * changement de comportement. L'état (période, année, plage, tendance,
 * export), tous les calculs (KPIs, paniers, SLA, charge de travail…) et les
 * handlers restent possédés par ControlPanel.tsx et sont passés en props
 * tels quels.
 */
import React from 'react';

interface ControlPanelExportModalProps {
  t: Record<string, string>;
  exportFormat: 'csv' | 'pdf';
  setExportFormat: React.Dispatch<React.SetStateAction<'csv' | 'pdf'>>;
  setShowExportModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleExportCSV: () => void;
  handlePrint: () => void;
}

export const ControlPanelExportModal: React.FC<ControlPanelExportModalProps> = ({
  t,
  exportFormat,
  setExportFormat,
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
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={() => setShowExportModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
            {t.btn_cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              // === AMÉLIORATION AJOUTÉE (fusion avec `main`) === Ferme
              // cette modale AVANT d'exporter/imprimer (plutôt qu'après),
              // même correction que ReportingDashboard.tsx : sinon elle
              // restait visible derrière la boîte de dialogue
              // d'impression du navigateur.
              setShowExportModal(false);
              if (exportFormat === 'csv') handleExportCSV();
              else handlePrint();
            }}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {t.export_modal_export}
          </button>
        </div>
      </div>
    </div>
  );
};
