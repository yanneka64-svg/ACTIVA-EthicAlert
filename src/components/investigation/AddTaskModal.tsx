/**
 * === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
 * section) ===
 *
 * Vingtième étape du refactor par section d'InvestigationDesk.tsx — voir
 * #90/#99/#100/#101/#103/#104/#105/#106/#107/#108/#109/#110/#111/#112/
 * #113/#114/#115 pour les étapes précédentes. Extraction de la modale
 * "+ Nouvelle tâche" hors du composant monolithique, sans aucun
 * changement de comportement. Code strictement déplacé, pas réécrit.
 *
 * `handleAddTask` reste possédé par InvestigationDesk.tsx (ferme sur
 * selectedAlert/activeUser/la persistance) : passé en prop tel quel.
 */
import React from 'react';
import { AlertRecord, UserProfile, TaskPriority } from '../../types';

interface AddTaskModalProps {
  t: Record<string, string>;
  selectedAlert: AlertRecord;
  investigatorUsers: UserProfile[];
  taskTitle: string;
  setTaskTitle: (v: string) => void;
  taskDescription: string;
  setTaskDescription: (v: string) => void;
  taskOwnerId: string;
  setTaskOwnerId: (v: string) => void;
  taskDueDate: string;
  setTaskDueDate: (v: string) => void;
  taskPriority: TaskPriority;
  setTaskPriority: (v: TaskPriority) => void;
  setShowAddTaskModal: (v: boolean) => void;
  handleAddTask: (e: React.FormEvent) => void;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  t,
  selectedAlert,
  investigatorUsers,
  taskTitle,
  setTaskTitle,
  taskDescription,
  setTaskDescription,
  taskOwnerId,
  setTaskOwnerId,
  taskDueDate,
  setTaskDueDate,
  taskPriority,
  setTaskPriority,
  setShowAddTaskModal,
  handleAddTask,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">{t.btn_add_task}</h3>
          <p className="text-slate-500 text-[11px] mt-0.5">{selectedAlert.trackingNumber}</p>
        </div>

        <form onSubmit={handleAddTask} className="space-y-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.task_title_label} *</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.task_description_label}</label>
            <textarea
              rows={2}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.task_owner_label} *</label>
              <select
                value={taskOwnerId}
                onChange={(e) => setTaskOwnerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                required
              >
                <option value="">—</option>
                {investigatorUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.task_due_date_label} *</label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t.task_priority_label}</label>
            {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Ajouter une
                tâche) === pills façon maquette au lieu d'un <select> —
                même état `taskPriority`, mêmes 3 valeurs réelles
                (TaskPriority), rien d'autre ne change. */}
            <div className="flex gap-1.5">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTaskPriority(p)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                    taskPriority === p ? 'bg-[#0B2545] text-white border-[#0B2545]' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {p === 'low' ? t.task_priority_low : p === 'medium' ? t.task_priority_medium : t.task_priority_high}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setShowAddTaskModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
              {t.btn_cancel}
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {t.btn_add_task}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
