import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Inbox,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  ShieldAlert,
  ArrowRight,
  Search,
  Calendar,
  UserCheck,
  Building2,
  Paperclip,
} from 'lucide-react';
import { Language, AlertRecord, UserProfile } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
import { computeSlaStatus } from '../services/statusMapping';

interface InvestigatorDashboardProps {
  lang: Language;
  activeUser: UserProfile;
  onNavigateTab: (tab: string) => void;
  onOpenCase: (trackingNumber: string) => void;
}

export const InvestigatorDashboard: React.FC<InvestigatorDashboardProps> = ({
  lang,
  activeUser,
  onNavigateTab,
  onOpenCase,
}) => {
  const t = TRANSLATIONS[lang];
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());

  useEffect(() => {
    const unsub = storage.subscribe(() => setAlerts(storage.getAlerts()));
    return unsub;
  }, []);

  const visibleAlerts = useVisibleAlerts(alerts, activeUser);

  // Filter alerts assigned to this investigator (or all visible if supervisor/admin)
  const myAlerts = visibleAlerts.filter(
    (a) => a.assignedInvestigators.includes(activeUser.id) || activeUser.role === 'functional_admin'
  );

  // Investigator KPI counts
  const inboxQuotedAlerts = myAlerts.filter((a) => a.status === 'new' || a.status === 'investigation');
  const toProcessAlerts = myAlerts.filter((a) => a.status === 'new');
  const inProgressAlerts = myAlerts.filter((a) => a.status === 'investigation');
  const pendingInfoAlerts = myAlerts.filter((a) => a.status === 'under_review');
  const closedAlerts = myAlerts.filter((a) => a.status === 'closed');
  const overdueAlerts = myAlerts.filter((a) => computeSlaStatus(a) === 'overdue' && a.status !== 'closed');
  const urgentNocaAlerts = myAlerts.filter((a) => a.riskEvaluation.nocaThreshold === 'NOCA 3' || a.riskEvaluation.nocaThreshold === 'NOCA 4');

  // Collect tasks from assigned alerts
  const allTasks = myAlerts.flatMap((a) =>
    (a.tasks ?? []).map((tsk) => ({
      ...tsk,
      caseNumber: a.trackingNumber,
      caseTitle: a.detailedDescription,
    }))
  );
  const openTasks = allTasks.filter((t) => t.status !== 'completed');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-5 h-5 text-teal-700" />
              <h1 className="text-xl font-bold text-slate-900">
                Tableau de bord — Espace Enquêteur
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Pilotage des dossiers cotés et assignés à <strong>{activeUser.name}</strong> ({activeUser.roleTitle})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('inv_inbox')}
              className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Inbox className="w-4 h-4" />
              <span>Boîte de réception (Dossiers cotés)</span>
            </button>
            <button
              onClick={() => onNavigateTab('inv_my_cases')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4 text-slate-500" />
              <span>Tous mes dossiers</span>
            </button>
          </div>
        </div>

        {/* 4 Interactive KPI Cards for Investigator */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Card 1: Dossiers cotés */}
          <div
            onClick={() => onNavigateTab('inv_inbox')}
            className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 hover:border-teal-400 cursor-pointer transition group shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Dossiers cotés reçus</span>
              <Inbox className="w-4 h-4 text-teal-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-2xl font-black text-teal-900 mt-2">{myAlerts.length}</div>
            <div className="text-[11px] text-teal-600 mt-1 flex items-center gap-1">
              <span>{inboxQuotedAlerts.length} actifs à traiter</span>
              <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>

          {/* Card 2: En cours d'investigation */}
          <div
            onClick={() => onNavigateTab('inv_in_progress')}
            className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 hover:border-blue-400 cursor-pointer transition group shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">En cours d'enquête</span>
              <Clock3 className="w-4 h-4 text-blue-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-2xl font-black text-blue-900 mt-2">{inProgressAlerts.length}</div>
            <div className="text-[11px] text-blue-600 mt-1 flex items-center gap-1">
              <span>Auditions & preuves en recueil</span>
              <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>

          {/* Card 3: En attente d'infos */}
          <div
            onClick={() => onNavigateTab('inv_pending')}
            className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 hover:border-amber-400 cursor-pointer transition group shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">En attente d'éléments</span>
              <AlertTriangle className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-2">{pendingInfoAlerts.length}</div>
            <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
              <span>Attente de retour lanceur / tiers</span>
              <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>

          {/* Card 4: Tâches d'enquête */}
          <div
            onClick={() => onNavigateTab('tasks')}
            className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 hover:border-purple-400 cursor-pointer transition group shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Tâches ouvertes</span>
              <ListTodo className="w-4 h-4 text-purple-600 group-hover:scale-110 transition" />
            </div>
            <div className="text-2xl font-black text-purple-900 mt-2">{openTasks.length}</div>
            <div className="text-[11px] text-purple-600 mt-1 flex items-center gap-1">
              <span>{allTasks.length} total enregistrées</span>
              <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Mes dossiers cotés prioritaires */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mes Dossiers Cotés Récents</h3>
                <p className="text-xs text-slate-500">Dossiers d'investigation assignés nécessitant des actions</p>
              </div>
              <button
                onClick={() => onNavigateTab('inv_my_cases')}
                className="text-xs font-bold text-teal-700 hover:underline"
              >
                Voir tout ({myAlerts.length}) →
              </button>
            </div>

            {myAlerts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Aucun dossier n'est actuellement coté à votre nom.
              </div>
            ) : (
              <div className="space-y-2.5">
                {myAlerts.slice(0, 5).map((alert) => {
                  const isLate = computeSlaStatus(alert) === 'overdue';
                  return (
                    <div
                      key={alert.id}
                      onClick={() => onOpenCase(alert.trackingNumber)}
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-teal-400 hover:bg-teal-50/20 cursor-pointer transition flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-[#0B2545]">
                            {alert.trackingNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {alert.category}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {alert.country}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 truncate max-w-lg">
                          {alert.detailedDescription}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isLate && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            SLA dépassé
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {alert.status === 'new'
                            ? 'À traiter'
                            : alert.status === 'investigation'
                            ? 'En cours'
                            : alert.status === 'under_review'
                            ? 'En attente'
                            : 'Clôturé'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Shortcuts Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigateTab('tasks')}
              className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 text-left transition shadow-sm"
            >
              <ListTodo className="w-4 h-4 text-teal-600 mb-1.5" />
              <div className="text-xs font-bold text-slate-800">Gérer mes tâches</div>
              <div className="text-[11px] text-slate-500">Créer et valider les étapes d'audition</div>
            </button>

            <button
              onClick={() => onNavigateTab('evidence')}
              className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 text-left transition shadow-sm"
            >
              <Paperclip className="w-4 h-4 text-blue-600 mb-1.5" />
              <div className="text-xs font-bold text-slate-800">Pièces & Preuves</div>
              <div className="text-[11px] text-slate-500">Explorer les fichiers et pièces jointes</div>
            </button>

            <button
              onClick={() => onNavigateTab('communications')}
              className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-400 text-left transition shadow-sm"
            >
              <Inbox className="w-4 h-4 text-purple-600 mb-1.5" />
              <div className="text-xs font-bold text-slate-800">Communications</div>
              <div className="text-[11px] text-slate-500">Échanges avec les lanceurs d'alerte</div>
            </button>
          </div>
        </div>

        {/* Right 1 col: Répartition & Vigilance */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">État d'avancement des enquêtes</h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1 text-slate-600">
                  <span>À instruire</span>
                  <span>{toProcessAlerts.length}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-teal-500"
                    style={{
                      width: `${myAlerts.length ? (toProcessAlerts.length / myAlerts.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1 text-slate-600">
                  <span>En cours d'investigation</span>
                  <span>{inProgressAlerts.length}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${myAlerts.length ? (inProgressAlerts.length / myAlerts.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1 text-slate-600">
                  <span>En attente d'éléments</span>
                  <span>{pendingInfoAlerts.length}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{
                      width: `${myAlerts.length ? (pendingInfoAlerts.length / myAlerts.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold mb-1 text-slate-600">
                  <span>Clôturés / Rapport remis</span>
                  <span>{closedAlerts.length}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${myAlerts.length ? (closedAlerts.length / myAlerts.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SLA & Critical alerts alert box */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Vigilance & Risque</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                <span className="text-slate-600">Dossiers prioritaires (NOCA 3/4)</span>
                <span className="font-bold text-rose-700">{urgentNocaAlerts.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                <span className="text-slate-600">Échéances SLA dépassées</span>
                <span className="font-bold text-amber-700">{overdueAlerts.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
