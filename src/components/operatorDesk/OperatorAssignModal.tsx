/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Modale d'attribution partagée (simple ou groupée).
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 */
import React from 'react';
import { X, UserPlus } from 'lucide-react';
import { AssignmentCandidate } from '../../domain/assignmentEngine';
import { Button, EmptyState } from '../ui';
import { AssignCandidateRow } from '../investigation/AssignCandidateRow';

interface OperatorAssignModalProps {
  t: Record<string, string>;
  assignTargetIds: string[];
  setAssignTargetIds: (v: string[] | null) => void;
  assignCandidates: { compatible: AssignmentCandidate[]; groupAuthorized: AssignmentCandidate[] };
  assignSelectedInvestigatorIds: string[];
  setAssignSelectedInvestigatorIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleConfirmAssign: () => void;
}

export const OperatorAssignModal: React.FC<OperatorAssignModalProps> = ({
  t,
  assignTargetIds,
  setAssignTargetIds,
  assignCandidates,
  assignSelectedInvestigatorIds,
  setAssignSelectedInvestigatorIds,
  handleConfirmAssign,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAssignTargetIds(null)}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{t.op_assign_title}</h3>
          <button onClick={() => setAssignTargetIds(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-500">{t.op_selected_count_dot.replace('{n}', String(assignTargetIds.length))}</p>

        {assignCandidates.compatible.length === 0 && assignCandidates.groupAuthorized.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={t.op_no_compatible}
            description={
              assignTargetIds.length > 1
                ? t.op_no_compatible_multi
                : t.op_no_compatible_single
            }
          />
        ) : (
          <div className="space-y-3">
            {assignCandidates.compatible.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">{t.op_compatible_same_scope}</p>
                <div className="space-y-1.5">
                  {assignCandidates.compatible.map((c) => (
                    <AssignCandidateRow
                      key={c.user.id}
                      candidate={c}
                      checked={assignSelectedInvestigatorIds.includes(c.user.id)}
                      onToggle={(checked) => setAssignSelectedInvestigatorIds((prev) => (checked ? [...prev, c.user.id] : prev.filter((id) => id !== c.user.id)))}
                    />
                  ))}
                </div>
              </div>
            )}
            {assignCandidates.groupAuthorized.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">{t.op_group_authorised}</p>
                <div className="space-y-1.5">
                  {assignCandidates.groupAuthorized.map((c) => (
                    <AssignCandidateRow
                      key={c.user.id}
                      candidate={c}
                      checked={assignSelectedInvestigatorIds.includes(c.user.id)}
                      onToggle={(checked) => setAssignSelectedInvestigatorIds((prev) => (checked ? [...prev, c.user.id] : prev.filter((id) => id !== c.user.id)))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={() => setAssignTargetIds(null)}>{t.btn_cancel}</Button>
          <Button
            size="sm"
            disabled={assignSelectedInvestigatorIds.length === 0}
            onClick={handleConfirmAssign}
          >
            {t.op_confirm_assign}
          </Button>
        </div>
      </div>
    </div>
  );
};
