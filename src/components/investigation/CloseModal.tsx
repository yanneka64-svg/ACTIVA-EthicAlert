/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingtième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/#113/
 * #114/#115/#116 pour les étapes précédentes. Extraction de la modale
 * "Clôturer le dossier" (checklist de clôture incluse, Phase 6/§33) hors du
 * composant monolithique, sans aucun changement de comportement. Code
 * strictement déplacé, pas réécrit — y compris le petit composant local
 * `ChecklistRow`, qui n'existe que pour cette modale.
 *
 * `handleCloseAlert` et `setActiveCaseTab` restent possédés par
 * InvestigationDesk.tsx (le premier ferme sur selectedAlert/activeUser/la
 * persistance, le second pilote l'onglet actif de toute la fiche dossier) :
 * passés en props tels quels.
 */
import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { AlertRecord } from '../../types';

type CaseTab = 'overview' | 'messages' | 'corrective' | 'tasks' | 'interviews' | 'timeline' | 'triage' | 'persons' | 'evidence_tab' | 'report';

interface CloseModalProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  closureSummary: string;
  setClosureSummary: (v: string) => void;
  closureMessageToWb: string;
  setClosureMessageToWb: (v: string) => void;
  setShowCloseModal: (v: boolean) => void;
  setActiveCaseTab: (v: CaseTab) => void;
  handleCloseAlert: () => void;
}

export const CloseModal: React.FC<CloseModalProps> = ({
  t,
  selectedAlert,
  closureSummary,
  setClosureSummary,
  closureMessageToWb,
  setClosureMessageToWb,
  setShowCloseModal,
  setActiveCaseTab,
  handleCloseAlert,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {t.desk_close_title.replace('{tracking}', selectedAlert.trackingNumber)}
          </h3>
        </div>

        {/* === AMÉLIORATION AJOUTÉE (Phase 6 — checklist de clôture, §33) ===
            A real, computed checklist over the case's own data — not a
            separate stored list. Only the first item (corrective measure)
            is a hard gate, exactly as before (handleCloseAlert still
            enforces it); the rest are visibility-only additions so
            nothing that could close before still can't. */}
        {(() => {
          const hasCorrective = selectedAlert.correctiveMeasures.length > 0;
          const hasAssigned = selectedAlert.assignedInvestigators.length > 0;
          const hasNotes = selectedAlert.internalNotes.length > 0;
          const hasConflictDeclaration = (selectedAlert.conflictDeclarations ?? []).length > 0;
          const openTasks = (selectedAlert.tasks ?? []).filter((tk) => tk.status !== 'completed');
          const noOpenTasks = openTasks.length === 0;
          const ChecklistRow = ({ ok, label, mandatory, onFix }: { ok: boolean; label: string; mandatory?: boolean; onFix?: () => void }) => (
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="flex items-center gap-1.5 text-slate-700">
                {ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${mandatory ? 'text-rose-600' : 'text-amber-500'}`} />
                )}
                <span className={!ok && mandatory ? 'font-semibold text-rose-800' : ''}>{label}</span>
              </span>
              {!ok && onFix && (
                <button type="button" onClick={onFix} className="text-blue-700 hover:underline font-semibold text-[11px] shrink-0">
                  {t.closure_check_goto}
                </button>
              )}
            </div>
          );
          return (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                {t.closure_checklist_title}
              </div>
              <ChecklistRow
                ok={hasCorrective}
                mandatory
                label={t.closure_check_corrective}
                onFix={() => { setShowCloseModal(false); setActiveCaseTab('corrective'); }}
              />
              <ChecklistRow ok={hasAssigned} label={t.closure_check_assigned} />
              <ChecklistRow ok={hasNotes} label={t.closure_check_notes} onFix={() => { setShowCloseModal(false); setActiveCaseTab('report'); }} />
              <ChecklistRow ok={hasConflictDeclaration} label={t.closure_check_conflict} onFix={() => { setShowCloseModal(false); setActiveCaseTab('report'); }} />
              <ChecklistRow ok={noOpenTasks} label={t.closure_check_tasks} onFix={() => { setShowCloseModal(false); setActiveCaseTab('tasks'); }} />
            </div>
          );
        })()}

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            {t.desk_closure_summary_label}
          </label>
          <textarea
            rows={3}
            value={closureSummary}
            onChange={(e) => setClosureSummary(e.target.value)}
            placeholder={t.desk_closure_summary_ph}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            {t.desk_closure_message_label}
          </label>
          <textarea
            rows={3}
            value={closureMessageToWb}
            onChange={(e) => setClosureMessageToWb(e.target.value)}
            placeholder={t.desk_closure_message_ph}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowCloseModal(false)}
            className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
          >
            {t.btn_cancel}
          </button>
          <button
            type="button"
            onClick={handleCloseAlert}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {t.desk_confirm_closure}
          </button>
        </div>
      </div>
    </div>
  );
};
