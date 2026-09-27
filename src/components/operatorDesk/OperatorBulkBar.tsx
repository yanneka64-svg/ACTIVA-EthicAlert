/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Barre d'actions groupées (Attribuer / Réattribuer / Relancer / Désélectionner).
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 */
import React from 'react';
import { UserPlus, UserCog, Send } from 'lucide-react';
import { Button } from '../ui';
import { ModeConfig } from './modeConfig';

interface OperatorBulkBarProps {
  t: Record<string, string>;
  cfg: ModeConfig;
  canAssign: boolean;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAssignTargetIds: (v: string[] | null) => void;
  setAssignSelectedInvestigatorIds: React.Dispatch<React.SetStateAction<string[]>>;
  setFollowupTargetIds: (v: string[] | null) => void;
  setFollowupText: (v: string) => void;
}

export const OperatorBulkBar: React.FC<OperatorBulkBarProps> = ({
  t,
  cfg,
  canAssign,
  selectedIds,
  setSelectedIds,
  setAssignTargetIds,
  setAssignSelectedInvestigatorIds,
  setFollowupTargetIds,
  setFollowupText,
}) => {
  return (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs">
      <span className="font-semibold text-blue-900">{t.op_selected_count.replace('{n}', String(selectedIds.size))}</span>
      <div className="flex items-center gap-2">
        {cfg.rowAction === 'assign' && canAssign && (
          <Button
            size="sm"
            icon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => { setAssignTargetIds(Array.from(selectedIds)); setAssignSelectedInvestigatorIds([]); }}
          >
            {t.op_assign}
          </Button>
        )}
        {cfg.rowAction === 'reassign' && canAssign && (
          <Button
            size="sm"
            icon={<UserCog className="w-3.5 h-3.5" />}
            onClick={() => { setAssignTargetIds(Array.from(selectedIds)); setAssignSelectedInvestigatorIds([]); }}
          >
            {t.op_reassign}
          </Button>
        )}
        {cfg.rowAction === 'followup' && (
          <Button
            size="sm"
            icon={<Send className="w-3.5 h-3.5" />}
            onClick={() => { setFollowupTargetIds(Array.from(selectedIds)); setFollowupText(''); }}
          >
            {t.op_followup}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
          {t.op_deselect}
        </Button>
      </div>
    </div>
  );
};
