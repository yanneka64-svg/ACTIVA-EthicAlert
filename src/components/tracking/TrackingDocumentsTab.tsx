/**
 * === AMÉLIORATION AJOUTÉE (Refactor AlertTrackingView — extraction par
 * section) ===
 *
 * Onglet « Pièces jointes » (dépôt, téléchargement, suppression).
 *
 * Code strictement déplacé depuis AlertTrackingView.tsx, pas réécrit —
 * aucun changement de comportement. L'état, la connexion (hash salé +
 * verrou anti-brute-force) et tous les handlers restent possédés par
 * AlertTrackingView.tsx et sont passés en props tels quels.
 */
import React from 'react';
import { FileText, Download, Trash2, Upload, Info, MoreVertical } from 'lucide-react';
import { Language, AlertRecord } from '../../types';

interface TrackingDocumentsTabProps {
  t: Record<string, string>;
  lang: Language;
  activeAlert: AlertRecord;
  isDocDragging: boolean;
  setIsDocDragging: React.Dispatch<React.SetStateAction<boolean>>;
  openFileMenuId: string | null;
  setOpenFileMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  handleDocFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDocDrop: (e: React.DragEvent) => void;
  handleDownloadEvidence: (ev: AlertRecord['evidences'][number]) => void;
  handleDeleteEvidence: (id: string) => void;
}

export const TrackingDocumentsTab: React.FC<TrackingDocumentsTabProps> = ({
  t,
  lang,
  activeAlert,
  isDocDragging,
  setIsDocDragging,
  openFileMenuId,
  setOpenFileMenuId,
  handleDocFileChange,
  handleDocDrop,
  handleDownloadEvidence,
  handleDeleteEvidence,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-900">{t.track_tab_documents}</h3>
      <p className="text-xs text-slate-500 mb-4">{t.track_docs_subtitle}</p>

      {/* === AMÉLIORATION AJOUTÉE (Phase 33) === le lanceur d'alerte
          peut désormais ajouter lui-même des pièces jointes depuis
          son espace de suivi (glisser-déposer ou sélection), pas
          seulement au moment du dépôt initial. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDocDragging(true);
        }}
        onDragLeave={() => setIsDocDragging(false)}
        onDrop={handleDocDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
          isDocDragging ? 'border-blue-500 bg-blue-50/40' : 'border-slate-300 bg-slate-50/50 hover:border-blue-400'
        }`}
      >
        <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-700">{t.track_docs_upload_title}</p>
        <p className="text-[11px] text-slate-500 mt-1">{t.track_docs_upload_hint}</p>
        <p className="text-[10px] text-slate-400 mt-1">{t.track_docs_upload_formats}</p>
        <input
          type="file"
          id="track-doc-file-input"
          multiple
          onChange={handleDocFileChange}
          className="mt-3 block mx-auto text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
      </div>

      <div className="space-y-1.5 mt-4">
        {activeAlert.evidences.length === 0 ? (
          <span className="text-slate-400 italic text-[11px]">{t.track_no_evidence}</span>
        ) : (
          activeAlert.evidences.map((ev) => (
            <div key={ev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-slate-700 truncate flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{ev.name}</span>
              </span>
              <span className="text-slate-400 shrink-0 hidden sm:inline">
                {new Date(ev.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
              </span>
              <span className="text-slate-400 shrink-0">{(ev.size / 1024).toFixed(0)} Ko</span>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenFileMenuId(openFileMenuId === ev.id ? null : ev.id)}
                  className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
                  title={t.common_options}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {openFileMenuId === ev.id && (
                  <div
                    className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 text-xs"
                    onMouseLeave={() => setOpenFileMenuId(null)}
                  >
                    <button
                      type="button"
                      onClick={() => { handleDownloadEvidence(ev); setOpenFileMenuId(null); }}
                      disabled={!ev.dataUrl}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Download className="w-3.5 h-3.5" /> {t.common_download}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvidence(ev.id)}
                      className="w-full text-left px-3 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t.common_delete}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2.5 mt-4">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>{t.track_docs_metadata_warning}</p>
      </div>
    </div>
  );
};
