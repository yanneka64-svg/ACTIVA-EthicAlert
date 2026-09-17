/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Huitième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104 pour les étapes précédentes. Extraction du
 * contenu de l'onglet "Tâches" hors du composant monolithique, sans aucun
 * changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `taskEffectiveStatus` (fonction pure, sans dépendance à la fermeture du
 * composant — uniquement `task.status`/`task.dueDate`/`Date.now()`) est
 * déplacée ici telle quelle plutôt que dupliquée ou passée en prop,
 * puisqu'elle n'était déjà utilisée nulle part ailleurs dans
 * InvestigationDesk.tsx. `setShowAddTaskModal`/`handleToggleTaskStatus`
 * restent possédés par InvestigationDesk.tsx (la modale "+ Nouvelle
 * tâche" n'est pas encore extraite, et le second journalise via
 * `activeUser`/`selectedAlert` déjà fermés sur ce composant) : passés en
 * props tels quels.
 */
import React from 'react';
import { Plus, CheckSquare, Square } from 'lucide-react';
import { AlertRecord, UserProfile, CaseTask } from '../../types';

function taskEffectiveStatus(task: CaseTask): CaseTask['status'] {
  if (task.status === 'completed') return 'completed';
  if (new Date(task.dueDate).getTime() < Date.now()) return 'overdue';
  return task.status;
}

interface TasksSectionProps {
  selectedAlert: AlertRecord;
  allUsers: UserProfile[];
  t: Record<string, string>;
  setShowAddTaskModal: (v: boolean) => void;
  handleToggleTaskStatus: (task: CaseTask) => void;
}

export const TasksSection: React.FC<TasksSectionProps> = ({ selectedAlert, allUsers, t, setShowAddTaskModal, handleToggleTaskStatus }) => {
  return (
    <div className="p-6 space-y-4 max-h-[560px] overflow-y-auto text-xs">
      <div className="flex justify-between items-center">
        <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
          {t.tab_tasks} ({(selectedAlert.tasks ?? []).length})
        </span>
        <button
          onClick={() => setShowAddTaskModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.btn_add_task}</span>
        </button>
      </div>

      {(selectedAlert.tasks ?? []).length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
          {t.tasks_empty}
        </div>
      ) : (
        <div className="space-y-2">
          {(selectedAlert.tasks ?? []).map((task) => {
            const effStatus = taskEffectiveStatus(task);
            const owner = allUsers.find((u) => u.id === task.owner);
            return (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <button onClick={() => handleToggleTaskStatus(task)} className="mt-0.5 shrink-0 text-slate-500 hover:text-blue-700">
                  {task.status === 'completed' ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold text-slate-900 ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>{task.title}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                      effStatus === 'overdue' ? 'bg-rose-100 text-rose-800'
                      : effStatus === 'completed' ? 'bg-emerald-100 text-emerald-800'
                      : effStatus === 'in_progress' ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200 text-slate-700'
                    }`}>
                      {t[`task_status_${effStatus}` as keyof typeof t]}
                    </span>
                  </div>
                  {task.description && <p className="text-slate-600 mt-0.5">{task.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1.5">
                    <span>{t.task_owner_label} : <strong className="text-slate-700">{owner?.name ?? task.owner}</strong></span>
                    <span>{t.task_due_date_label} : <strong className="text-slate-700">{task.dueDate}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
