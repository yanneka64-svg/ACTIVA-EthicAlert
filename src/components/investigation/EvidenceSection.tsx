/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Cinquième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100 pour les étapes précédentes. Extraction du contenu de
 * l'onglet "Preuves" hors du composant monolithique, sans aucun changement
 * de comportement. Code strictement déplacé, pas réécrit.
 *
 * `evidenceFileInputRef` reste possédé par InvestigationDesk.tsx : le
 * `<input type="file">` caché qu'il référence est rendu une seule fois,
 * dans le résumé "Vue d'ensemble" (pas encore extrait) — un `RefObject`
 * pointe vers le même nœud DOM quel que soit le composant qui l'utilise,
 * donc `.current?.click()` continue de fonctionner à l'identique depuis
 * ce nouveau composant.
 */
import React from 'react';
import { Plus, FileText } from 'lucide-react';
import { AlertRecord, Language } from '../../types';

interface EvidenceSectionProps {
  selectedAlert: AlertRecord;
  lang: Language;
  t: Record<string, string>;
  evidenceFileInputRef: React.RefObject<HTMLInputElement>;
}

export const EvidenceSection: React.FC<EvidenceSectionProps> = ({ selectedAlert, lang, t, evidenceFileInputRef }) => {
  return (
    <div className="p-6 space-y-3 max-h-[640px] overflow-y-auto text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          {t.nav_evidence} ({selectedAlert.evidences.length})
        </span>
        <button
          onClick={() => evidenceFileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.case_btn_add}
        </button>
      </div>
      {selectedAlert.evidences.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
          {t.inv_no_documents}
        </div>
      ) : (
        <div className="space-y-1.5">
          {selectedAlert.evidences.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-800 block truncate">{ev.name}</span>
                <span className="text-[10px] text-slate-400">
                  {ev.type || 'application/octet-stream'} •{' '}
                  {new Date(ev.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{Math.round(ev.size / 1024)} Ko</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
