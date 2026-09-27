/**
 * === AMÉLIORATION AJOUTÉE (Refactor OperatorCaseDesk — extraction par
 * section) ===
 *
 * Modale de relance partagée (En attente d'infos, simple ou groupée).
 *
 * Code strictement déplacé depuis OperatorCaseDesk.tsx, pas réécrit —
 * aucun changement de comportement.
 */
import React from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '../ui';

interface OperatorFollowupModalProps {
  t: Record<string, string>;
  followupTargetIds: string[];
  setFollowupTargetIds: (v: string[] | null) => void;
  followupText: string;
  setFollowupText: (v: string) => void;
  defaultFollowupMessage: string;
  handleConfirmFollowup: () => void;
}

export const OperatorFollowupModal: React.FC<OperatorFollowupModalProps> = ({
  t,
  followupTargetIds,
  setFollowupTargetIds,
  followupText,
  setFollowupText,
  defaultFollowupMessage,
  handleConfirmFollowup,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setFollowupTargetIds(null)}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">{t.op_followup_title}</h3>
          <button onClick={() => setFollowupTargetIds(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-500">{t.op_followup_count.replace('{n}', String(followupTargetIds.length))}</p>
        <textarea
          value={followupText}
          onChange={(e) => setFollowupText(e.target.value)}
          placeholder={defaultFollowupMessage}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setFollowupTargetIds(null)}>{t.btn_cancel}</Button>
          <Button size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={handleConfirmFollowup}>
            {t.common_send}
          </Button>
        </div>
      </div>
    </div>
  );
};
