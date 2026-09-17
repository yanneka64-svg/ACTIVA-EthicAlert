/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Dix-neuvième étape du refactor par section d'InvestigationDesk.tsx —
 * voir #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/
 * #112/#113/#114 pour les étapes précédentes (voir aussi
 * AssignCandidateRow.tsx, déplacé dans la même série). Extraction de la
 * modale "Attribuer l'alerte à un ou plusieurs gestionnaires" hors du
 * composant monolithique, sans aucun changement de comportement. Code
 * strictement déplacé, pas réécrit.
 *
 * `assignCandidates` (moteur de compatibilité,
 * domain/assignmentEngine.ts) et `handleAssignInvestigators` restent
 * possédés par InvestigationDesk.tsx (ferment sur selectedAlert/
 * investigatorUsers/alerts/la persistance) : passés en props tels quels.
 */
import React from 'react';
import { AlertRecord } from '../../types';
import { AssignmentCandidates } from '../../domain/assignmentEngine';
import { AssignCandidateRow } from './AssignCandidateRow';

interface AssignModalProps {
  selectedAlert: AlertRecord;
  assignCandidates: AssignmentCandidates | null;
  selectedInvestigatorIds: string[];
  setSelectedInvestigatorIds: (v: string[]) => void;
  setShowAssignModal: (v: boolean) => void;
  handleAssignInvestigators: () => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({
  selectedAlert,
  assignCandidates,
  selectedInvestigatorIds,
  setSelectedInvestigatorIds,
  setShowAssignModal,
  handleAssignInvestigators,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Attribuer l'alerte à un ou plusieurs gestionnaires
          </h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Dossier {selectedAlert.trackingNumber} ({selectedAlert.concernedEntity})
          </p>
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
            Remplace la liste plate et non triée par le moteur de
            compatibilité : "Compatibles" (même pays+entité que le
            dossier) affichés en premier, puis "Autorisés Groupe"
            (périmètre vide) en second — jamais un enquêteur dont le
            périmètre ne correspond à aucun des deux par défaut, voir
            domain/assignmentEngine.ts. Chaque ligne affiche désormais
            aussi la charge de travail réelle (dossiers actifs/en
            retard), déjà calculée pour le Centre de Pilotage mais
            jusqu'ici invisible ici. */}
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {assignCandidates && assignCandidates.compatible.length === 0 && assignCandidates.groupAuthorized.length === 0 && (
            <p className="text-slate-500 text-[11px] italic p-2">
              Aucun enquêteur compatible ou autorisé Groupe pour ce dossier (périmètre, confidentialité, conflit d'intérêt ou disponibilité).
            </p>
          )}

          {assignCandidates && assignCandidates.compatible.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Enquêteurs compatibles ({selectedAlert.concernedEntity})
              </div>
              {assignCandidates.compatible.map((c) => (
                <AssignCandidateRow
                  key={c.user.id}
                  candidate={c}
                  checked={selectedInvestigatorIds.includes(c.user.id)}
                  onToggle={(checked) =>
                    setSelectedInvestigatorIds(
                      checked
                        ? [...selectedInvestigatorIds, c.user.id]
                        : selectedInvestigatorIds.filter((id) => id !== c.user.id)
                    )
                  }
                />
              ))}
            </div>
          )}

          {assignCandidates && assignCandidates.groupAuthorized.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                Enquêteurs autorisés Groupe (vision Groupe)
              </div>
              {assignCandidates.groupAuthorized.map((c) => (
                <AssignCandidateRow
                  key={c.user.id}
                  candidate={c}
                  checked={selectedInvestigatorIds.includes(c.user.id)}
                  onToggle={(checked) =>
                    setSelectedInvestigatorIds(
                      checked
                        ? [...selectedInvestigatorIds, c.user.id]
                        : selectedInvestigatorIds.filter((id) => id !== c.user.id)
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => setShowAssignModal(false)}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            onClick={handleAssignInvestigators}
            className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white font-bold"
          >
            Enregistrer l'attribution
          </button>
        </div>
      </div>
    </div>
  );
};
