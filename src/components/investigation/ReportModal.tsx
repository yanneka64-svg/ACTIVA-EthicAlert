/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingt-et-unième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/
 * #113/#114/#115/#116 pour les étapes précédentes. Extraction de la modale
 * "Rédiger le rapport d'investigation" hors du composant monolithique, sans
 * aucun changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleSaveInvestigationReport`/`handleImportReportFile` et
 * `reportFileInputRef` restent possédés par InvestigationDesk.tsx (ferment
 * sur selectedAlert/la lecture de fichier locale) : passés en props tels
 * quels.
 */
import React from 'react';
import { ClipboardList, FileText, Paperclip, X } from 'lucide-react';
import { AlertRecord, EvidenceFile } from '../../types';

interface ReportModalProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  reportDraft: string;
  setReportDraft: (v: string) => void;
  reportFile: EvidenceFile | undefined;
  setReportFile: (v: EvidenceFile | undefined) => void;
  reportFileInputRef: React.RefObject<HTMLInputElement>;
  setShowReportModal: (v: boolean) => void;
  handleImportReportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveInvestigationReport: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  t,
  selectedAlert,
  reportDraft,
  setReportDraft,
  reportFile,
  setReportFile,
  reportFileInputRef,
  setShowReportModal,
  handleImportReportFile,
  handleSaveInvestigationReport,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 text-teal-700">
            <ClipboardList className="w-4 h-4" />
            {t.report_modal_title} — {selectedAlert.trackingNumber}
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">{t.report_modal_desc}</p>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.report_modal_label}</label>
          <textarea
            rows={6}
            value={reportDraft}
            onChange={(e) => setReportDraft(e.target.value)}
            placeholder={t.report_modal_placeholder}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Import d'un rapport d'investigation
            en fichier) === Même mécanisme que "Preuves & pièces
            jointes" (handleAddEvidenceFile) : lecture locale en
            dataUrl, jamais d'upload réseau fabriqué. */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">{t.report_modal_import_label}</label>
          {reportFile ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-800 block truncate">{reportFile.name}</span>
                <span className="text-[10px] text-slate-400">{Math.round(reportFile.size / 1024)} Ko</span>
              </div>
              <button
                type="button"
                onClick={() => setReportFile(undefined)}
                className="text-slate-400 hover:text-rose-600 shrink-0"
                title={t.report_modal_remove_file}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => reportFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 font-semibold"
            >
              <Paperclip className="w-3.5 h-3.5" />
              {t.report_modal_import_btn}
            </button>
          )}
          <input id="report-file-input" ref={reportFileInputRef} type="file" className="hidden" onChange={handleImportReportFile} />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowReportModal(false)}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {t.btn_cancel}
          </button>
          <button
            type="button"
            id="btn-report-submit"
            onClick={handleSaveInvestigationReport}
            disabled={!reportDraft.trim() && !reportFile}
            className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold"
          >
            {t.report_modal_submit}
          </button>
        </div>
      </div>
    </div>
  );
};
