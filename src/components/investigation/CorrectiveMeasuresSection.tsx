/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Septième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103 pour les étapes précédentes. Extraction du
 * contenu de l'onglet "Actions correctives" hors du composant
 * monolithique, sans aucun changement de comportement. Code strictement
 * déplacé, pas réécrit.
 *
 * `setShowAddMeasureModal` reste possédé par InvestigationDesk.tsx (la
 * modale "Documenter une mesure corrective" n'est pas encore extraite) :
 * passé en prop tel quel. L'id `btn-add-measure-trigger` du bouton est
 * conservé — potentiellement utilisé comme point d'ancrage ailleurs
 * (checklist de clôture du dossier, non vérifiée mais non retirée par
 * prudence).
 */
import React from 'react';
import { FileCheck2, Plus } from 'lucide-react';
import { AlertRecord } from '../../types';

interface CorrectiveMeasuresSectionProps {
  selectedAlert: AlertRecord;
  t: Record<string, string>;
  setShowAddMeasureModal: (v: boolean) => void;
}

export const CorrectiveMeasuresSection: React.FC<CorrectiveMeasuresSectionProps> = ({ selectedAlert, t, setShowAddMeasureModal }) => {
  return (
    <div className="p-6 space-y-6 max-h-[560px] overflow-y-auto text-xs">
      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950">
        <h4 className="font-bold uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
          <FileCheck2 className="w-4 h-4 text-indigo-700" />
          Mesures correctives & disciplinaires
        </h4>
        <p className="text-[11px] text-indigo-800">
          {t.corrective_required_note}
        </p>
      </div>

      <div className="flex justify-between items-center">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          Mesures enregistrées ({selectedAlert.correctiveMeasures.length})
        </span>
        <button
          id="btn-add-measure-trigger"
          onClick={() => setShowAddMeasureModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.btn_add_measure}</span>
        </button>
      </div>

      {selectedAlert.correctiveMeasures.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
          Aucune mesure corrective documentée pour l'instant. Vous devez en formaliser au moins une pour clôturer le dossier.
        </div>
      ) : (
        <div className="space-y-3">
          {selectedAlert.correctiveMeasures.map((cm) => (
            <div key={cm.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{cm.title}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  cm.status === 'implemented' || cm.status === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {cm.status.toUpperCase()}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed">{cm.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                <div><strong className="text-slate-700">Responsable :</strong> {cm.responsiblePerson}</div>
                <div><strong className="text-slate-700">Échéance :</strong> {cm.dueDate}</div>
                <div><strong className="text-slate-700">Documenté par :</strong> {cm.documentedBy}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
