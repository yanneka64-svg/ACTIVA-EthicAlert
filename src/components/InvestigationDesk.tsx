import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert,
  Search,
  Filter,
  Building2,
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
  ChevronRight,
  History,
  CheckSquare,
  Square,
  ArrowLeft,
  UserCog,
  // === AMÉLIORATION AJOUTÉE (Phase 10 — refonte visuelle façon maquette) ===
  ChevronDown,
  Check,
  Printer,
  // === AMÉLIORATION AJOUTÉE (Phase 11 — reproduction fidèle de la maquette) ===
  FolderOpen,
  Tag,
  Globe2,
  Info,
  Link2,
  ClipboardList,
  Paperclip,
  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  ArrowUpCircle,
} from 'lucide-react';
import {
  Language,
  AlertRecord,
  UserProfile,
  PriorityLevel,
  InternalNote,
  CaseMessage,
  CorrectiveMeasure,
  AlertStatus,
  CaseTask,
  TaskPriority,
  ConflictDeclaration,
  EvidenceFile,
  InvolvedPerson,
  Witness,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
import { PriorityBadge, StatusBadge, Breadcrumb, nocaColor } from './ui';
import { computeSlaStatus } from '../services/statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, userCan } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
// === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
import { computeCandidates, AssignmentCandidate } from '../domain/assignmentEngine';
import { computeWorkload } from '../domain/workloadCalc';
// === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
import { evaluateEscalationCriteria, getGroupEscalationOwners } from '../domain/escalationCriteria';

// === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
// Petit composant partagé entre les deux groupes (compatibles / autorisés
// Groupe) de la modale d'attribution — évite de dupliquer deux fois le
// même balisage checkbox + charge de travail.
function AssignCandidateRow({
  candidate,
  checked,
  onToggle,
}: {
  candidate: AssignmentCandidate;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const { user: inv, workload } = candidate;
  return (
    <label
      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
        checked ? 'bg-blue-50 border-blue-400 font-semibold' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div>
        <div className="text-slate-900">{inv.name}</div>
        <div className="text-[11px] text-slate-500">{inv.roleTitle} • {inv.country}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {workload.active} dossier(s) actif(s)
          {workload.overdue > 0 && <span className="text-rose-600 font-semibold"> · {workload.overdue} en retard</span>}
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="rounded text-blue-600 focus:ring-blue-500"
      />
    </label>
  );
}

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
  // === AMÉLIORATION AJOUTÉE (Phase 6 — Control Panel deep-link) ===
  // `trackingNumber` lets a caller (a specific case row in the Control
  // Panel's "Requires Immediate Attention" / "Most Urgent Cases" / "Recent
  // Alerts" tables) land directly on that one case's detail pane, not just
  // a filtered list — reuses the existing search filter (which already
  // matches on trackingNumber) so no new lookup logic is needed.
  // === AMÉLIORATION AJOUTÉE (Phase 9 — navigation restructurée façon maquette) ===
  // `myCasesOnly` powers the new dedicated "Mes Dossiers" sidebar entry: for
  // a non-admin the existing role-visibility rule below already restricts
  // the list to their own assigned cases, so this flag matters mainly for a
  // global viewer (functional/system admin, auditor) who would otherwise see
  // every case — it narrows the list to cases assigned to the *active* user
  // specifically, without touching the underlying visibility rule itself.
  initialFilter?: { status?: string; unassignedOnly?: boolean; overdueOnly?: boolean; trackingNumber?: string; myCasesOnly?: boolean };
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

  // === AMÉLIORATION AJOUTÉE (Phase 6 — séparation liste / détail des dossiers) ===
  // A real list screen and a real full-width detail screen, instead of the
  // previous always-both split-pane. A trackingNumber deep link (from the
  // Control Panel, a notification, or Recent Alerts) opens straight into
  // detail, matching what the caller actually asked for; every other entry
  // point (a plain tab switch, or a status/unassigned/overdue filter from a
  // KPI card) lands on the list — closer to the brief's own wording ("KPIs
  // must link to filtered case LISTS", §61) than the old auto-open-first
  // behavior was. Nothing about case selection, filtering, or any handler
  // below changes — only which of the two panels is shown.
  const [viewMode, setViewMode] = useState<'list' | 'detail'>(initialFilter?.trackingNumber ? 'detail' : 'list');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter?.status ?? 'all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [nocaFilter, setNocaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>(initialFilter?.trackingNumber ?? '');
  // === AMÉLIORATION AJOUTÉE (Phase 5) ===
  const [unassignedOnlyFilter, setUnassignedOnlyFilter] = useState<boolean>(!!initialFilter?.unassignedOnly);
  const [overdueOnlyFilter, setOverdueOnlyFilter] = useState<boolean>(!!initialFilter?.overdueOnly);
  // === AMÉLIORATION AJOUTÉE (Phase 9 — écran dédié "Mes Dossiers") ===
  const [myCasesOnlyFilter] = useState<boolean>(!!initialFilter?.myCasesOnly);

  // Selected case active tab
  // === AMÉLIORATION AJOUTÉE (Phase 11 — 9 onglets exacts de la maquette) ===
  // 'persons' et 'evidence_tab' sont de nouveaux onglets dédiés. 'report'
  // regroupe désormais 3 contenus existants qui n'ont pas d'onglet dédié
  // dans la maquette (notes d'enquête internes, mesures correctives... non,
  // uniquement notes internes + conflit d'intérêt) sous un seul onglet
  // "Rapport", en plus d'une synthèse — rien n'est supprimé, tout reste
  // accessible, juste réorganisé. 'triage' s'affiche sous le libellé
  // "Allégations" (contenu existant enrichi d'un résumé de la qualification).
  const [activeCaseTab, setActiveCaseTab] = useState<'overview' | 'messages' | 'corrective' | 'tasks' | 'timeline' | 'triage' | 'persons' | 'evidence_tab' | 'report'>('overview');

  // === AMÉLIORATION AJOUTÉE (Phase 10 — refonte visuelle façon maquette) ===
  // Consolidates the action toolbar (Attribution/Priorité/Clôture/Réouverture/
  // Archivage) into a single "Actions" dropdown button, matching the
  // reference case-detail mockup — every underlying handler/condition below
  // is unchanged, only how the buttons are grouped visually.
  const [showActionsMenu, setShowActionsMenu] = useState(false);

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

  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState<string>('');
  const [escalateOwnerId, setEscalateOwnerId] = useState<string>('');

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

  // === AMÉLIORATION AJOUTÉE (Phase 6) === Task form inputs
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskOwnerId, setTaskOwnerId] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');

  // === AMÉLIORATION AJOUTÉE (Phase 6 — Triage & Conflit d'intérêt) ===
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictOutcome, setConflictOutcome] = useState<ConflictDeclaration['outcome']>('no_conflict');
  const [conflictDetails, setConflictDetails] = useState('');

  // === AMÉLIORATION AJOUTÉE (Phase 11 — actions "Modifier"/"+ Ajouter" de
  // l'onglet Vue d'ensemble, telles que montrées dans la maquette) ===
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [addPersonKind, setAddPersonKind] = useState<'subject' | 'witness' | null>(null);
  const [personNameInput, setPersonNameInput] = useState('');
  const [personPositionInput, setPersonPositionInput] = useState('');
  const [personHierarchyInput, setPersonHierarchyInput] = useState<InvolvedPerson['hierarchyRole']>('Employé');
  const evidenceFileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to storage updates
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setAlerts(storage.getAlerts());
    });
    return unsub;
  }, []);

  const allUsers = storage.getUsers();
  // === AMÉLIORATION AJOUTÉE (Phase 7 — Administration CRUD) ===
  const entities = storage.getEntities();
  // === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
  // Candidats à l'attribution d'un dossier : tout profil qui fait
  // réellement de l'investigation (permission `cases.edit`) — remplace la
  // comparaison à 2 rôles, inclut désormais aussi `senior_investigator`.
  const investigatorUsers = allUsers.filter(u => userCan(u, 'cases.edit'));

  // Role visibility logic (CDC 3.1.4):
  // "Chaque gestionnaire n'aura de la visibilité que sur les alertes qui lui sont attribuées.
  // Seul l'administrateur aura une vue sur toutes les alertes enregistrées dans le système."
  // === AMÉLIORATION AJOUTÉE (Phase 12.3) === `system_admin` n'a plus
  // accès aux dossiers (brief section 30) — voir src/services/authz.ts.
  const isGlobalViewer = isGlobalCaseViewer(activeUser);

  // === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
  // Remplace le double filtre (rôle assigné + confidentialité) précédemment
  // écrit ici en dur par le hook partagé `useVisibleAlerts`, qui applique
  // en plus le nouveau périmètre pays/entité (countries/entities) — même
  // logique, une seule implémentation désormais (voir
  // src/hooks/useVisibleAlerts.ts). `isGlobalViewer` ci-dessus reste
  // calculé séparément : encore utilisé plus bas pour des choix
  // d'affichage (libellés).
  const baseVisibleAlerts = useVisibleAlerts(alerts, activeUser);

  const visibleAlerts = baseVisibleAlerts.filter(alert => {
    // Status filter
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;

    // Entity filter
    if (entityFilter !== 'all' && alert.concernedEntity !== entityFilter) return false;

    // NOCA filter
    if (nocaFilter !== 'all' && alert.riskEvaluation.nocaThreshold !== nocaFilter) return false;

    // === AMÉLIORATION AJOUTÉE (Phase 5) === Control-Panel-driven filters
    if (unassignedOnlyFilter && alert.assignedInvestigators.length > 0) return false;
    if (overdueOnlyFilter && computeSlaStatus(alert) !== 'overdue') return false;
    // === AMÉLIORATION AJOUTÉE (Phase 9) === "Mes Dossiers" deep link
    if (myCasesOnlyFilter && !alert.assignedInvestigators.includes(activeUser.id)) return false;

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
  // Only auto-falls-back to the first visible case while actually in detail
  // mode (e.g. a trackingNumber deep link narrows the search to one match) —
  // in list mode there is deliberately no "current" case.
  const selectedAlert = alerts.find(a => a.id === selectedAlertId) || (viewMode === 'detail' ? visibleAlerts[0] : undefined) || null;

  // === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
  // Candidats à l'attribution pour le dossier actuellement sélectionné —
  // moteur de compatibilité (pays/entité/confidentialité/conflit/
  // disponibilité), voir domain/assignmentEngine.ts. `null` tant qu'aucun
  // dossier n'est sélectionné (modale fermée) : pas de calcul superflu.
  const assignCandidates = selectedAlert
    ? computeCandidates(selectedAlert, investigatorUsers, computeWorkload(investigatorUsers, alerts))
    : null;

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

  // === AMÉLIORATION AJOUTÉE (Phase 6) === Task management, via the Phase 1
  // storage.addTask/updateTask pair — same audit+notify pattern as every
  // other mutation here.
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskOwnerId || !taskDueDate || !selectedAlert) return;

    const newTask: CaseTask = {
      id: 'tsk-' + Date.now(),
      title: taskTitle.trim(),
      description: taskDescription.trim() || undefined,
      owner: taskOwnerId,
      dueDate: taskDueDate,
      priority: taskPriority,
      status: 'not_started',
      createdAt: new Date().toISOString(),
      createdBy: activeUser.id,
    };

    storage.addTask(selectedAlert.id, newTask, activeUser);

    setTaskTitle('');
    setTaskDescription('');
    setTaskOwnerId('');
    setTaskDueDate('');
    setTaskPriority('medium');
    setShowAddTaskModal(false);
  };

  const handleToggleTaskStatus = (task: CaseTask) => {
    if (!selectedAlert) return;
    const nextStatus: CaseTask['status'] = task.status === 'completed' ? 'not_started' : 'completed';
    storage.updateTask(selectedAlert.id, task.id, {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined,
    }, activeUser);
  };

  const taskEffectiveStatus = (task: CaseTask): CaseTask['status'] => {
    if (task.status === 'completed') return 'completed';
    if (new Date(task.dueDate).getTime() < Date.now()) return 'overdue';
    return task.status;
  };

  // === AMÉLIORATION AJOUTÉE (Phase 6 — Triage) === exact wording already
  // used at submission time (AlertSubmissionFlow's step 4), reused here so
  // the Triage tab reads the same axis scores with the same labels.
  const RISK_AXIS_LABELS: Record<'financialImpact' | 'hierarchyLevel' | 'recidivism' | 'reputationRisk', Record<1 | 2 | 3 | 4, string>> = {
    financialImpact: { 1: 'Faible (01) : < 5 000 Euro', 2: 'Élevé (02) : 5 000 - 10 000 Euro', 3: 'Très élevé (03) : 10 000 - 20 000 Euro', 4: 'Critique (04) : > 20 000 Euro' },
    hierarchyLevel: { 1: 'Faible (01) : Employé', 2: 'Élevé (02) : Cadre', 3: 'Très élevé (03) : Sous Directeur', 4: 'Critique (04) : Directeur' },
    recidivism: { 1: 'Faible (01) : Aucune', 2: 'Élevé (02) : Possible', 3: 'Très élevé (03) : Confirmée', 4: 'Critique (04) : Confirmée (Majeure)' },
    reputationRisk: { 1: 'Faible (01) : Négligeable', 2: 'Élevé (02) : Modéré', 3: 'Très élevé (03) : Élevé', 4: 'Critique (04) : Élevé / Médiatique' },
  };

  // === AMÉLIORATION AJOUTÉE (Phase 6 — Conflit d'intérêt) === uses Phase
  // 1's ConflictDeclaration type + storage.declareConflict (already built,
  // unused until now) — same mutate + persist + notify + logAudit pattern.
  const handleDeclareConflict = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    if (conflictOutcome === 'conflict_identified' && !conflictDetails.trim()) return;
    const declaration: ConflictDeclaration = {
      id: 'cod-' + Date.now(),
      userId: activeUser.id,
      userName: activeUser.name,
      declaredAt: new Date().toISOString(),
      outcome: conflictOutcome,
      details: conflictOutcome === 'conflict_identified' ? conflictDetails.trim() : undefined,
    };
    storage.declareConflict(selectedAlert.id, declaration, activeUser);
    setShowConflictModal(false);
    setConflictOutcome('no_conflict');
    setConflictDetails('');
  };

  // === AMÉLIORATION AJOUTÉE (Phase 11) === "Modifier" sur la description des faits.
  const handleSaveDescription = () => {
    if (!selectedAlert) return;
    storage.saveAlert({
      ...selectedAlert,
      detailedDescription: descriptionDraft.trim() || selectedAlert.detailedDescription,
      updatedAt: new Date().toISOString(),
    });
    setEditingDescription(false);
  };

  // === AMÉLIORATION AJOUTÉE (Phase 11) === "+ Ajouter" sur Personnes impliquées / Témoins.
  const handleAddPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert || !addPersonKind || !personNameInput.trim()) return;
    if (addPersonKind === 'subject') {
      const entry: InvolvedPerson = {
        id: 'per-' + Date.now(),
        name: personNameInput.trim(),
        position: personPositionInput.trim(),
        hierarchyRole: personHierarchyInput,
      };
      storage.saveAlert({ ...selectedAlert, involvedPersons: [...selectedAlert.involvedPersons, entry], updatedAt: new Date().toISOString() });
    } else {
      const entry: Witness = {
        id: 'wit-' + Date.now(),
        name: personNameInput.trim(),
        position: personPositionInput.trim(),
        hierarchyRole: personHierarchyInput,
      };
      storage.saveAlert({ ...selectedAlert, witnesses: [...selectedAlert.witnesses, entry], updatedAt: new Date().toISOString() });
    }
    setAddPersonKind(null);
    setPersonNameInput('');
    setPersonPositionInput('');
    setPersonHierarchyInput('Employé');
  };

  // === AMÉLIORATION AJOUTÉE (Phase 11) === "+ Ajouter" sur Preuves & pièces jointes.
  const handleAddEvidenceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAlert) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newEvidence: EvidenceFile = {
        id: 'ev-' + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
      };
      storage.saveAlert({ ...selectedAlert, evidences: [...selectedAlert.evidences, newEvidence], updatedAt: new Date().toISOString() });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  const handleEscalate = () => {
    if (!selectedAlert || !escalateReason.trim() || !escalateOwnerId) return;
    const criteriaMatched = evaluateEscalationCriteria(selectedAlert).map((c) => c.label);
    const result = storage.escalateAlert(selectedAlert.id, escalateReason.trim(), criteriaMatched, escalateOwnerId, activeUser);
    if (result.allowed) {
      setShowEscalateModal(false);
      setEscalateReason('');
      setEscalateOwnerId('');
    }
    // En cas de refus (transition invalide), la modale reste ouverte —
    // aucun message d'erreur dédié n'est encore affiché ici, comme pour les
    // autres actions de ce fichier qui échouent silencieusement plutôt que
    // de casser l'écran ; `result.reason` est disponible pour un futur
    // affichage si besoin.
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

  // === AMÉLIORATION AJOUTÉE (Phase 12.5 — niveau de confidentialité) ===
  // N'affiche rien pour `restricted` (le niveau par défaut, non sensible) —
  // seuls `confidential`/`highly_confidential` méritent une indication
  // visuelle, pour ne pas surcharger chaque carte d'un badge sans valeur
  // ajoutée. Le fait qu'on l'affiche du tout signifie que cet utilisateur y
  // est déjà habilité — visibleAlerts (ci-dessus) a déjà écarté tout
  // dossier hors de son plafond.
  const getConfidentialityBadge = (alert: AlertRecord) => {
    const level = alert.confidentialityLevel ?? 'restricted';
    if (level === 'restricted') return null;
    const style =
      level === 'highly_confidential'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
    const label = level === 'highly_confidential' ? 'Très confidentiel' : 'Confidentiel';
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${style}`} title="Niveau de confidentialité du dossier">
        <Lock className="w-2.5 h-2.5" />
        {label}
      </span>
    );
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
          {entities.map(e => (
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 6 — liste et détail séparés) ===
          A real dedicated list screen and a real dedicated full-width detail
          screen, shown one at a time via viewMode — replacing the previous
          always-both split-pane. Same data, same filters, same handlers. */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider">
              Dossiers ({visibleAlerts.length})
            </span>
            <span className="text-[11px] text-slate-500">
              {isGlobalViewer ? 'Toutes filiales' : 'Assignés'}
            </span>
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Aucun dossier ne correspond à vos critères de filtrage.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
              {visibleAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      setSelectedAlertId(alert.id);
                      setViewMode('detail');
                      storage.logAudit(
                        'ALERT_ACCESSED',
                        `Consultation de la fiche dossier ${alert.trackingNumber} par ${activeUser.name}.`,
                        { id: alert.id, trackingNumber: alert.trackingNumber },
                        activeUser
                      );
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-200'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-xs text-[#0B2545] flex items-center gap-1.5">
                        {alert.trackingNumber}
                        {getConfidentialityBadge(alert)}
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
              })}
            </div>
          )}
        </div>
      )}

      {/* Case Detail & Investigation Workspace */}
      {/* === AMÉLIORATION AJOUTÉE (Phase 10 — refonte visuelle façon
          maquette, fiche dossier) === Breadcrumb + en-tête (titre, badges,
          jauge de score de risque, menu Actions unique) + ligne d'infos +
          mise en page 2 colonnes (onglets/contenu à gauche, "Statut du
          dossier" / "Informations complémentaires" / "Liens rapides" à
          droite). Chaque bouton d'action, chaque onglet et chaque handler
          existants sont conservés à l'identique — seule la structure
          visuelle autour d'eux change. */}
      {viewMode === 'detail' && (selectedAlert ? (
        <div className="space-y-5">
          <Breadcrumb
            items={[
              { label: t.breadcrumb_cases, onClick: () => setViewMode('list') },
              { label: selectedAlert.trackingNumber },
            ]}
          />

          {/* Title row: folder icon + tracking number + badges + Actions menu (top),
              description + risk gauge (below) — matches the reference mockup's
              two-line asymmetric header exactly. */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                <FolderOpen className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-mono text-xl sm:text-2xl font-extrabold text-slate-900">
                    {selectedAlert.trackingNumber}
                  </h1>
                  {getPriorityBadge(selectedAlert)}
                  <StatusBadge status={selectedAlert.status} label={selectedAlert.status.toUpperCase().replace('_', ' ')} size="sm" />
                </div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-1 max-w-xl">
                  {selectedAlert.detailedDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2.5 shrink-0">
              {/* ACTIONS MENU (CDC 3.1.2 & 3.1.3: Attribution, Priorité, Clôture, Réouverture, Archivage) —
                  every item below is the exact same button/handler as before, just grouped in one dropdown. */}
              <div className="relative">
                <button
                  id="btn-case-actions-menu"
                  onClick={() => setShowActionsMenu((v) => !v)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] text-white text-xs font-bold shadow-sm transition"
                >
                  <span>{t.case_actions}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showActionsMenu ? 'rotate-180' : ''}`} />
                </button>

                {showActionsMenu && (
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-30 text-xs">
                    {/* === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
                        Remplace la comparaison de rôle codée en dur par la
                        vraie permission `cases.assign` (domain/permissions.ts).
                        Corrige une incohérence réelle : `system_admin` n'a
                        volontairement AUCUNE permission liée aux dossiers
                        ("System Administrator ≠ Case Access", déjà appliqué
                        partout ailleurs via isGlobalCaseViewer/ROLE_PERMISSIONS)
                        mais pouvait jusqu'ici attribuer un dossier via ce
                        bouton codé en dur ; `darc_compliance`, qui a bien
                        `cases.assign`, ne le pouvait pas. */}
                    {userCan(activeUser, 'cases.assign') && (
                      <button
                        id="btn-desk-assign"
                        onClick={() => {
                          setSelectedInvestigatorIds(selectedAlert.assignedInvestigators);
                          setShowAssignModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                        <span>{t.btn_assign_investigator}</span>
                      </button>
                    )}

                    {/* === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
                        Escalade manuelle vers la DARC Groupe (brief §14/§44).
                        Gardée par `cases.reassign` (comme l'attribution,
                        l'escalade change la responsabilité du dossier) — un
                        investigateur de base n'a pas cette permission, un
                        senior_investigator/functional_admin/darc_compliance
                        oui. N'apparaît que s'il existe au moins un compte
                        Groupe éligible pour recevoir le dossier. */}
                    {userCan(activeUser, 'cases.reassign') && getGroupEscalationOwners(allUsers).length > 0 && (
                      <button
                        id="btn-desk-escalate"
                        onClick={() => {
                          setEscalateReason('');
                          setEscalateOwnerId(getGroupEscalationOwners(allUsers)[0]?.id ?? '');
                          setShowEscalateModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Escalader vers la DARC Groupe</span>
                      </button>
                    )}

                    {(activeUser.role === 'functional_admin' || activeUser.role === 'system_admin') && (
                      <button
                        id="btn-desk-priority"
                        onClick={() => {
                          setNewPriority(selectedAlert.overridePriority || selectedAlert.riskEvaluation.priority);
                          setShowPriorityModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                        <span>{t.btn_change_priority}</span>
                      </button>
                    )}

                    {selectedAlert.status !== 'closed' && selectedAlert.status !== 'archived' && (
                      <button
                        id="btn-desk-close"
                        onClick={() => {
                          setShowCloseModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.btn_close_case}</span>
                      </button>
                    )}

                    {selectedAlert.status === 'closed' && (
                      <button
                        id="btn-desk-reopen"
                        onClick={() => {
                          setShowReopenModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-rose-50 text-rose-700 font-bold"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t.btn_reopen_case}</span>
                      </button>
                    )}

                    {selectedAlert.status === 'closed' && (
                      <button
                        onClick={() => {
                          handleArchiveAlert();
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        <FolderArchive className="w-3.5 h-3.5" />
                        <span>{t.btn_archive_case}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Risk score gauge — reuses the same totalScore/16 already
                  computed at submission time (see the Allégations tab below) */}
              {(() => {
                const score = selectedAlert.riskEvaluation.totalScore;
                const tone = nocaColor(score);
                const barColor = score >= 14 ? 'bg-rose-500' : score >= 11 ? 'bg-orange-500' : score >= 7 ? 'bg-amber-500' : 'bg-slate-400';
                return (
                  <div className={`w-40 rounded-2xl border ${tone.border} bg-white shadow-sm px-4 py-2.5`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t.case_risk_score}</div>
                    <div className={`text-lg font-extrabold ${tone.text}`}>{score}/16</div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, (score / 16) * 100)}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Info row: plain row with icon-prefixed values (no card border), matching the mockup exactly */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_category}</div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mt-1 truncate">
                <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {selectedAlert.category}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_entity}</div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mt-1 truncate">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {selectedAlert.concernedEntity}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_country}</div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mt-1 truncate">
                <Globe2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {selectedAlert.country}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_received}</div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {new Date(selectedAlert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_sla_due}</div>
              <div className={`flex items-center gap-1.5 font-semibold mt-1 ${computeSlaStatus(selectedAlert) === 'overdue' ? 'text-rose-600' : 'text-slate-800'}`}>
                <Calendar className={`w-3.5 h-3.5 shrink-0 ${computeSlaStatus(selectedAlert) === 'overdue' ? 'text-rose-500' : 'text-slate-400'}`} />
                {selectedAlert.targetCompletionDate
                  ? new Date(selectedAlert.targetCompletionDate).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')
                  : '—'}
                {computeSlaStatus(selectedAlert) === 'overdue' && <span>({t.case_info_late})</span>}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_investigator}</div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mt-1 truncate">
                <UserCog className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {selectedAlert.assignedInvestigatorNames.length > 0 ? selectedAlert.assignedInvestigatorNames.join(', ') : t.case_info_unassigned}
              </div>
            </div>
          </div>

          {/* Two-column layout: tabs/content (left) + Statut/Infos/Liens (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === Les 9 onglets exacts de
                la maquette : Vue d'ensemble, Allégations, Personnes, Preuves,
                Tâches, Communications, Mesures correctives, Rapport, Journal
                d'audit. Chaque bouton pointe vers un contenu réel existant
                (voir le mapping détaillé en commentaire au-dessus de la
                déclaration d'activeCaseTab) — rien n'a été supprimé, certains
                contenus ont simplement été regroupés ou dupliqués sous un
                intitulé plus proche de la maquette. */}
            <div className="flex overflow-x-auto border-b border-slate-200 px-6 text-xs font-semibold">
              <button
                onClick={() => setActiveCaseTab('overview')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap ${
                  activeCaseTab === 'overview'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.tab_overview_exact}
              </button>
              <button
                onClick={() => setActiveCaseTab('triage')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeCaseTab === 'triage'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.tab_allegations}</span>
                {selectedAlert.overridePriority && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Priorité ajustée" />
                )}
              </button>
              <button
                onClick={() => setActiveCaseTab('persons')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeCaseTab === 'persons'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.tab_persons}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                  {selectedAlert.involvedPersons.length}
                </span>
              </button>
              <button
                onClick={() => setActiveCaseTab('evidence_tab')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeCaseTab === 'evidence_tab'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.nav_evidence}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                  {selectedAlert.evidences.length}
                </span>
              </button>
              <button
                onClick={() => setActiveCaseTab('tasks')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeCaseTab === 'tasks'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.nav_tasks}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                  {(selectedAlert.tasks ?? []).length}
                </span>
              </button>
              <button
                onClick={() => setActiveCaseTab('messages')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeCaseTab === 'messages'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.nav_communications}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                  {selectedAlert.messages.length}
                </span>
              </button>
              <button
                onClick={() => setActiveCaseTab('corrective')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeCaseTab === 'corrective'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.sidebar_corrective_measures}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedAlert.correctiveMeasures.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {selectedAlert.correctiveMeasures.length}
                </span>
              </button>
              <button
                onClick={() => setActiveCaseTab('report')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap ${
                  activeCaseTab === 'report'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.tab_report}
              </button>
              <button
                onClick={() => setActiveCaseTab('timeline')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap ${
                  activeCaseTab === 'timeline'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.tab_audit_journal}
              </button>
            </div>

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: 1. VUE
                D'ENSEMBLE — reproduit exactement les 4 blocs de la maquette
                (Description avec "Modifier", Personnes impliquées + Témoins
                avec "+ Ajouter", Preuves avec "+ Ajouter"). L'origine du
                signalement et l'investigateur assigné restent affichés,
                juste ailleurs désormais (ligne d'infos + colonne "Informations
                complémentaires" — pas de perte, seulement une relocalisation
                fidèle à la maquette). */}
            {activeCaseTab === 'overview' && (
              <div className="p-6 space-y-5 max-h-[640px] overflow-y-auto text-xs">
                {/* Description of facts */}
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Description détaillée des faits
                    </h4>
                    {!editingDescription && (
                      <button
                        onClick={() => { setDescriptionDraft(selectedAlert.detailedDescription); setEditingDescription(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {t.case_btn_edit}
                      </button>
                    )}
                  </div>
                  {editingDescription ? (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={descriptionDraft}
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingDescription(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                        <button onClick={handleSaveDescription} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">Enregistrer</button>
                      </div>
                    </div>
                  ) : (
                    <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">{selectedAlert.detailedDescription}</p>
                  )}
                </div>

                {/* Implicated & Witnesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['subject', 'witness'] as const).map((kind) => {
                    const list = kind === 'subject' ? selectedAlert.involvedPersons : selectedAlert.witnesses;
                    return (
                      <div key={kind} className="p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-bold text-slate-900">
                            {kind === 'subject' ? 'Personnes impliquées' : 'Témoins'} ({list.length})
                          </h5>
                          <button
                            onClick={() => setAddPersonKind(kind)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {t.case_btn_add}
                          </button>
                        </div>
                        {list.length === 0 ? (
                          <p className="text-slate-400 italic">Non spécifié</p>
                        ) : (
                          <div className="space-y-1.5">
                            {list.map((p) => (
                              <div key={p.id} className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                                  {(p.name || '??').slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-slate-900 block truncate">{p.name || 'Confidentiel'}</span>
                                  <div className="text-[11px] text-slate-500 truncate">{p.position} • {p.hierarchyRole}</div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Evidences list */}
                <div className="p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-bold text-slate-900 flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-blue-600" />
                      Preuves & pièces jointes ({selectedAlert.evidences.length})
                    </h5>
                    <button
                      onClick={() => evidenceFileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t.case_btn_add}
                    </button>
                    <input ref={evidenceFileInputRef} type="file" className="hidden" onChange={handleAddEvidenceFile} />
                  </div>
                  {selectedAlert.evidences.length === 0 ? (
                    <p className="text-slate-400 italic">Aucun document joint</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedAlert.evidences.map((ev) => (
                        <div key={ev.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-slate-800 block truncate">{ev.name}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(ev.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{Math.round(ev.size / 1024)} Ko</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === Modal partagée pour "+ Ajouter" (Personnes impliquées / Témoins) */}
            {addPersonKind && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <form onSubmit={handleAddPerson} className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-3 text-xs">
                  <h3 className="text-sm font-bold text-slate-900">
                    {addPersonKind === 'subject' ? 'Ajouter une personne impliquée' : 'Ajouter un témoin'}
                  </h3>
                  <input
                    autoFocus
                    value={personNameInput}
                    onChange={(e) => setPersonNameInput(e.target.value)}
                    placeholder="Nom (ou « Confidentiel »)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <input
                    value={personPositionInput}
                    onChange={(e) => setPersonPositionInput(e.target.value)}
                    placeholder="Fonction / Poste"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <select
                    value={personHierarchyInput}
                    onChange={(e) => setPersonHierarchyInput(e.target.value as InvolvedPerson['hierarchyRole'])}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Employé">Employé</option>
                    <option value="Cadre">Cadre</option>
                    <option value="Sous-Directeur">Sous-Directeur</option>
                    <option value="Directeur+">Directeur+</option>
                  </select>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setAddPersonKind(null)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">Annuler</button>
                    <button type="submit" disabled={!personNameInput.trim()} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold">{t.case_btn_add}</button>
                  </div>
                </form>
              </div>
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: PERSONNES
                — vue dédiée (reprend Personnes impliquées + Témoins, avec
                "+ Ajouter", partagée avec l'onglet Vue d'ensemble). */}
            {activeCaseTab === 'persons' && (
              <div className="p-6 space-y-4 max-h-[640px] overflow-y-auto text-xs">
                {(['subject', 'witness'] as const).map((kind) => {
                  const list = kind === 'subject' ? selectedAlert.involvedPersons : selectedAlert.witnesses;
                  return (
                    <div key={kind} className="p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-bold text-slate-900">
                          {kind === 'subject' ? 'Personnes impliquées' : 'Témoins'} ({list.length})
                        </h5>
                        <button
                          onClick={() => setAddPersonKind(kind)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {t.case_btn_add}
                        </button>
                      </div>
                      {list.length === 0 ? (
                        <p className="text-slate-400 italic">Non spécifié</p>
                      ) : (
                        <div className="space-y-1.5">
                          {list.map((p) => (
                            <div key={p.id} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                              <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0 text-xs">
                                {(p.name || '??').slice(0, 2).toUpperCase()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-slate-900 block truncate">{p.name || 'Confidentiel'}</span>
                                <div className="text-[11px] text-slate-500 truncate">{p.position} • {p.hierarchyRole}</div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: PREUVES —
                vue dédiée (reprend Preuves & pièces jointes, avec
                "+ Ajouter"), avec les métadonnées disponibles pour chaque
                fichier (aucun champ inventé : hash/version ne sont pas
                stockés par ce modèle, donc non affichés ici). */}
            {activeCaseTab === 'evidence_tab' && (
              <div className="p-6 space-y-3 max-h-[640px] overflow-y-auto text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {t.nav_evidence} ({selectedAlert.evidences.length})
                  </span>
                  <button
                    onClick={() => evidenceFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t.case_btn_add}
                  </button>
                </div>
                {selectedAlert.evidences.length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                    Aucun document joint
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedAlert.evidences.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-slate-800 block truncate">{ev.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {ev.type || 'application/octet-stream'} •{' '}
                            {new Date(ev.uploadedAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{Math.round(ev.size / 1024)} Ko</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: RAPPORT —
                regroupe désormais la synthèse du dossier, les notes
                d'enquête internes (contenu inchangé) et les déclarations de
                conflit d'intérêt (contenu inchangé, voir plus bas) sous un
                seul onglet "Rapport", comme dans la maquette. */}
            {activeCaseTab === 'report' && (
              <div className="p-6 space-y-6 max-h-[640px] overflow-y-auto text-xs">
                {/* Synthèse du dossier */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    Synthèse du dossier
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700">
                    <div><span className="text-slate-500">Catégorie :</span> {selectedAlert.category}</div>
                    <div><span className="text-slate-500">Entité :</span> {selectedAlert.concernedEntity}</div>
                    <div><span className="text-slate-500">Statut :</span> {selectedAlert.status.toUpperCase()}</div>
                    <div><span className="text-slate-500">Investigateur(s) :</span> {selectedAlert.assignedInvestigatorNames.join(', ') || t.case_info_unassigned}</div>
                    <div><span className="text-slate-500">Mesures correctives :</span> {selectedAlert.correctiveMeasures.length}</div>
                    <div><span className="text-slate-500">Clôturé le :</span> {selectedAlert.closedAt ? new Date(selectedAlert.closedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') : '—'}</div>
                  </div>
                  {selectedAlert.closureSummary && (
                    <p className="pt-2 border-t border-slate-200 text-slate-700 leading-relaxed">{selectedAlert.closureSummary}</p>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t.case_btn_generate_report}
                  </button>
                </div>

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

            {/* === AMÉLIORATION AJOUTÉE (Phase 6) === TAB CONTENT: TASKS */}
            {activeCaseTab === 'tasks' && (
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
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 6) === TAB CONTENT: TIMELINE — derived from real audit_logs + messages for this case, never hand-authored. */}
            {activeCaseTab === 'timeline' && (
              <div className="p-6 max-h-[560px] overflow-y-auto text-xs">
                {(() => {
                  type TimelineItem = { timestamp: string; label: string };
                  const auditItems: TimelineItem[] = storage
                    .getAuditLogs()
                    .filter((log) => log.trackingNumber === selectedAlert.trackingNumber)
                    .map((log) => ({ timestamp: log.timestamp, label: log.details }));
                  const messageItems: TimelineItem[] = selectedAlert.messages.map((m) => ({
                    timestamp: m.createdAt,
                    label: `${t.timeline_message_from} ${m.senderDisplayName} : « ${m.content.slice(0, 80)}${m.content.length > 80 ? '…' : ''} »`,
                  }));
                  const items = [...auditItems, ...messageItems].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  );
                  if (items.length === 0) {
                    return <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">{t.timeline_empty}</div>;
                  }
                  return (
                    <ol className="relative border-l-2 border-slate-200 ml-2 space-y-5">
                      {items.map((item, i) => (
                        <li key={i} className="ml-4">
                          <div className="absolute w-2.5 h-2.5 bg-blue-600 rounded-full -left-[5px] mt-1 border-2 border-white" />
                          <time className="text-[10px] font-bold text-slate-400 uppercase">
                            {new Date(item.timestamp).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR', {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </time>
                          <p className="text-slate-700 mt-0.5">{item.label}</p>
                        </li>
                      ))}
                    </ol>
                  );
                })()}
              </div>
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 6 — Triage) === repurposes the
                existing NOCA risk-matrix display (AlertSubmissionFlow /
                AdminConfigView) as an editable-override screen per the
                brief's §24: shows the 4-axis score already computed at
                submission time, then reuses the existing priority-override
                modal (same button as the top toolbar's "Modifier la
                priorité / Délais") rather than a second, parallel edit
                path. */}
            {activeCaseTab === 'triage' && (
              <div className="p-6 space-y-5 max-h-[640px] overflow-y-auto text-xs">
                {/* === AMÉLIORATION AJOUTÉE (Phase 11) === résumé de la
                    qualification (catégorie/sous-catégorie/description),
                    pour que l'onglet "Allégations" présente d'abord ce que
                    le dossier reproche avant la matrice de risque. */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900">{selectedAlert.category}</div>
                  <div className="text-slate-600">{selectedAlert.subCategory}</div>
                  {selectedAlert.customViolationType && (
                    <div className="text-slate-500 italic">{selectedAlert.customViolationType}</div>
                  )}
                  <p className="pt-2 border-t border-slate-100 leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {selectedAlert.detailedDescription}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {t.triage_matrix_title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">{t.triage_axis_financial}</div>
                      <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.financialImpact[selectedAlert.riskEvaluation.financialImpact]}</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">{t.triage_axis_hierarchy}</div>
                      <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.hierarchyLevel[selectedAlert.riskEvaluation.hierarchyLevel]}</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">{t.triage_axis_recidivism}</div>
                      <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.recidivism[selectedAlert.riskEvaluation.recidivism]}</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <div className="text-slate-500 text-[11px]">{t.triage_axis_reputation}</div>
                      <div className="font-bold text-slate-900 mt-0.5">{RISK_AXIS_LABELS.reputationRisk[selectedAlert.riskEvaluation.reputationRisk]}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-center">
                    <div className="text-2xl font-extrabold text-[#0B2545]">{selectedAlert.riskEvaluation.totalScore}/16</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{t.triage_total_score}</div>
                  </div>
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-center">
                    <div className="text-2xl font-extrabold text-[#0B2545]">{selectedAlert.riskEvaluation.nocaThreshold}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{selectedAlert.riskEvaluation.expectedTreatment}</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">{t.triage_computed_priority}</span>
                    {getPriorityBadge({ ...selectedAlert, overridePriority: undefined } as AlertRecord)}
                  </div>
                  {selectedAlert.overridePriority && (
                    <div className="flex items-center justify-between pt-2 border-t border-amber-100">
                      <span className="font-semibold text-amber-800">{t.triage_override_priority}</span>
                      {getPriorityBadge(selectedAlert)}
                    </div>
                  )}
                  {selectedAlert.overrideReason && (
                    <p className="text-[11px] text-slate-500 pt-1">
                      <span className="font-semibold">{t.triage_override_reason}:</span> {selectedAlert.overrideReason}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setNewPriority(selectedAlert.overridePriority || selectedAlert.riskEvaluation.priority);
                    setPriorityOverrideReason('');
                    setShowPriorityModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {t.triage_btn_adjust}
                </button>
              </div>
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 6 — Conflit d'intérêt ; Phase 11
                — déplacé sous l'onglet "Rapport") === real, persisted
                declarations (Phase 1's ConflictDeclaration type +
                storage.declareConflict, built but unused until now) — never
                a fabricated/derived list. */}
            {activeCaseTab === 'report' && (
              <div className="p-6 pt-0 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">{t.conflict_section_title}</div>
                    <p className="text-slate-500 text-[11px] mt-0.5">{t.conflict_section_desc}</p>
                  </div>
                  <button
                    onClick={() => { setConflictOutcome('no_conflict'); setConflictDetails(''); setShowConflictModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition shrink-0"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                    {t.conflict_btn_declare}
                  </button>
                </div>

                {(selectedAlert.conflictDeclarations ?? []).length === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-500">
                    {t.conflict_empty}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {(selectedAlert.conflictDeclarations ?? []).map((d) => (
                      <li key={d.id} className="p-3.5 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{d.userName}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(d.declaredAt).toLocaleString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                          </span>
                        </div>
                        <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.outcome === 'no_conflict'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                            : 'bg-rose-100 text-rose-900 border-rose-200'
                        }`}>
                          {d.outcome === 'no_conflict' ? t.conflict_outcome_none : t.conflict_outcome_identified}
                        </span>
                        {d.details && <p className="text-slate-600 mt-1.5 leading-relaxed">{d.details}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Right column: Statut du dossier / Informations complémentaires / Liens rapides */}
          <aside className="space-y-5">
            {/* Statut du dossier — timeline verticale, dérivée du vrai statut
                (pas de statut fantaisiste : "En attente d'informations" et
                "En revue" ne sont pas modélisés par AlertStatus, ils restent
                donc à l'état "à venir" tant qu'ils ne le sont pas). */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {t.case_status_title}
              </h3>
              {(() => {
                const isInvestigating = ['investigation', 'corrective_action', 'closed', 'archived', 'reopened'].includes(selectedAlert.status);
                const isClosed = ['closed', 'archived'].includes(selectedAlert.status);
                type StepState = 'done' | 'current' | 'pending';
                const steps: { label: string; state: StepState; date?: string }[] = [
                  { label: t.case_status_received, state: 'done', date: selectedAlert.createdAt },
                  { label: t.case_status_investigation, state: isClosed ? 'done' : isInvestigating ? 'current' : 'pending', date: isInvestigating ? selectedAlert.updatedAt : undefined },
                  { label: t.case_status_pending_info, state: 'pending' },
                  { label: t.case_status_review, state: 'pending' },
                  { label: t.case_status_closed_step, state: isClosed ? 'done' : 'pending', date: selectedAlert.closedAt },
                ];
                return (
                  <ol>
                    {steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            step.state === 'done' ? 'bg-emerald-500 text-white' : step.state === 'current' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
                          }`}>
                            {step.state === 'done' ? <Check className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                          </span>
                          {i < steps.length - 1 && <span className="w-px flex-1 min-h-[22px] bg-slate-200" />}
                        </div>
                        <div className="pb-4">
                          <div className={`text-xs font-semibold ${step.state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>{step.label}</div>
                          {step.date && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(step.date).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                );
              })()}
            </div>

            {/* Informations complémentaires */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                {t.case_additional_info_title}
              </h3>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-500"><Lock className="w-3.5 h-3.5" />{t.case_origin_label}</span>
                <span className="font-semibold text-slate-800">
                  {selectedAlert.whistleblower.isAnonymous ? t.case_origin_anonymous : t.case_origin_identified}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1.5 text-slate-500"><ShieldAlert className="w-3.5 h-3.5" />{t.case_confidentiality_label}</span>
                <span className="font-semibold text-emerald-700">{t.case_confidentiality_high}</span>
              </div>
            </div>

            {/* Liens rapides */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-slate-400" />
                {t.case_quick_links_title}
              </h3>
              <button
                onClick={() => window.print()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                {t.case_btn_generate_report}
              </button>
              <button
                onClick={() => setActiveCaseTab('timeline')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                <History className="w-3.5 h-3.5 text-blue-600" />
                {t.case_btn_view_timeline}
              </button>
            </div>
          </aside>
          </div>
        </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 text-xs space-y-3">
            <p>Aucun dossier ne correspond à vos critères de filtrage.</p>
            <button
              onClick={() => setViewMode('list')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t.btn_back_to_list}
            </button>
          </div>
        ))}

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

            {/* === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
                Remplace la liste plate et non triée par le moteur de
                compatibilité : "Compatibles" (même pays+entité que le
                dossier) affichés en premier, puis "Autorisés Groupe"
                (périmètre vide) en second — jamais un enquêteur dont le
                périmètre ne correspond à aucun des deux par défaut, voir
                domain/assignmentEngine.ts. Chaque ligne affiche désormais
                aussi la charge de travail réelle (dossiers actifs/en
                retard), déjà calculée pour le Centre de Pilotage mais
                jusqu'ici invisible ici. */}
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {assignCandidates && assignCandidates.compatible.length === 0 && assignCandidates.groupAuthorized.length === 0 && (
                <p className="text-slate-500 text-[11px] italic p-2">
                  Aucun enquêteur compatible ou autorisé Groupe pour ce dossier (périmètre, confidentialité, conflit d'intérêt ou disponibilité).
                </p>
              )}

              {assignCandidates && assignCandidates.compatible.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Enquêteurs compatibles ({selectedAlert.concernedEntity})
                  </div>
                  {assignCandidates.compatible.map((c) => (
                    <AssignCandidateRow
                      key={c.user.id}
                      candidate={c}
                      checked={selectedInvestigatorIds.includes(c.user.id)}
                      onToggle={(checked) =>
                        setSelectedInvestigatorIds(
                          checked
                            ? [...selectedInvestigatorIds, c.user.id]
                            : selectedInvestigatorIds.filter((id) => id !== c.user.id)
                        )
                      }
                    />
                  ))}
                </div>
              )}

              {assignCandidates && assignCandidates.groupAuthorized.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                    Enquêteurs autorisés Groupe (vision Groupe)
                  </div>
                  {assignCandidates.groupAuthorized.map((c) => (
                    <AssignCandidateRow
                      key={c.user.id}
                      candidate={c}
                      checked={selectedInvestigatorIds.includes(c.user.id)}
                      onToggle={(checked) =>
                        setSelectedInvestigatorIds(
                          checked
                            ? [...selectedInvestigatorIds, c.user.id]
                            : selectedInvestigatorIds.filter((id) => id !== c.user.id)
                        )
                      }
                    />
                  ))}
                </div>
              )}
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
          MODAL: ESCALADE VERS LA DARC GROUPE */}
      {showEscalateModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Escalader vers la DARC Groupe</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Dossier {selectedAlert.trackingNumber} ({selectedAlert.concernedEntity}) — le pays et l'entité d'origine ne sont pas modifiés, seul le propriétaire du dossier change.
              </p>
            </div>

            {(() => {
              const criteria = evaluateEscalationCriteria(selectedAlert);
              return criteria.length > 0 ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                  <div className="font-bold text-rose-800">Critères d'escalade détectés (suggestion, non bloquant) :</div>
                  <ul className="list-disc list-inside text-rose-700 space-y-0.5">
                    {criteria.map((c) => (
                      <li key={c.key}>{c.label}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-slate-500 text-[11px] italic">
                  Aucun critère automatique détecté — l'escalade reste possible à la discrétion de l'opérateur/enquêteur.
                </p>
              );
            })()}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Propriétaire Groupe *</label>
              <select
                value={escalateOwnerId}
                onChange={(e) => setEscalateOwnerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                required
              >
                {getGroupEscalationOwners(allUsers).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.roleTitle}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Motif de l'escalade *</label>
              <textarea
                rows={3}
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Justification de l'escalade vers la DARC Groupe..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowEscalateModal(false)}
                className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                onClick={handleEscalate}
                disabled={!escalateReason.trim() || !escalateOwnerId}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
              >
                Confirmer l'escalade
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 6) === MODAL: ADD TASK */}
      {showAddTaskModal && selectedAlert && (
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
                <select
                  value={taskPriority}
                  onChange={(e: any) => setTaskPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="low">{t.task_priority_low}</option>
                  <option value="medium">{t.task_priority_medium}</option>
                  <option value="high">{t.task_priority_high}</option>
                </select>
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
      )}

      {/* MODAL: CLOSE CASE */}
      {showCloseModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Clôturer formellement le dossier {selectedAlert.trackingNumber}
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Vérification de complétude et information du lanceur d'alerte (CDC 3.1.3).
              </p>
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

      {/* === AMÉLIORATION AJOUTÉE (Phase 6) === MODAL: DECLARE CONFLICT OF INTEREST */}
      {showConflictModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.conflict_modal_title}</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {t.conflict_modal_subtitle} <span className="font-semibold text-slate-700">{activeUser.name}</span> — {selectedAlert.trackingNumber}
              </p>
            </div>

            <form onSubmit={handleDeclareConflict} className="space-y-3">
              <div className="space-y-2">
                <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${conflictOutcome === 'no_conflict' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="conflict-outcome" checked={conflictOutcome === 'no_conflict'} onChange={() => setConflictOutcome('no_conflict')} className="mt-0.5 accent-emerald-600" />
                  <span>
                    <span className="font-semibold text-slate-800 block">{t.conflict_outcome_none}</span>
                    <span className="text-slate-500 text-[11px]">{t.conflict_outcome_none_desc}</span>
                  </span>
                </label>
                <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition ${conflictOutcome === 'conflict_identified' ? 'border-rose-400 bg-rose-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="conflict-outcome" checked={conflictOutcome === 'conflict_identified'} onChange={() => setConflictOutcome('conflict_identified')} className="mt-0.5 accent-rose-600" />
                  <span>
                    <span className="font-semibold text-slate-800 block">{t.conflict_outcome_identified}</span>
                    <span className="text-slate-500 text-[11px]">{t.conflict_outcome_identified_desc}</span>
                  </span>
                </label>
              </div>

              {conflictOutcome === 'conflict_identified' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.conflict_details_label} *</label>
                  <textarea
                    rows={3}
                    value={conflictDetails}
                    onChange={(e) => setConflictDetails(e.target.value)}
                    placeholder={t.conflict_details_placeholder}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowConflictModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
                  {t.btn_cancel}
                </button>
                <button
                  type="submit"
                  disabled={conflictOutcome === 'conflict_identified' && !conflictDetails.trim()}
                  className="px-4 py-1.5 rounded-xl bg-[#0B2545] hover:bg-[#134074] disabled:opacity-40 text-white font-bold"
                >
                  {t.conflict_btn_submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
