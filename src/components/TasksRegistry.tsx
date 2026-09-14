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
 *
 * === AMÉLIORATION AJOUTÉE (Repère visuel — Tâches) ===
 * Ajout des onglets de filtre (Toutes/À faire/En cours/Terminées) et de la
 * colonne Priorité, façon maquette. Choix délibéré à signaler : le bouton
 * "+ Nouvelle tâche" de la maquette n'est PAS ajouté sur cet écran
 * transverse — créer une tâche exige de choisir un dossier, et ce
 * sélecteur n'existe nulle part ailleurs dans l'app ; la création réelle
 * reste accessible depuis l'onglet "Tâches" d'un dossier ouvert
 * (InvestigationDesk, inchangé), où elle fonctionne déjà pleinement.
 * Ajouter ici un bouton qui ouvrirait une modale non fonctionnelle aurait
 * été une fausse fonctionnalité (brief §32) — écarté plutôt que simulé.
 */
import React, { useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { Language, AlertRecord, UserProfile, CaseTask } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
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

const TASK_PRIORITY_STYLE: Record<CaseTask['priority'], string> = {
  low: 'text-slate-500',
  medium: 'text-amber-700',
  high: 'text-rose-700',
};

// === AMÉLIORATION AJOUTÉE (Repère visuel — Tâches) ===
// Les 4 statuts réels (not_started/in_progress/completed/overdue) se
// regroupent en 3 onglets façon maquette (À faire/En cours/Terminées) :
// "overdue" reste rangé sous "En cours" (une tâche en retard est toujours
// une tâche active, juste signalée visuellement par son badge de statut
// rouge dans le tableau) plutôt que d'inventer un 4e onglet absent de la
// maquette.
type TaskBucket = 'a_faire' | 'en_cours' | 'terminees';
const TASK_BUCKET_OF_STATUS: Record<CaseTask['status'], TaskBucket> = {
  not_started: 'a_faire',
  in_progress: 'en_cours',
  overdue: 'en_cours',
  completed: 'terminees',
};

export const TasksRegistry: React.FC<TasksRegistryProps> = ({ lang, activeUser, onOpenCase }) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Tâches) ===
  const [bucketFilter, setBucketFilter] = useState<TaskBucket | 'all'>('all');

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  // Remplace le filtre dupliqué (rôle assigné) par le hook partagé, qui
  // applique en plus le périmètre pays/entité et la confidentialité — voir
  // src/hooks/useVisibleAlerts.ts.
  const visibleAlerts = useVisibleAlerts(alerts, activeUser);
  const allUsers = storage.getUsers();
  const ownerName = (id: string) => allUsers.find((u) => u.id === id)?.name ?? id;

  const allRows: TaskRow[] = visibleAlerts
    .flatMap((alert) => (alert.tasks ?? []).map((task) => ({ task, alert })))
    .sort((a, b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime());

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Tâches) ===
  const bucketCounts: Record<TaskBucket | 'all', number> = {
    all: allRows.length,
    a_faire: allRows.filter((r) => TASK_BUCKET_OF_STATUS[r.task.status] === 'a_faire').length,
    en_cours: allRows.filter((r) => TASK_BUCKET_OF_STATUS[r.task.status] === 'en_cours').length,
    terminees: allRows.filter((r) => TASK_BUCKET_OF_STATUS[r.task.status] === 'terminees').length,
  };
  const rows = bucketFilter === 'all' ? allRows : allRows.filter((r) => TASK_BUCKET_OF_STATUS[r.task.status] === bucketFilter);

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
    // === AMÉLIORATION AJOUTÉE (Repère visuel — Tâches) ===
    {
      key: 'priority',
      header: t.reg_col_priority,
      render: (r) => (
        <span className={`text-[11px] font-bold uppercase ${TASK_PRIORITY_STYLE[r.task.priority]}`}>
          {r.task.priority === 'high' ? t.priority_tres_elevee : r.task.priority === 'medium' ? t.priority_elevee : t.priority_faible}
        </span>
      ),
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

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Tâches) === onglets de
          filtre façon maquette (Toutes/À faire/En cours/Terminées). */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {(
          [
            ['all', t.db_bucket_tous],
            ['a_faire', t.tasks_bucket_a_faire],
            ['en_cours', t.db_bucket_en_cours],
            ['terminees', t.tasks_bucket_terminees],
          ] as [TaskBucket | 'all', string][]
        ).map(([bucket, label]) => (
          <button
            key={bucket}
            onClick={() => setBucketFilter(bucket)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition border ${
              bucketFilter === bucket
                ? 'bg-[#0B2545] text-white border-[#0B2545]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
            }`}
          >
            {label} ({bucketCounts[bucket]})
          </button>
        ))}
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
