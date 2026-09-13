import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  Building2, 
  UserCheck, 
  Clock, 
  MessageSquare, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  UserPlus, 
  Calendar, 
  FolderArchive, 
  RotateCcw, 
  Plus, 
  Send, 
  Lock, 
  FileCheck2,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { 
  Language, 
  AlertRecord, 
  UserProfile, 
  PriorityLevel, 
  InternalNote, 
  CaseMessage, 
  CorrectiveMeasure,
  AlertStatus
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ACTIVA_ENTITIES } from '../data/activaConfig';
import { storage } from '../services/storage';
import { PriorityBadge } from './ui';
import { computeSlaStatus } from '../services/statusMapping';

interface InvestigationDeskProps {
  lang: Language;
  activeUser: UserProfile;
  // === AMÉLIORATION AJOUTÉE (Phase 5) ===
  // Lets a caller (the Control Panel's KPI cards / quick actions) land here
  // pre-filtered, per the brief's "Dashboard KPIs must link to filtered
  // case lists" requirement (§61). Read once at mount via the useState
  // initializers below — consistent with how this screen already resets
  // on every tab switch (App.tsx unmounts/remounts it, it is never kept
  // alive across tabs), so a fresh `initialFilter` is picked up correctly
  // every time the user navigates in from the Control Panel.
  initialFilter?: { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean };
}

