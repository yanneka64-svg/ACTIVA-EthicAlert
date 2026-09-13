/**
 * === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
 *
 * Nouvel écran transverse "Tâches" (mockup: groupe INVESTIGATION). La
 * maquette demande un écran dédié listant les tâches de TOUS les dossiers,
 * pas seulement celles d'un dossier ouvert — jusqu'ici les tâches
 * n'existaient que dans l'onglet "Tâches" interne à un dossier
 * (InvestigationDesk, resté inchangé). Cet écran ne fait qu'agréger les
 * `AlertRecord.tasks` déjà réels et persistés par `storage.ts` (aucune
 * donnée fabriquée) et renvoie vers le dossier concerné en un clic, via le
 * même mécanisme de lien profond `trackingNumber` déjà utilisé par le
 * Centre de Pilotage et la cloche de notifications.
 */
import React, { useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { Language, AlertRecord, UserProfile, CaseTask } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { DataTable, DataTableColumn } from './ui';

interface TasksRegistryProps {
  lang: Language;
  activeUser: UserProfile;
  onOpenCase: (trackingNumber: string) => void;
}

interface TaskRow {
  task: CaseTask;
  alert: AlertRecord;
}

const TASK_STATUS_STYLE: Record<CaseTask['status'], string> = {
  not_started: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-200',
};

export const TasksRegistry: React.FC<TasksRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const isGlobalViewer =
    activeUser.role === 'functional_admin' || activeUser.role === 'system_admin' || activeUser.role === 'auditor';
  const allUsers = storage.getUsers();
  const ownerName = (id: string) => allUsers.find((u) => u.id === id)?.name ?? id;

  const rows: TaskRow[] = alerts
    .filter((a) => isGlobalViewer || a.assignedInvestigators.includes(activeUser.id))
    .flatMap((alert) => (alert.tasks ?? []).map((task) => ({ task, alert })))
    .sort((a, b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime());

  const columns: DataTableColumn<TaskRow>[] = [
    {
      key: 'title',
      header: t.reg_col_title,
      render: (r) => <span className="font-semibold text-slate-900">{r.task.title}</span>,
    },
    {
      key: 'case',
      header: t.cp_col_case_id,
      render: (r) => <span className="font-mono text-[11px] text-slate-600">{r.alert.trackingNumber}</span>,
    },
    {
      key: 'owner',
      header: t.reg_col_owner,
      render: (r) => ownerName(r.task.owner),
      hideOnMobile: true,
    },
    {
      key: 'due',
      header: t.reg_col_due,
      render: (r) => new Date(r.task.dueDate).toLocaleDateString(lang),
    },
    {
      key: 'status',
      header: t.cp_col_status,
      render: (r) => (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${TASK_STATUS_STYLE[r.task.status]}`}>
          {r.task.status}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-blue-700" />
          {t.reg_tasks_title}
        </h2>
        <p className="text-xs text-slate-600 mt-1">{t.reg_tasks_subtitle}</p>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.task.id}
        onRowClick={(r) => onOpenCase(r.alert.trackingNumber)}
        emptyTitle={t.reg_tasks_empty}
      />
    </div>
  );
};