export const InvestigationDesk: React.FC<InvestigationDeskProps> = ({
  lang,
  activeUser,
  initialFilter,
}) => {
  const t = TRANSLATIONS[lang];

  // Live storage sync
  const [alerts, setAlerts] = useState<AlertRecord[]>(storage.getAlerts());
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter?.status ?? 'all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [nocaFilter, setNocaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // === AMÉLIORATION AJOUTÉE (Phase 5) ===
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useState<boolean>(!!initialFilter?.unassignedOnly);
  const [overdueOnlyFilter, setOverdueOnlyFilter] = useState<boolean>(!!initialFilter?.overdueOnly);

  // Selected case active tab: 'overview' | 'investigation' | 'messages' | 'corrective'
  const [activeCaseTab, setActiveCaseTab] = useState<'overview' | 'investigation' | 'messages' | 'corrective'>('overview');

  // Interactive modal / action states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedInvestigatorIds, setSelectedInvestigatorIds] = useState<string[]>([]);
  
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [newPriority, setNewPriority] = useState<PriorityLevel>('elevee');
  const [newSlaDays, setNewSlaDays] = useState<number>(15);
  const [priorityOverrideReason, setPriorityOverrideReason] = useState<string>('');

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closureSummary, setClosureSummary] = useState<string>('');
  const [closureMessageToWb, setClosureMessageToWb] = useState<string>('');

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState<string>('');

  // Note & Message inputs
  const [internalNoteText, setInternalNoteText] = useState<string>('');
  const [investigatorMsgText, setInvestigatorMsgText] = useState<string>('');

  // Corrective Measure form inputs
  const [showAddMeasureModal, setShowAddMeasureModal] = useState(false);
  const [measureTitle, setMeasureTitle] = useState('');
  const [measureDesc, setMeasureDesc] = useState('');
  const [measureResp, setMeasureResp] = useState('');
  const [measureDueDate, setMeasureDueDate] = useState('');
  const [measureStatus, setMeasureStatus] = useState<CorrectiveMeasure['status']>('planned');

  // Subscribe to storage updates
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setAlerts(storage.getAlerts());
    });
    return unsub;
  }, []);

  const allUsers = storage.getUsers();
  const investigatorUsers = allUsers.filter(u => u.role === 'investigator' || u.role === 'functional_admin');

  // Role visibility logic (CDC 3.1.4):
  // "Chaque gestionnaire n'aura de la visibilité que sur les alertes qui lui sont attribuées.
  // Seul l'administrateur aura une vue sur toutes les alertes enregistrées dans le système."
  const isGlobalViewer = activeUser.role === 'functional_admin' || activeUser.role === 'system_admin' || activeUser.role === 'auditor';

  const visibleAlerts = alerts.filter(alert => {
    // Role filter
    if (!isGlobalViewer) {
      const isAssigned = alert.assignedInvestigators.includes(activeUser.id);
      if (!isAssigned) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;

    // Entity filter
    if (entityFilter !== 'all' && alert.concernedEntity !== entityFilter) return false;

    // NOCA filter
    if (nocaFilter !== 'all' && alert.riskEvaluation.nocaThreshold !== nocaFilter) return false;

    // === AMÉLIORATION AJOUTÉE (Phase 5) === Control-Panel-driven filters
    if (unassignedOnlyFilter && alert.assignedInvestigators.length > 0) return false;
    if (overdueOnlyFilter && computeSlaStatus(alert) !== 'overdue') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = alert.trackingNumber.toLowerCase().includes(q);
      const matchCat = alert.category.toLowerCase().includes(q);
      const matchEntity = alert.concernedEntity.toLowerCase().includes(q);
      const matchDesc = alert.detailedDescription.toLowerCase().includes(q);
      if (!matchNum && !matchCat && !matchEntity && !matchDesc) return false;
    }

    return true;
  });

  // Currently active selected alert
  const selectedAlert = alerts.find(a => a.id === selectedAlertId) || visibleAlerts[0] || null;

  // Handlers
  const handleAssignInvestigators = () => {
    if (!selectedAlert) return;

    const assignedNames = investigatorUsers
      .filter(u => selectedInvestigatorIds.includes(u.id))
      .map(u => u.name);

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      assignedInvestigators: selectedInvestigatorIds,
      assignedInvestigatorNames: assignedNames,
      status: selectedAlert.status === 'new' ? 'investigation' : selectedAlert.status,
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'INVESTIGATOR_ASSIGNED',
      `Attribution du dossier ${selectedAlert.trackingNumber} à : ${assignedNames.join(', ') || 'Aucun'}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setShowAssignModal(false);
  };

  const handleUpdatePriority = () => {
    if (!selectedAlert) return;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + newSlaDays);

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      overridePriority: newPriority,
      overrideReason: priorityOverrideReason.trim() || undefined,
      targetCompletionDate: targetDate.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'PRIORITY_MODIFIED',
      `Priorité du dossier ${selectedAlert.trackingNumber} ajustée à ${newPriority.toUpperCase()} (Délai : ${newSlaDays}j). Motif : ${priorityOverrideReason || 'Ajustement DARC'}`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setShowPriorityModal(false);
  };

  const handleAddInternalNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalNoteText.trim() || !selectedAlert) return;

    const newNote: InternalNote = {
      id: 'not-' + Date.now(),
      authorId: activeUser.id,
      authorName: activeUser.name,
      authorRole: activeUser.roleTitle,
      content: internalNoteText.trim(),
      createdAt: new Date().toISOString(),
      isPrivate: true,
    };

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      internalNotes: [...selectedAlert.internalNotes, newNote],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'INTERNAL_NOTE_ADDED',
      `Note interne d'investigation ajoutée sur ${selectedAlert.trackingNumber} par ${activeUser.name}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setInternalNoteText('');
  };

  const handleSendInvestigatorMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!investigatorMsgText.trim() || !selectedAlert) return;

    const newMsg: CaseMessage = {
      id: 'msg-' + Date.now(),
      sender: 'investigator',
      senderDisplayName: `DARC (${activeUser.name})`,
      content: investigatorMsgText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      messages: [...selectedAlert.messages, newMsg],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'MESSAGE_SENT',
      `Message sécurisé transmis au lanceur d'alerte pour le dossier ${selectedAlert.trackingNumber}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setInvestigatorMsgText('');
  };

  const handleAddCorrectiveMeasure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!measureTitle.trim() || !selectedAlert) return;

    const newMeasure: CorrectiveMeasure = {
      id: 'cm-' + Date.now(),
      title: measureTitle.trim(),
      description: measureDesc.trim(),
      responsiblePerson: measureResp.trim() || 'Direction Concernée',
      dueDate: measureDueDate || new Date().toISOString().split('T')[0],
      status: measureStatus,
      documentedBy: activeUser.name,
      documentedAt: new Date().toISOString(),
    };

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      correctiveMeasures: [...selectedAlert.correctiveMeasures, newMeasure],
      status: selectedAlert.status === 'investigation' ? 'corrective_action' : selectedAlert.status,
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'CORRECTIVE_MEASURE_ADDED',
      `Mesure corrective documentée sur ${selectedAlert.trackingNumber} : "${newMeasure.title}".`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setMeasureTitle('');
    setMeasureDesc('');
    setMeasureResp('');
    setShowAddMeasureModal(false);
  };

  // Close Alert (CDC 3.1.3: Vérifier complétude, clôturer, informer le lanceur)
  const handleCloseAlert = () => {
    if (!selectedAlert) return;

    if (selectedAlert.correctiveMeasures.length === 0) {
      alert("Conformément au CDC 3.1.2 et 3.1.3, la documentation préalable d'au moins une mesure corrective est obligatoire avant toute clôture de dossier.");
      setActiveCaseTab('corrective');
      setShowCloseModal(false);
      return;
    }

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      status: 'closed',
      closedAt: new Date().toISOString(),
      closedBy: activeUser.name,
      closureSummary: closureSummary.trim() || 'Dossier traité et investigué avec succès conformément aux directives de la DARC Groupe ACTIVA.',
      closureMessageToWhistleblower: closureMessageToWb.trim() || 'L\'investigation relative à votre signalement est désormais menée à son terme. Toutes les mesures conservatoires et correctives requises ont été engagées. Nous vous remercions pour votre démarche civique garantissant l\'intégrité du Groupe ACTIVA.',
      messages: [
        ...selectedAlert.messages,
        {
          id: 'msg-close-' + Date.now(),
          sender: 'admin',
          senderDisplayName: 'DARC Groupe ACTIVA (Clôture formelle)',
          content: closureMessageToWb.trim() || 'L\'investigation relative à votre signalement est désormais menée à son terme. Toutes les mesures conservatoires et correctives requises ont été engagées. Votre anonymat demeure garanti.',
          createdAt: new Date().toISOString(),
        }
      ],
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_CLOSED',
      `Clôture formelle du dossier ${selectedAlert.trackingNumber} par ${activeUser.name}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setShowCloseModal(false);
  };

  // Reopen Alert (CDC 3.1.3: Rouvrir avec motif obligatoire)
  const handleReopenAlert = () => {
    if (!selectedAlert || !reopenReason.trim()) return;

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      status: 'reopened',
      reopenedAt: new Date().toISOString(),
      reopenedBy: activeUser.name,
      reopenReason: reopenReason.trim(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_REOPENED',
      `Réouverture du dossier ${selectedAlert.trackingNumber} par ${activeUser.name}. Motif obligatoire : "${reopenReason.trim()}".`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );

    setShowReopenModal(false);
    setReopenReason('');
  };

  // Archive Alert (CDC 3.1.3)
  const handleArchiveAlert = () => {
    if (!selectedAlert) return;

    const updatedAlert: AlertRecord = {
      ...selectedAlert,
      status: 'archived',
      updatedAt: new Date().toISOString(),
    };

    storage.saveAlert(updatedAlert);
    storage.logAudit(
      'ALERT_ARCHIVED',
      `Archivage légal du dossier ${selectedAlert.trackingNumber} (durée de conservation : 10 ans).`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );
  };

  // === AMÉLIORATION AJOUTÉE (Phase 0) === delegates to the shared PriorityBadge
  // primitive (src/components/ui) instead of a locally-duplicated switch —
  // same colors/text as before, verified to render identically.
  const getPriorityBadge = (alert: AlertRecord) => {
    const p = alert.overridePriority || alert.riskEvaluation.priority;
    const labels: Record<typeof p, string> = {
      critique: 'CRITIQUE (48h)',
      tres_elevee: 'TRÈS ÉLEVÉE (7j)',
      elevee: 'ÉLEVÉE (15j)',
      faible: 'FAIBLE (30j)',
    };
    return <PriorityBadge priority={p} label={labels[p]} />;
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Banner with Desk metrics */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-blue-700" />
              <h2 className="text-xl font-bold text-slate-900">
                {t.portal_title}
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              {isGlobalViewer 
                ? 'Vue Groupe ACTIVA complète (DARC & Point de Contact)' 
                : `Vue Gestionnaire restreinte à vos dossiers attribués (${activeUser.name})`}
            </p>
          </div>

          {/* User role info tag */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900 block">{activeUser.name}</span>
              <span className="text-[11px] text-slate-500">{activeUser.roleTitle}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-800 font-bold text-xs">
              {activeUser.name.charAt(0)}
            </div>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xl font-extrabold text-[#0B2545]">{alerts.length}</div>
            <div className="text-[11px] text-slate-500">{t.portal_total_alerts}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="text-xl font-extrabold text-blue-800">
              {alerts.filter(a => a.status === 'new' || a.status === 'investigation').length}
            </div>
            <div className="text-[11px] text-blue-700">{t.portal_pending}</div>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <div className="text-xl font-extrabold text-rose-800">
              {alerts.filter(a => a.riskEvaluation.nocaThreshold === 'NOCA 3' || a.riskEvaluation.nocaThreshold === 'NOCA 4').length}
            </div>
            <div className="text-[11px] text-rose-700">{t.portal_urgent}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="text-xl font-extrabold text-emerald-800">
              {alerts.length > 0 ? Math.round((alerts.filter(a => a.status === 'closed').length / alerts.length) * 100) : 0}%
            </div>
            <div className="text-[11px] text-emerald-700">{t.portal_closed_rate}</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search_placeholder}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
        >
          <option value="all">Tous les statuts</option>
          <option value="new">Nouveaux</option>
          <option value="investigation">En investigation</option>
          <option value="corrective_action">Mesures correctives</option>
          <option value="closed">Clôturés</option>
          <option value="reopened">Rouverts</option>
          <option value="archived">Archivés</option>
        </select>

        {/* Entity Filter */}
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
        >
          <option value="all">Toutes les entités ACTIVA</option>
          {ACTIVA_ENTITIES.map(e => (
            <option key={e.id} value={e.name}>{e.flag} {e.name}</option>
          ))}
        </select>

        {/* NOCA Criticality filter */}
        <select
          value={nocaFilter}
          onChange={(e) => setNocaFilter(e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700"
        >
          <option value="all">Toutes criticités NOCA</option>
          <option value="NOCA 4">NOCA 4 (Critique - 48h)</option>
          <option value="NOCA 3">NOCA 3 (Très élevé - 7j)</option>
          <option value="NOCA 2">NOCA 2 (Élevée - 15j)</option>
          <option value="NOCA 1">NOCA 1 (Faible - 30j)</option>
        </select>

        {/* === AMÉLIORATION AJOUTÉE (Phase 5) === Control-Panel-driven filters */}
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 cursor-pointer">
          <input type="checkbox" checked={unassignedOnlyFilter} onChange={(e) => setUnassignedOnlyFilter(e.target.checked)} className="accent-blue-600" />
          Non attribués uniquement
        </label>
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 cursor-pointer">
          <input type="checkbox" checked={overdueOnlyFilter} onChange={(e) => setOverdueOnlyFilter(e.target.checked)} className="accent-rose-600" />
          En retard uniquement
        </label>

        {(statusFilter !== 'all' || entityFilter !== 'all' || nocaFilter !== 'all' || searchQuery || unassignedOnlyFilter || overdueOnlyFilter) && (
          <button
            onClick={() => {
              setStatusFilter('all');
              setEntityFilter('all');
              setNocaFilter('all');
              setSearchQuery('');
              setUnassignedOnlyFilter(false);
              setOverdueOnlyFilter(false);
            }}
            className="text-blue-700 hover:underline font-semibold"
          >
            Réinitialiser filtres
          </button>
        )}
      </div>

      {/* Main split view: Left list of cases, Right deep investigation workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cases List */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider">
              Dossiers ({visibleAlerts.length})
            </span>
            <span className="text-[11px] text-slate-500">
              {isGlobalViewer ? 'Toutes filiales' : 'Assignés'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {visibleAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucun dossier ne correspond à vos critères de filtrage.
              </div>
            ) : (
              visibleAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      setSelectedAlertId(alert.id);
                      storage.logAudit(
                        'ALERT_ACCESSED',
                        `Consultation de la fiche dossier ${alert.trackingNumber} par ${activeUser.name}.`,
                        { id: alert.id, trackingNumber: alert.trackingNumber },
                        activeUser
                      );
                    }}
                    className={`p-4 cursor-pointer transition ${
                      isSelected 
                        ? 'bg-blue-50/70 border-l-4 border-l-blue-600' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">
                        {alert.trackingNumber}
                      </span>
                      {getPriorityBadge(alert)}
                    </div>

                    <div className="font-semibold text-xs text-slate-900 line-clamp-1 mb-1">
                      {alert.category}
                    </div>

                    <div className="text-[11px] text-slate-600 line-clamp-2 mb-2">
                      {alert.detailedDescription}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1 font-medium text-slate-700 truncate max-w-[160px]">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {alert.concernedEntity}
                      </span>

                      <div className="flex items-center gap-2">
                        {alert.messages.length > 0 && (
                          <span className="flex items-center gap-0.5 text-blue-600 font-semibold">
                            <MessageSquare className="w-3 h-3" />
                            {alert.messages.length}
                          </span>
                        )}
                        <span className={`font-semibold ${
                          alert.status === 'closed' ? 'text-emerald-700' : 'text-slate-600'
                        }`}>
                          {alert.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Case Detail & Investigation Workspace */}
        {selectedAlert ? (
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header with Case Info and Management Controls */}
            <div className="p-6 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-extrabold text-[#0B2545]">
                      {selectedAlert.trackingNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedAlert.riskEvaluation.nocaThreshold === 'NOCA 4'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : selectedAlert.riskEvaluation.nocaThreshold === 'NOCA 3'
                        ? 'bg-orange-100 text-orange-900 border border-orange-300'
                        : selectedAlert.riskEvaluation.nocaThreshold === 'NOCA 2'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-800 border border-slate-300'
                    }`}>
                      {selectedAlert.riskEvaluation.nocaThreshold} - {selectedAlert.riskEvaluation.expectedTreatment}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {selectedAlert.category} • <span className="font-medium text-slate-800">{selectedAlert.subCategory}</span>
                  </p>
                </div>

                {/* Status indicator */}
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Statut du dossier</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    selectedAlert.status === 'closed'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : selectedAlert.status === 'investigation'
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : selectedAlert.status === 'reopened'
                      ? 'bg-rose-100 text-rose-900 border border-rose-300'
                      : 'bg-blue-100 text-blue-900 border border-blue-300'
                  }`}>
                    {selectedAlert.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* ACTION TOOLBAR (CDC 3.1.2 & 3.1.3: Attribution, Priorité, Clôture, Réouverture) */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
                {/* Attribution (Point de contact / Functional Admin only) */}
                {(activeUser.role === 'functional_admin' || activeUser.role === 'system_admin') && (
                  <button
                    id="btn-desk-assign"
                    onClick={() => {
                      setSelectedInvestigatorIds(selectedAlert.assignedInvestigators);
                      setShowAssignModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-xs transition"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t.btn_assign_investigator}</span>
                  </button>
                )}

                {/* Priority & Turnaround SLA modification (Point de contact) */}
                {(activeUser.role === 'functional_admin' || activeUser.role === 'system_admin') && (
                  <button
                    id="btn-desk-priority"
                    onClick={() => {
                      setNewPriority(selectedAlert.overridePriority || selectedAlert.riskEvaluation.priority);
                      setShowPriorityModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-xs transition"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                    <span>{t.btn_change_priority}</span>
                  </button>
                )}

                {/* Close Case */}
                {selectedAlert.status !== 'closed' && selectedAlert.status !== 'archived' && (
                  <button
                    id="btn-desk-close"
                    onClick={() => setShowCloseModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.btn_close_case}</span>
                  </button>
                )}

                {/* Reopen Case (with mandatory reason) */}
                {selectedAlert.status === 'closed' && (
                  <button
                    id="btn-desk-reopen"
                    onClick={() => setShowReopenModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-300 hover:bg-rose-100 text-rose-800 text-xs font-bold shadow-xs transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.btn_reopen_case}</span>
                  </button>
                )}

                {/* Archive Case */}
                {selectedAlert.status === 'closed' && (
                  <button
                    onClick={handleArchiveAlert}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>{t.btn_archive_case}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Case Tabs: Overview, Investigation notes, Messages, Corrective measures */}
            <div className="flex border-b border-slate-200 px-6 text-xs font-semibold">
              <button
                onClick={() => setActiveCaseTab('overview')}
                className={`py-3 px-4 border-b-2 transition ${
                  activeCaseTab === 'overview'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.tab_overview}
              </button>
              <button
                onClick={() => setActiveCaseTab('investigation')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeCaseTab === 'investigation'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.tab_investigation}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                  {selectedAlert.internalNotes.length}
                </span>
              </button>
              <button
                onClick={() => setActiveCaseTab('messages')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeCaseTab === 'messages'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.tab_messages}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                  {selectedAlert.messages.length}
                </span>
              </button>
              <button
                onClick={() => setActiveCaseTab('corrective')}
                className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 ${
                  activeCaseTab === 'corrective'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.tab_corrective}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedAlert.correctiveMeasures.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {selectedAlert.correctiveMeasures.length}
                </span>
              </button>
            </div>

            {/* TAB CONTENT: 1. OVERVIEW */}
            {activeCaseTab === 'overview' && (
              <div className="p-6 space-y-6 max-h-[560px] overflow-y-auto text-xs">
                {/* Whistleblower info block */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                    Origine du signalement
                  </div>
                  {selectedAlert.whistleblower.isAnonymous ? (
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <Lock className="w-4 h-4" />
                      <span>Signalement Anonyme - Aucune coordonnée transmise</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div><span className="text-slate-500">Nom :</span> {selectedAlert.whistleblower.fullName}</div>
                      <div><span className="text-slate-500">Qualité :</span> {selectedAlert.whistleblower.declarantType}</div>
                      <div><span className="text-slate-500">Poste :</span> {selectedAlert.whistleblower.jobTitle || 'Non renseigné'}</div>
                      <div><span className="text-slate-500">Email :</span> {selectedAlert.whistleblower.email}</div>
                    </div>
                  )}
                </div>

                {/* Assigned investigators list */}
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                  <div className="font-bold text-blue-900 uppercase tracking-wider text-[11px] mb-1">
                    Gestionnaires / Investigateurs DARC assignés
                  </div>
                  {selectedAlert.assignedInvestigatorNames.length === 0 ? (
                    <span className="text-slate-500 italic">Aucun enquêteur assigné pour le moment.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedAlert.assignedInvestigatorNames.map((name, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-md bg-white text-blue-900 font-semibold text-xs border border-blue-200 shadow-xs">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description of facts */}
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1">
                    Description détaillée des faits constatés
                  </h4>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 leading-relaxed text-slate-800 whitespace-pre-wrap">
                    {selectedAlert.detailedDescription}
                  </div>
                </div>

                {/* Implicated & Witnesses tables */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200">
                    <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                      Personnes impliquées ({selectedAlert.involvedPersons.length})
                    </h5>
                    {selectedAlert.involvedPersons.length === 0 ? (
                      <p className="text-slate-400 italic">Non spécifié</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedAlert.involvedPersons.map((p) => (
                          <div key={p.id} className="p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="font-bold text-slate-900">{p.name || 'Anonyme'}</span>
                            <div className="text-[11px] text-slate-500">{p.position} • {p.hierarchyRole}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200">
                    <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                      Témoins ({selectedAlert.witnesses.length})
                    </h5>
                    {selectedAlert.witnesses.length === 0 ? (
                      <p className="text-slate-400 italic">Aucun témoin renseigné</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedAlert.witnesses.map((w) => (
                          <div key={w.id} className="p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="font-bold text-slate-900">{w.name || 'Témoin'}</span>
                            <div className="text-[11px] text-slate-500">{w.position} • {w.hierarchyRole}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidences list */}
                <div className="p-4 rounded-xl border border-slate-200">
                  <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                    Preuves & Pièces jointes ({selectedAlert.evidences.length})
                  </h5>
                  {selectedAlert.evidences.length === 0 ? (
                    <p className="text-slate-400 italic">Aucun document joint</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedAlert.evidences.map((ev) => (
                        <div key={ev.id} className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <span className="font-medium text-slate-800">{ev.name}</span>
                          <span className="text-[10px] text-slate-400">({Math.round(ev.size / 1024)} Ko)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. INVESTIGATION & INTERNAL NOTES */}
            {activeCaseTab === 'investigation' && (
              <div className="p-6 space-y-6 max-h-[560px] overflow-y-auto text-xs">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Ces notes sont strictement confidentielles et ne sont JAMAIS visibles par le lanceur d'alerte.</span>
                </div>

                {/* Add internal note form */}
                <form onSubmit={handleAddInternalNote} className="space-y-3">
                  <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Ajouter une note d'investigation interne
                  </label>
                  <textarea
                    rows={3}
                    value={internalNoteText}
                    onChange={(e) => setInternalNoteText(e.target.value)}
                    placeholder="Consignez les résultats d'entretiens, vérifications comptables, constats informatiques..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!internalNoteText.trim()}
                      className="px-4 py-2 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white font-bold transition"
                    >
                      Enregistrer la note
                    </button>
                  </div>
                </form>

                {/* Internal notes list */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <h5 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Historique des notes internes ({selectedAlert.internalNotes.length})
                  </h5>
                  {selectedAlert.internalNotes.length === 0 ? (
                    <p className="text-slate-400 italic">Aucune note enregistrée.</p>
                  ) : (
                    selectedAlert.internalNotes.map((note) => (
                      <div key={note.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#0B2545]">{note.authorName} ({note.authorRole})</span>
                          <span className="text-slate-400">{new Date(note.createdAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}</span>
                        </div>
                        <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. COMMUNICATION WITH WHISTLEBLOWER */}
            {activeCaseTab === 'messages' && (
              <div className="p-6 flex flex-col h-[560px] text-xs">
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Canal d'échange sécurisé avec le lanceur d'alerte
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    Le déclarant consulte ces messages en se connectant avec sa référence et son mot de passe.
                  </p>
                </div>

                {/* Messages list */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                  {selectedAlert.messages.map((m) => {
                    const isWb = m.sender === 'whistleblower';
                    return (
                      <div key={m.id} className={`flex flex-col ${isWb ? 'items-start' : 'items-end'}`}>
                        <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                          <span className="font-semibold text-slate-700">{m.senderDisplayName}</span>
                          <span>•</span>
                          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`max-w-md p-3.5 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                          isWb 
                            ? 'bg-amber-50 text-amber-950 border border-amber-200 rounded-tl-none' 
                            : 'bg-blue-600 text-white rounded-tr-none'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Message input */}
                <form onSubmit={handleSendInvestigatorMessage} className="pt-3 border-t border-slate-100 flex gap-2">
                  <input
                    type="text"
                    value={investigatorMsgText}
                    onChange={(e) => setInvestigatorMsgText(e.target.value)}
                    placeholder="Demander des compléments d'informations au déclarant..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!investigatorMsgText.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold flex items-center gap-1.5"
                  >
                    <span>Envoyer</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: 4. CORRECTIVE MEASURES (MANDATORY BEFORE CLOSURE - CDC 3.1.2) */}
            {activeCaseTab === 'corrective' && (
              <div className="p-6 space-y-6 max-h-[560px] overflow-y-auto text-xs">
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950">
                  <h4 className="font-bold uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-indigo-700" />
                    Mesures correctives & disciplinaires
                  </h4>
                  <p className="text-[11px] text-indigo-800">
                    {t.corrective_required_note}
                  </p>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Mesures enregistrées ({selectedAlert.correctiveMeasures.length})
                  </span>
                  <button
                    id="btn-add-measure-trigger"
                    onClick={() => setShowAddMeasureModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.btn_add_measure}</span>
                  </button>
                </div>

                {selectedAlert.correctiveMeasures.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                    Aucune mesure corrective documentée pour l'instant. Vous devez en formaliser au moins une pour clôturer le dossier.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedAlert.correctiveMeasures.map((cm) => (
                      <div key={cm.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{cm.title}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cm.status === 'implemented' || cm.status === 'verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {cm.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{cm.description}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                          <div><strong className="text-slate-700">Responsable :</strong> {cm.responsiblePerson}</div>
                          <div><strong className="text-slate-700">Échéance :</strong> {cm.dueDate}</div>
                          <div><strong className="text-slate-700">Documenté par :</strong> {cm.documentedBy}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 text-xs">
            Sélectionnez une alerte dans la liste de gauche pour afficher son dossier complet.
          </div>
        )}
      </div>

      {/* MODAL: ASSIGN INVESTIGATORS */}
      {showAssignModal && selectedAlert && (
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

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {investigatorUsers.map((inv) => {
                const checked = selectedInvestigatorIds.includes(inv.id);
                return (
                  <label
                    key={inv.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      checked ? 'bg-blue-50 border-blue-400 font-semibold' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-slate-900">{inv.name}</div>
                      <div className="text-[11px] text-slate-500">{inv.roleTitle} • {inv.country}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvestigatorIds([...selectedInvestigatorIds, inv.id]);
                        } else {
                          setSelectedInvestigatorIds(selectedInvestigatorIds.filter(id => id !== inv.id));
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                );
              })}
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
      )}

      {/* MODAL: MODIFY PRIORITY & SLA */}
      {showPriorityModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Modifier la classification et les délais de traitement
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                CDC 3.1.2 : Le point de contact peut ajuster la priorité et les délais préconfigurés.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Niveau de priorité</label>
              <select
                value={newPriority}
                onChange={(e: any) => setNewPriority(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold"
              >
                <option value="critique">Critique (Action immédiate 48h)</option>
                <option value="tres_elevee">Très élevée (Enquête urgente 7j)</option>
                <option value="elevee">Élevée (Suivi renforcé 15j)</option>
                <option value="faible">Faible (Traitement standard 30j)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Délai de traitement cible (en jours)</label>
              <input
                type="number"
                value={newSlaDays}
                onChange={(e) => setNewSlaDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Motif de l'ajustement</label>
              <input
                type="text"
                value={priorityOverrideReason}
                onChange={(e) => setPriorityOverrideReason(e.target.value)}
                placeholder="Ex: Confirmation d'un préjudice supérieur à 20k€..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPriorityModal(false)}
                className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdatePriority}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Appliquer les modifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CORRECTIVE MEASURE */}
      {showAddMeasureModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Documenter une mesure corrective
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Exigence obligatoire avant toute clôture de dossier (CDC 3.1.2).
              </p>
            </div>

            <form onSubmit={handleAddCorrectiveMeasure} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Intitulé de la mesure *</label>
                <input
                  type="text"
                  value={measureTitle}
                  onChange={(e) => setMeasureTitle(e.target.value)}
                  placeholder="Ex: Audit approfondi des sinistres matériels, sanctions disciplinaires..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description des actions à mener *</label>
                <textarea
                  rows={3}
                  value={measureDesc}
                  onChange={(e) => setMeasureDesc(e.target.value)}
                  placeholder="Détaillez le plan d'action préventif ou curatif..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Responsable désigné</label>
                  <input
                    type="text"
                    value={measureResp}
                    onChange={(e) => setMeasureResp(e.target.value)}
                    placeholder="Ex: DRH Groupe, Directeur Technique..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Échéance de réalisation</label>
                  <input
                    type="date"
                    value={measureDueDate}
                    onChange={(e) => setMeasureDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Statut initial de la mesure</label>
                <select
                  value={measureStatus}
                  onChange={(e: any) => setMeasureStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="planned">Planifiée</option>
                  <option value="in_progress">En cours de déploiement</option>
                  <option value="implemented">Déployée / Réalisée</option>
                  <option value="verified">Vérifiée par la DARC</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMeasureModal(false)}
                  className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Enregistrer la mesure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE CASE */}
      {showCloseModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Clôturer formellement le dossier {selectedAlert.trackingNumber}
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Vérification de complétude et information du lanceur d'alerte (CDC 3.1.3).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Synthèse interne de clôture pour le dossier d'audit
              </label>
              <textarea
                rows={3}
                value={closureSummary}
                onChange={(e) => setClosureSummary(e.target.value)}
                placeholder="Résumé des conclusions de l'investigation et résultats..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Message officiel transmis au lanceur d'alerte (CDC 3.1.2 & 3.1.3)
              </label>
              <textarea
                rows={3}
                value={closureMessageToWb}
                onChange={(e) => setClosureMessageToWb(e.target.value)}
                placeholder="Rédigez le message de conclusion destiné au lanceur d'alerte..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCloseAlert}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirmer la clôture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REOPEN CASE (WITH MANDATORY REASON - CDC 3.1.3) */}
      {showReopenModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 text-rose-700">
                <RotateCcw className="w-4 h-4" />
                Rouvrir le dossier {selectedAlert.trackingNumber}
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Règle stricte CDC 3.1.3 : Motif de réouverture obligatoire consigné en piste d'audit.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Motif obligatoire de réouverture *
              </label>
              <textarea
                rows={4}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Précisez les nouveaux faits constatés, l'incomplétude identifiée ou la demande du Comité d'audit..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReopenAlert}
                disabled={!reopenReason.trim()}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold"
              >
                Valider la réouverture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
