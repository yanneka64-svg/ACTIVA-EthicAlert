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
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) ===
  ChevronLeft,
  // === AMÉLIORATION AJOUTÉE (Retours visuels — cartes d'info du dossier) ===
  Hourglass,
  // === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow riche) ===
  HelpCircle,
  Eye,
  // === AMÉLIORATION AJOUTÉE (Import d'un rapport d'investigation en fichier) ===
  X,
  // === AMÉLIORATION AJOUTÉE (Onglet Entretiens) ===
  Mic,
  // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors périmètre) ===
  Ban,
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
  CaseInterview,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
// section) === premier contenu d'onglet extrait dans son propre composant,
// voir src/components/investigation/CaseTimelineSection.tsx.
import { CaseTimelineSection } from './investigation/CaseTimelineSection';
import { PersonRow } from './investigation/PersonRow';
import { PersonsSection } from './investigation/PersonsSection';
import { EvidenceSection } from './investigation/EvidenceSection';
import { MessagesSection } from './investigation/MessagesSection';
import { CorrectiveMeasuresSection } from './investigation/CorrectiveMeasuresSection';
import { TasksSection } from './investigation/TasksSection';
import { InterviewsSection } from './investigation/InterviewsSection';
import { TriageSection } from './investigation/TriageSection';
import { ReportSection } from './investigation/ReportSection';
import { OverviewSection } from './investigation/OverviewSection';
import { PriorityModal } from './investigation/PriorityModal';
import { AddPersonModal } from './investigation/AddPersonModal';
import { LinkPersonModal } from './investigation/LinkPersonModal';
import { EscalateModal } from './investigation/EscalateModal';
import { DismissModal } from './investigation/DismissModal';
import { AddMeasureModal } from './investigation/AddMeasureModal';
import { AssignModal } from './investigation/AssignModal';
import { AddTaskModal } from './investigation/AddTaskModal';
import { getPriorityBadge } from './investigation/getPriorityBadge';
// === AMÉLIORATION AJOUTÉE (Notifications e-mail) ===
import { notifyAssignmentToInvestigators, notifyEscalationRecipient } from '../services/emailNotify';
import { StatusBadge, Breadcrumb, nocaColor, DataTable, ConfirmDialog } from './ui';
import type { DataTableColumn } from './ui';
// === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête ACTIVA) ===
import { CaseReportPrintView } from './CaseReportPrintView';
import { computeSlaStatus, deriveCaseStatus, applyCaseStatus } from '../services/statusMapping';
// === AMÉLIORATION AJOUTÉE (Phase 12.3 — remplacement du modèle de rôles) ===
import { isGlobalCaseViewer, userCan } from '../services/authz';
// === AMÉLIORATION AJOUTÉE (Phase 2 — évolution multi-pays/multi-entité) ===
import { useVisibleAlerts } from '../hooks/useVisibleAlerts';
// === AMÉLIORATION AJOUTÉE (Phase 4 — évolution multi-pays/multi-entité) ===
import { computeCandidates } from '../domain/assignmentEngine';
import { computeWorkload } from '../domain/workloadCalc';
// === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
import { evaluateEscalationCriteria } from '../domain/escalationCriteria';
// === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) === même
// regroupement en 5 paniers que le Tableau de bord (Phase 1), pour que les
// onglets de filtre affichent exactement les mêmes catégories.
import { AlertStatusBucket, getAlertStatusBucket, isRejectedBucket } from '../domain/alertStatusBuckets';
// === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
// Mêmes fonctions réelles que le formulaire public (AlertSubmissionFlow.tsx)
// pour l'évaluation de risque et la génération du code d'accès sécurisé —
// jamais réimplémentées à la main pour cette modale.
import { computeRiskEvaluation, formatCountryLabel } from '../data/activaConfig';
import { generateSalt, hashPassword, generateAccessPassword } from '../services/crypto';

// === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
// section) === `AssignCandidateRow` déplacé tel quel dans
// src/components/investigation/AssignCandidateRow.tsx, désormais partagé
// entre OperatorCaseDesk.tsx et AssignModal.tsx (plus utilisé directement
// ici depuis l'extraction de la modale d'attribution).

// === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
// section) === `LinkedAccountSelect` déplacé tel quel dans
// src/components/investigation/LinkedAccountSelect.tsx (importé ci-dessus),
// partagé entre AddPersonModal.tsx et LinkPersonModal.tsx.

// === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
// section) === `PersonRow` déplacé tel quel dans
// src/components/investigation/PersonRow.tsx (importé ci-dessus), partagé
// entre le résumé "Vue d'ensemble" ci-dessous et l'onglet "Personnes"
// dédié (voir PersonsSection.tsx).

interface InvestigationDeskProps {
  lang: Language;
  activeUser: UserProfile;
  // === AMÉLIORATION AJOUTÉE (Phase 5) ===
  // Lets a caller (the Control Panel's KPI cards / quick actions) land here
  // pre-filtered, per the brief's "Dashboard KPIs must link to filtered
  // case lists" requirement (§61). Read once at mount via the useState
  // initializers below.
  // === AMÉLIORATION AJOUTÉE (Correction bug — filtres de dossiers figés) ===
  // BUG PRÉEXISTANT CORRIGÉ : le commentaire ci-dessus supposait à tort que
  // ce composant était démonté/remonté par App.tsx à chaque changement
  // d'onglet — faux dès que deux onglets rendent ce même composant à la
  // même position de l'arbre (ex. "Boîte de réception" puis "Dossiers
  // traités") : React se contente alors de re-rendre avec de nouvelles
  // props, sans jamais réexécuter ces initialiseurs `useState`, donc le
  // filtre reste figé sur la toute première valeur vue. Chaque appelant
  // (App.tsx) doit désormais passer une `key` React qui change avec
  // `currentTab` (et avec le filtre effectif pour l'écran "Dossiers", qui
  // peut changer de dossier ciblé sans changer d'onglet) pour garantir un
  // vrai remontage — c'est cette clé, pas une hypothèse sur App.tsx, qui
  // fait maintenant que `initialFilter` est repris correctement à chaque
  // navigation.
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
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — À attribuer / Dossiers
  // attribués) === `excludeClosed` : "toutes les affaires nouvelles et en
  // cours" (À attribuer) — exclut ce qui est déjà en mesures correctives ou
  // clôturé/archivé, sans se limiter à un seul statut précis comme
  // `status` le fait déjà pour les autres écrans. `assignedOnly` :
  // "toutes les affaires attribuées" (Dossiers attribués, ex-"Dossiers
  // traités") — inverse exact de `unassignedOnly`, déjà existant.
  initialFilter?: {
    status?: string;
    unassignedOnly?: boolean;
    assignedOnly?: boolean;
    excludeClosed?: boolean;
    overdueOnly?: boolean;
    trackingNumber?: string;
    myCasesOnly?: boolean;
  };
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) === bouton
  // "+ Nouveau" de la maquette — optionnel, additif (chaque appelant qui ne
  // le passe pas garde simplement le bouton masqué, comportement inchangé).
  onCreateNewCase?: () => void;
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur) === Le bandeau de
  // métriques en haut de cet écran (Total/En cours/Prioritaires/Taux de
  // clôture) a du sens sur un écran générique ("Tous les dossiers"), mais
  // pas sur un écran déjà spécialisé (Boîte de réception, À attribuer,
  // Dossiers attribués, En attente d'infos) où il fait doublon avec le
  // vrai Tableau de bord — retiré uniquement pour ces appelants-là, jamais
  // par défaut (chaque appelant qui ne passe pas ce prop garde le bandeau,
  // comportement strictement inchangé).
  hideTopBanner?: boolean;
  // === AMÉLIORATION AJOUTÉE (Retours visuels — écran "Tableau de bord",
  // captures de référence) === Indépendant de `hideTopBanner` : un écran
  // peut vouloir garder son bandeau (ex. "Tableau de bord" Enquêteur,
  // délibérément conservé) tout en allégeant la barre de filtres à
  // Recherche + Entité (pas de "Pays" ici, jamais eu ce filtre). Avant cet
  // ajout, seul `hideTopBanner` gouvernait aussi ce choix — les deux
  // callers qui en avaient besoin (l'écran "Dossiers" pour un compte en
  // lecture seule) masquaient déjà le bandeau, donc ça suffisait ; ce
  // n'est plus vrai pour "Tableau de bord" Enquêteur.
  simplifiedFilters?: boolean;
  // === AMÉLIORATION AJOUTÉE (Retours visuels — écran "Tableau de bord",
  // captures de référence) === Masque la rangée d'onglets par panier de
  // statut (Tous/À traiter/En cours/...) et le bouton "+ Nouveau" — n'a de
  // sens que sur un écran déjà spécialisé par ailleurs (ex. un Tableau de
  // bord qui a ses propres cartes KPI), jamais par défaut.
  hideStatusTabsBar?: boolean;
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Boîte de réception) ===
  // La Boîte de réception est désormais le seul point d'entrée des
  // signalements publics ET permet l'échange avec le lanceur d'alerte :
  // ouvrir un dossier depuis cet écran doit donc mener directement à la
  // messagerie plutôt qu'à la synthèse — réutilise l'onglet "messages" déjà
  // réel du dossier (même mécanisme que l'onglet Communications interne).
  initialCaseTab?: 'overview' | 'messages';
}

export const InvestigationDesk: React.FC<InvestigationDeskProps> = ({
  lang,
  activeUser,
  initialFilter,
  onCreateNewCase,
  hideTopBanner = false,
  simplifiedFilters = false,
  hideStatusTabsBar = false,
  initialCaseTab,
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
  // === AMÉLIORATION AJOUTÉE (Refonte Opérateur) ===
  const [assignedOnlyFilter] = useState<boolean>(!!initialFilter?.assignedOnly);
  const [excludeClosedFilter] = useState<boolean>(!!initialFilter?.excludeClosed);
  const [overdueOnlyFilter, setOverdueOnlyFilter] = useState<boolean>(!!initialFilter?.overdueOnly);
  // === AMÉLIORATION AJOUTÉE (Phase 9 — écran dédié "Mes Dossiers") ===
  const [myCasesOnlyFilter] = useState<boolean>(!!initialFilter?.myCasesOnly);
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) === onglets
  // de filtre par panier de statut façon maquette — filtre plus large que
  // `statusFilter` (un panier regroupe plusieurs statuts réels). Initialisé
  // sur le panier du statut éventuellement précisé par `initialFilter`, pour
  // que l'onglet correspondant apparaisse déjà actif sur un deep link
  // existant (ex. depuis le Tableau de bord).
  const [bucketFilter, setBucketFilter] = useState<AlertStatusBucket | 'all'>(
    initialFilter?.status ? getAlertStatusBucket(initialFilter.status as AlertStatus) : 'all'
  );
  // Pagination façon maquette (10/page) — cet écran affichait jusqu'ici
  // l'intégralité de la liste sans découpage.
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Selected case active tab
  // === AMÉLIORATION AJOUTÉE (Phase 11 — 9 onglets exacts de la maquette) ===
  // 'persons' et 'evidence_tab' sont de nouveaux onglets dédiés. 'report'
  // regroupe désormais 3 contenus existants qui n'ont pas d'onglet dédié
  // dans la maquette (notes d'enquête internes, mesures correctives... non,
  // uniquement notes internes + conflit d'intérêt) sous un seul onglet
  // "Rapport", en plus d'une synthèse — rien n'est supprimé, tout reste
  // accessible, juste réorganisé. 'triage' s'affiche sous le libellé
  // "Allégations" (contenu existant enrichi d'un résumé de la qualification).
  const [activeCaseTab, setActiveCaseTab] = useState<'overview' | 'messages' | 'corrective' | 'tasks' | 'interviews' | 'timeline' | 'triage' | 'persons' | 'evidence_tab' | 'report'>(initialCaseTab ?? 'overview');

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

  // === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow riche —
  // étapes "En attente d'informations" et "En revue" désormais atteignables)
  // === `domain/workflow.ts`/`storage.transitionStatus()` existaient déjà,
  // entièrement testés (storage.transitionStatus.test.ts), mais n'étaient
  // appelés par aucun écran — ces deux étapes de la timeline "STATUT DU
  // DOSSIER" restaient donc en permanence grisées ("à venir"), quel que
  // soit le dossier. Ces 2 nouvelles actions les rendent réellement
  // franchissables, sans toucher à la logique de clôture existante
  // (handleCloseAlert), qui continue de fonctionner exactement comme avant.
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [requestInfoReason, setRequestInfoReason] = useState<string>('');

  // === AMÉLIORATION AJOUTÉE (Rapport d'investigation obligatoire avant
  // l'envoi en revue) === "Envoyer en revue" n'apparaît dans le menu
  // Actions qu'une fois ce rapport renseigné (texte ET/OU fichier importé —
  // selectedAlert.investigationReport / investigationReportFile).
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDraft, setReportDraft] = useState('');
  const [reportFile, setReportFile] = useState<EvidenceFile | undefined>(undefined);
  const reportFileInputRef = useRef<HTMLInputElement>(null);

  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState<string>('');
  const [escalateOwnerId, setEscalateOwnerId] = useState<string>('');

  // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
  // périmètre) === `CaseStatus` (domain/caseTypes.ts, 14 valeurs) prévoyait
  // déjà 'duplicate'/'out_of_scope', structurellement atteignables depuis
  // 'new' (ALLOWED_TRANSITIONS, domain/workflow.ts) — mais aucun écran ne
  // les proposait, les rendant de fait inaccessibles (constat de l'analyse
  // critique du frontend). Réutilise storage.transitionStatus(), déjà réel
  // pour pending_information/conclusion_pending/functional_review, jamais
  // un nouveau mécanisme parallèle.
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [dismissTargetStatus, setDismissTargetStatus] = useState<'duplicate' | 'out_of_scope'>('duplicate');
  const [dismissReason, setDismissReason] = useState<string>('');

  // Note & Message inputs
  const [internalNoteText, setInternalNoteText] = useState<string>('');
  const [investigatorMsgText, setInvestigatorMsgText] = useState<string>('');

  // === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête ACTIVA) ===
  // Dès que `showPrintReport` passe à true, CaseReportPrintView.tsx (rendu
  // plus bas, cf. `.print-only` dans index.css) devient le SEUL contenu
  // visible dans la boîte de dialogue d'impression du navigateur — jamais
  // toute la page comme auparavant (BUG PRÉEXISTANT CORRIGÉ, signalé par
  // l'utilisateur). Un seul modèle désormais (synthèse), sur demande
  // explicite — plus besoin du menu de choix entre plusieurs modèles.
  const [showPrintReport, setShowPrintReport] = useState(false);

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

  // === AMÉLIORATION AJOUTÉE (Onglet Entretiens — branchement de
  // storage.addInterview(), jusqu'ici écrit et testé mais jamais appelé par
  // aucun écran) === même gabarit que le formulaire "+Nouvelle tâche"
  // ci-dessus.
  const [showAddInterviewModal, setShowAddInterviewModal] = useState(false);
  const [interviewIntervieweeName, setInterviewIntervieweeName] = useState('');
  const [interviewLinkedPersonId, setInterviewLinkedPersonId] = useState('');
  const [interviewScheduledAt, setInterviewScheduledAt] = useState('');
  const [interviewSummary, setInterviewSummary] = useState('');
  const [interviewStatus, setInterviewStatus] = useState<CaseInterview['status']>('planned');

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
  // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
  // Rattachement (facultatif) de la personne en cours de création à un
  // compte réel de la plateforme.
  const [personLinkedUserId, setPersonLinkedUserId] = useState('');
  // Édition du rattachement d'une personne/témoin déjà enregistré·e — aucun
  // handleEditPerson générique n'existait avant cette phase (seul
  // handleAddPerson, pour la création), d'où un état dédié plutôt que de
  // réutiliser addPersonKind (formulaire de création différent : nom/
  // fonction/niveau hiérarchique).
  const [linkingPerson, setLinkingPerson] = useState<{ kind: 'subject' | 'witness'; id: string; currentName: string } | null>(null);
  const [linkingUserId, setLinkingUserId] = useState('');
  const evidenceFileInputRef = useRef<HTMLInputElement>(null);

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
  // Modale courte à 3 étapes (Informations/Classification/Validation),
  // réservée aux opérateurs (décision confirmée par l'utilisateur : pas de
  // questionnaire de risque complet ici — le dossier créé reçoit un niveau
  // par défaut NOCA 2, ajustable ensuite depuis l'onglet Allégations
  // existant, exactement comme pour tout autre dossier). Réutilise le
  // même mécanisme réel que le formulaire public
  // (AlertSubmissionFlow.tsx) pour tout ce qui doit rester honnête :
  // numéro de suivi, code d'accès salé/haché, évaluation de risque via la
  // vraie fonction `computeRiskEvaluation` (jamais un objet RiskEvaluation
  // inventé à la main), délai cible dérivé de la config SLA réelle.
  const [showCreateCaseModal, setShowCreateCaseModal] = useState(false);
  const [createCaseStep, setCreateCaseStep] = useState<1 | 2 | 3>(1);
  const [newCaseObjet, setNewCaseObjet] = useState('');
  const [newCaseCountry, setNewCaseCountry] = useState('');
  const [newCaseEntity, setNewCaseEntity] = useState('');
  const [newCaseCategory, setNewCaseCategory] = useState('');
  const [newCaseSubCategory, setNewCaseSubCategory] = useState('');
  const [isCreatingCase, setIsCreatingCase] = useState(false);

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
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
  const countries = storage.getCountries();
  const categoriesConfig = storage.getCategories();
  const newCaseEntityOptions = newCaseCountry ? entities.filter((e) => e.country === newCaseCountry) : entities;
  const newCaseSubCategoryOptions = categoriesConfig.find((c) => c.name === newCaseCategory)?.subCategories ?? [];
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

  // === AMÉLIORATION AJOUTÉE (Phase 6 — routage indépendant) ===
  // Ce compte a-t-il été exclu par le routage indépendant d'au moins un
  // dossier (brief §47-68) ? Réutilise `independentRoutingExcludedUserIds`
  // (déjà posé par storage.triggerIndependentRouting, Phase 4) plutôt que
  // de redériver la liste des personnes mises en cause depuis ce composant
  // — évite aussi de sous-compter un dossier déjà routé ailleurs (le champ
  // est déjà calculé une fois pour toutes par le moteur de routage). Un
  // simple booléen, jamais un nombre affiché : le bandeau ci-dessous ne
  // révèle ni combien de dossiers, ni lesquels, ni pourquoi.
  const hasConfidentialRoutingExclusion = alerts.some((a) =>
    (a.independentRoutingExcludedUserIds ?? []).includes(activeUser.id)
  );

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) ===
  // Filtres "hors statut" calculés séparément (entité/NOCA/non-attribués/
  // en retard/mes dossiers/recherche) — même logique qu'avant, simplement
  // isolée pour que les compteurs des onglets de statut ci-dessous
  // (bucketTabCounts) reflètent ces filtres en direct sans dupliquer cette
  // logique une seconde fois.
  const preStatusFilteredAlerts = baseVisibleAlerts.filter(alert => {
    // Entity filter
    if (entityFilter !== 'all' && alert.concernedEntity !== entityFilter) return false;

    // NOCA filter
    if (nocaFilter !== 'all' && alert.riskEvaluation.nocaThreshold !== nocaFilter) return false;

    // === AMÉLIORATION AJOUTÉE (Phase 5) === Control-Panel-driven filters
    if (unassignedOnlyFilter && alert.assignedInvestigators.length > 0) return false;
    // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Dossiers attribués) ===
    // Inverse exact de `unassignedOnlyFilter` ci-dessus.
    if (assignedOnlyFilter && alert.assignedInvestigators.length === 0) return false;
    // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — À attribuer) === "toutes
    // les affaires nouvelles et en cours" : exclut ce qui est déjà en
    // mesures correctives ou clôturé/archivé, sans se limiter à un seul
    // statut précis (contrairement à `statusFilter`, toujours disponible en
    // plus pour un affinage manuel).
    if (excludeClosedFilter && (alert.status === 'corrective_action' || alert.status === 'closed' || alert.status === 'archived')) return false;
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

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) ===
  // Compteurs des onglets de filtre par panier (façon maquette : Tous/À
  // traiter/En cours/En attente/Clôturés/Rejetés) — "rejetes" reste
  // honnêtement à 0 aujourd'hui (voir domain/alertStatusBuckets.ts).
  const bucketTabCounts: Record<AlertStatusBucket | 'all', number> = {
    all: preStatusFilteredAlerts.length,
    a_traiter: preStatusFilteredAlerts.filter((a) => getAlertStatusBucket(a.status) === 'a_traiter').length,
    en_cours: preStatusFilteredAlerts.filter((a) => getAlertStatusBucket(a.status) === 'en_cours').length,
    en_attente: preStatusFilteredAlerts.filter((a) => getAlertStatusBucket(a.status) === 'en_attente').length,
    clotures: preStatusFilteredAlerts.filter((a) => getAlertStatusBucket(a.status) === 'clotures').length,
    rejetes: preStatusFilteredAlerts.filter((a) => isRejectedBucket(a.status)).length,
  };

  const visibleAlerts = preStatusFilteredAlerts.filter(alert => {
    // === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) ===
    // Onglet de panier (large, façon maquette) — se combine sans conflit
    // avec `statusFilter` (plus précis, toujours utilisé par les deep links
    // existants type `{ status: 'new' }`) : un panier est toujours un
    // sur-ensemble d'un statut précis, donc les deux peuvent s'appliquer
    // ensemble sans jamais se contredire.
    if (bucketFilter !== 'all' && getAlertStatusBucket(alert.status) !== bucketFilter) return false;
    // Status filter
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    return true;
  });

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) ===
  // Pagination façon maquette (10 dossiers/page) — la page revient à 1 dès
  // qu'un filtre change, pour ne jamais rester bloqué sur une page devenue
  // vide.
  const totalPages = Math.max(1, Math.ceil(visibleAlerts.length / PAGE_SIZE));
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, entityFilter, nocaFilter, bucketFilter, searchQuery, unassignedOnlyFilter, overdueOnlyFilter]);
  const pagedAlerts = visibleAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Currently active selected alert
  // Only auto-falls-back to the first visible case while actually in detail
  // mode (e.g. a trackingNumber deep link narrows the search to one match) —
  // in list mode there is deliberately no "current" case.
  const selectedAlert = alerts.find(a => a.id === selectedAlertId) || (viewMode === 'detail' ? visibleAlerts[0] : undefined) || null;

  // === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête ACTIVA) ===
  // Laisse React monter CaseReportPrintView (rendu conditionnellement sur
  // `showPrintReport`, plus bas dans ce composant) avant d'appeler
  // `window.print()`, qui n'imprime alors QUE ce contenu grâce aux règles
  // `.print-only`/`@media print` (index.css) — jamais le reste de l'app.
  useEffect(() => {
    if (!showPrintReport || !selectedAlert) return;
    const timer = window.setTimeout(() => {
      window.print();
      setShowPrintReport(false);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [showPrintReport, selectedAlert]);

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

    // === AMÉLIORATION AJOUTÉE (Notifications e-mail) === notifie
    // uniquement les enquêteurs NOUVELLEMENT attribués (jamais ceux déjà
    // attribués avant ce changement, pour ne pas les renotifier à chaque
    // modification mineure de l'attribution).
    const previouslyAssigned = new Set(selectedAlert.assignedInvestigators);
    const newlyAssignedUsers = investigatorUsers.filter(
      (u) => selectedInvestigatorIds.includes(u.id) && !previouslyAssigned.has(u.id)
    );
    if (newlyAssignedUsers.length > 0) {
      notifyAssignmentToInvestigators(newlyAssignedUsers, { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber }, activeUser);
    }

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

    // === AMÉLIORATION AJOUTÉE (Refonte Opérateur — Suivi des
    // recommandations) === `closedAt` renseignée uniquement si la mesure
    // est créée directement au statut "Vérifiée" — aucun autre point du
    // code ne change le statut d'une mesure existante aujourd'hui, donc
    // c'est le seul moment où cette transition peut réellement survenir.
    const now = new Date().toISOString();
    const newMeasure: CorrectiveMeasure = {
      id: 'cm-' + Date.now(),
      title: measureTitle.trim(),
      description: measureDesc.trim(),
      responsiblePerson: measureResp.trim() || 'Direction Concernée',
      dueDate: measureDueDate || now.split('T')[0],
      status: measureStatus,
      documentedBy: activeUser.name,
      documentedAt: now,
      closedAt: measureStatus === 'verified' ? now : undefined,
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

  // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
  // Construit un AlertRecord complet et honnête à partir de la saisie
  // courte de la modale — même mécanique que AlertSubmissionFlow.tsx
  // (numéro de suivi, code d'accès salé/haché, délai cible dérivé de la
  // config SLA réelle), avec un niveau de risque par défaut NOCA 2
  // (impact financier/niveau hiérarchique/récidive/réputation = 2 sur 4
  // chacun, via la vraie fonction `computeRiskEvaluation` — jamais un
  // score inventé à la main), à affiner ensuite depuis l'onglet
  // Allégations comme pour tout autre dossier.
  const handleCreateCase = async () => {
    if (!newCaseObjet.trim() || !newCaseCountry || !newCaseEntity || !newCaseCategory || !newCaseSubCategory) return;
    setIsCreatingCase(true);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingNumber = `ACT-2026-${randomSuffix}`;
    const generatedPassword = generateAccessPassword();
    const accessCodeSalt = generateSalt();
    const accessCodeHash = await hashPassword(generatedPassword, accessCodeSalt);

    const slaConfig = storage.getSlaConfig();
    const riskEvaluation = computeRiskEvaluation(2, 2, 2, 2, slaConfig);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + slaConfig.noca2Days);

    const newRecord: AlertRecord = {
      id: 'alt-' + Date.now(),
      trackingNumber,
      accessCodeHash,
      accessCodeSalt,
      // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
      // 'direct' : dossier saisi directement par un opérateur (téléphone,
      // rencontre en personne...), distinct de 'web' (formulaire public
      // en ligne) et 'qr_code' — les 3 valeurs réelles du canal existant.
      channel: 'direct',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetCompletionDate: targetDate.toISOString(),
      confidentialityLevel: 'confidential',
      whistleblower: { isAnonymous: true, declarantType: 'Employé' },
      category: newCaseCategory,
      subCategory: newCaseSubCategory,
      detailedDescription: newCaseObjet.trim(),
      incidentDates: t.create_case_dates_unspecified,
      incidentLocation: newCaseEntity,
      concernedEntity: newCaseEntity,
      country: newCaseCountry,
      riskEvaluation,
      impactType: newCaseCategory,
      involvedPersons: [],
      witnesses: [],
      evidences: [],
      status: 'new',
      assignedInvestigators: [],
      assignedInvestigatorNames: [],
      internalNotes: [],
      messages: [
        {
          id: 'msg-init',
          sender: 'admin',
          senderDisplayName: `DARC (${activeUser.name})`,
          content: `Dossier créé par ${activeUser.name} sous la référence ${trackingNumber}. Classification provisoire : ${riskEvaluation.nocaThreshold} (${riskEvaluation.expectedTreatment}).`,
          createdAt: new Date().toISOString(),
        },
      ],
      correctiveMeasures: [],
    };

    storage.saveAlert(newRecord);
    storage.logAudit(
      'ALERT_SUBMITTED',
      `Nouveau dossier créé par un opérateur : ${trackingNumber} (${newRecord.category} - ${newRecord.concernedEntity}). Classification provisoire : ${riskEvaluation.nocaThreshold}.`,
      { id: newRecord.id, trackingNumber: newRecord.trackingNumber },
      activeUser
    );

    setIsCreatingCase(false);
    setShowCreateCaseModal(false);
    setCreateCaseStep(1);
    setNewCaseObjet('');
    setNewCaseCountry('');
    setNewCaseEntity('');
    setNewCaseCategory('');
    setNewCaseSubCategory('');
    setSelectedAlertId(newRecord.id);
    setViewMode('detail');
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

  // === AMÉLIORATION AJOUTÉE (Onglet Entretiens) === storage.addInterview,
  // même motif audit que handleAddTask ci-dessus. La personne entendue peut
  // être liée à une entrée réelle de "Personnes impliquées"/"Témoins" (son
  // nom est alors repris tel quel, jamais dupliqué à la main) ou saisie
  // librement (entretien avec un tiers externe au dossier).
  const handleAddInterview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    const linkedPerson = interviewLinkedPersonId
      ? [...selectedAlert.involvedPersons, ...selectedAlert.witnesses].find((p) => p.id === interviewLinkedPersonId)
      : undefined;
    const intervieweeName = linkedPerson?.name ?? interviewIntervieweeName.trim();
    if (!intervieweeName) return;

    const newInterview: CaseInterview = {
      id: 'itv-' + Date.now(),
      intervieweeName,
      intervieweePersonId: linkedPerson?.id,
      scheduledAt: interviewScheduledAt || undefined,
      conductedAt: interviewStatus === 'completed' ? new Date().toISOString() : undefined,
      conductedBy: activeUser.name,
      summary: interviewSummary.trim() || undefined,
      status: interviewStatus,
    };

    storage.addInterview(selectedAlert.id, newInterview, activeUser);

    setInterviewIntervieweeName('');
    setInterviewLinkedPersonId('');
    setInterviewScheduledAt('');
    setInterviewSummary('');
    setInterviewStatus('planned');
    setShowAddInterviewModal(false);
  };

  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
  // section) === `taskEffectiveStatus` déplacée telle quelle dans
  // src/components/investigation/TasksSection.tsx (importé ci-dessus),
  // son seul appelant.

  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
  // section) === `RISK_AXIS_LABELS` déplacée telle quelle dans
  // src/components/investigation/TriageSection.tsx, son seul appelant.

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
        // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
        linkedUserId: personLinkedUserId || undefined,
      };
      storage.saveAlert({ ...selectedAlert, involvedPersons: [...selectedAlert.involvedPersons, entry], updatedAt: new Date().toISOString() });
    } else {
      const entry: Witness = {
        id: 'wit-' + Date.now(),
        name: personNameInput.trim(),
        position: personPositionInput.trim(),
        hierarchyRole: personHierarchyInput,
        // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
        linkedUserId: personLinkedUserId || undefined,
      };
      storage.saveAlert({ ...selectedAlert, witnesses: [...selectedAlert.witnesses, entry], updatedAt: new Date().toISOString() });
    }
    // === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
    // Un rattachement défini dès la création déclenche immédiatement le
    // routage indépendant (storage.triggerIndependentRouting, Phase 4).
    if (personLinkedUserId) {
      const fallbackRecipient = storage.triggerIndependentRouting(selectedAlert.id, activeUser);
      // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et
      // de routage) === Aucune autorité interne trouvée → notifie le
      // destinataire de dernier recours identifié par storage.ts.
      if (fallbackRecipient) {
        notifyEscalationRecipient(fallbackRecipient, selectedAlert, activeUser, 'Routage indépendant non résolu — intervention manuelle requise');
      }
    }
    setAddPersonKind(null);
    setPersonNameInput('');
    setPersonPositionInput('');
    setPersonHierarchyInput('Employé');
    // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
    setPersonLinkedUserId('');
  };

  // === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) ===
  // Rattache (ou modifie le rattachement) d'une personne/témoin déjà
  // enregistré·e à un compte réel de la plateforme. Dès que le
  // rattachement résultant est défini (nouveau lien ou changement de
  // compte lié), déclenche le routage indépendant (Phase 4) — voir
  // storage.triggerIndependentRouting ci-dessous.
  const handleLinkPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert || !linkingPerson) return;
    const resolvedUserId = linkingUserId || undefined;
    if (linkingPerson.kind === 'subject') {
      const involvedPersons = selectedAlert.involvedPersons.map((p) =>
        p.id === linkingPerson.id ? { ...p, linkedUserId: resolvedUserId } : p
      );
      storage.saveAlert({ ...selectedAlert, involvedPersons, updatedAt: new Date().toISOString() });
    } else {
      const witnesses = selectedAlert.witnesses.map((w) =>
        w.id === linkingPerson.id ? { ...w, linkedUserId: resolvedUserId } : w
      );
      storage.saveAlert({ ...selectedAlert, witnesses, updatedAt: new Date().toISOString() });
    }
    // === AMÉLIORATION AJOUTÉE (Phase 4 — routage indépendant) ===
    if (resolvedUserId) {
      const fallbackRecipient = storage.triggerIndependentRouting(selectedAlert.id, activeUser);
      if (fallbackRecipient) {
        notifyEscalationRecipient(fallbackRecipient, selectedAlert, activeUser, 'Routage indépendant non résolu — intervention manuelle requise');
      }
    }
    setLinkingPerson(null);
    setLinkingUserId('');
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
        // === AMÉLIORATION AJOUTÉE (Retours visuels — refonte "Preuves &
        // pièces jointes") === seul point réel de dépôt côté staff : trace
        // qui a versé ce document, affiché tel quel dans le registre
        // transverse (EvidenceRegistry.tsx).
        uploadedBy: activeUser.name,
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
      alert("La documentation préalable d'au moins une mesure corrective est obligatoire avant toute clôture de dossier.");
      setActiveCaseTab('corrective');
      setShowCloseModal(false);
      return;
    }

    const updatedAlert: AlertRecord = {
      // === AMÉLIORATION AJOUTÉE (Risque de désynchronisation des statuts —
      // cause racine) === `applyCaseStatus` remplace la construction
      // manuelle `status: 'closed', workflowStatus: 'closed'` — mêmes deux
      // champs, mais désormais écrits ensemble par construction (voir
      // services/statusMapping.ts) : sans cela, un dossier dont
      // `workflowStatus` a été renseigné par le moteur riche (ex. passé par
      // "Envoyer en revue") restait figé sur 'conclusion_pending'/
      // 'functional_review' après sa clôture legacy — la timeline "STATUT
      // DU DOSSIER" affichait alors "En revue" comme étape courante en même
      // temps que "Clôturé" comme faite, une incohérence visuelle réelle
      // (bug déjà corrigé, ce refactor n'en change pas le comportement).
      ...applyCaseStatus(selectedAlert, 'closed'),
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
      // === AMÉLIORATION AJOUTÉE (Risque de désynchronisation des statuts —
      // cause racine) === `applyCaseStatus` remplace la construction
      // manuelle — même synchronisation que handleCloseAlert : un dossier
      // rouvert depuis 'conclusion_pending'/'functional_review' ne doit
      // plus afficher "En revue" comme étape courante.
      ...applyCaseStatus(selectedAlert, 'reopened'),
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

  // === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow riche) ===
  // Statut riche courant (14 valeurs) — `workflowStatus` s'il a déjà été
  // renseigné par une de ces actions, sinon dérivé du statut legacy
  // (`deriveCaseStatus`, déjà utilisé par storage.transitionStatus()
  // lui-même) pour qu'un dossier jamais touché par ce nouveau chemin
  // affiche des actions cohérentes dès le premier clic.
  const currentWorkflowStatus = selectedAlert ? selectedAlert.workflowStatus ?? deriveCaseStatus(selectedAlert) : undefined;

  // "Demander des informations complémentaires" (investigation → pending_information).
  // Horodate `pendingInfoReachedAt` une seule fois (première visite réelle),
  // pour que la timeline puisse plus tard cocher cette étape honnêtement.
  const handleRequestInfo = () => {
    if (!selectedAlert || !requestInfoReason.trim()) return;
    const result = storage.transitionStatus(selectedAlert.id, 'pending_information', activeUser, requestInfoReason.trim());
    if (result.allowed) {
      const fresh = storage.getAlerts().find((a) => a.id === selectedAlert.id);
      if (fresh && !fresh.pendingInfoReachedAt) {
        storage.saveAlert({ ...fresh, pendingInfoReachedAt: new Date().toISOString() });
      }
    }
    setShowRequestInfoModal(false);
    setRequestInfoReason('');
  };

  // "Reprendre l'investigation" — depuis pending_information, conclusion_pending
  // ou functional_review, toutes structurellement valides vers investigation
  // (domain/workflow.ts, ALLOWED_TRANSITIONS).
  const handleResumeInvestigation = () => {
    if (!selectedAlert) return;
    storage.transitionStatus(selectedAlert.id, 'investigation', activeUser);
  };

  // === AMÉLIORATION AJOUTÉE (Rapport d'investigation obligatoire avant
  // l'envoi en revue) === "Rédiger le rapport d'investigation" — texte et/ou
  // fichier importé (au moins l'un des deux), horodaté/attribué (pas de
  // statut ni de transition, juste du contenu documentant le dossier),
  // condition d'apparition de "Envoyer en revue" dans le menu Actions
  // ci-dessous. Toujours le même libellé "Rédiger", qu'un rapport existe
  // déjà ou non — rédiger de nouveau REMPLACE le contenu précédent plutôt
  // que de prétendre à une distinction "création"/"modification" qui
  // n'apporte rien ici (pas d'historique de versions).
  const handleSaveInvestigationReport = () => {
    if (!selectedAlert || (!reportDraft.trim() && !reportFile)) return;
    storage.saveAlert({
      ...selectedAlert,
      investigationReport: reportDraft.trim() || undefined,
      investigationReportFile: reportFile,
      investigationReportBy: activeUser.name,
      investigationReportAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    storage.logAudit(
      'INVESTIGATION_REPORT_SAVED',
      `Rapport d'investigation rédigé pour le dossier ${selectedAlert.trackingNumber} par ${activeUser.name}.`,
      { id: selectedAlert.id, trackingNumber: selectedAlert.trackingNumber },
      activeUser
    );
    setShowReportModal(false);
    setReportDraft('');
    setReportFile(undefined);
  };

  // === AMÉLIORATION AJOUTÉE (Import d'un rapport d'investigation en
  // fichier) === Même mécanique de lecture que handleAddEvidenceFile
  // ci-dessus (FileReader → dataUrl) mais reste local à la modale
  // (`reportFile`, pas storage.saveAlert direct) : le fichier n'est
  // persisté qu'au clic sur "Enregistrer le rapport", comme le texte.
  const handleImportReportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReportFile({
        id: 'ev-report-' + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
        uploadedBy: activeUser.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // "Envoyer en revue" — enchaîne investigation → conclusion_pending →
  // functional_review (les 2 sous-étapes distinctes du moteur riche) en un
  // seul geste utilisateur, l'écran "STATUT DU DOSSIER" n'ayant qu'une
  // seule étape visuelle "En revue" pour les deux. Horodate
  // `reviewReachedAt` une seule fois (première visite réelle).
  const handleSendToReview = () => {
    if (!selectedAlert) return;
    const step1 = storage.transitionStatus(selectedAlert.id, 'conclusion_pending', activeUser);
    if (!step1.allowed) return;
    const step2 = storage.transitionStatus(selectedAlert.id, 'functional_review', activeUser);
    if (step2.allowed) {
      const fresh = storage.getAlerts().find((a) => a.id === selectedAlert.id);
      if (fresh && !fresh.reviewReachedAt) {
        storage.saveAlert({ ...fresh, reviewReachedAt: new Date().toISOString() });
      }
    }
  };

  // === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
  // === AMÉLIORATION AJOUTÉE (Registre des destinataires d'escalade et de
  // routage) === `escalateOwnerId` référence désormais un
  // EscalationRecipient.id (registre admin-éditable) — storage.escalateAlert
  // gère lui-même l'octroi d'accès réel (compte lié) et retourne le
  // destinataire complet pour la notification e-mail ci-dessous.
  const handleEscalate = () => {
    if (!selectedAlert || !escalateReason.trim() || !escalateOwnerId) return;
    const criteriaMatched = evaluateEscalationCriteria(selectedAlert).map((c) => c.label);
    const result = storage.escalateAlert(selectedAlert.id, escalateReason.trim(), criteriaMatched, escalateOwnerId, activeUser);
    if (result.allowed) {
      if (result.recipient) {
        notifyEscalationRecipient(result.recipient, selectedAlert, activeUser, 'Dossier escaladé');
      }
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

  // === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
  // périmètre) === Structurellement valide uniquement depuis 'new'
  // (ALLOWED_TRANSITIONS), donc réservé aux dossiers pas encore attribués —
  // évite tout chevauchement avec la clôture normale (handleCloseAlert),
  // qui exige au moins une allégation documentée (§25) : un doublon/hors
  // périmètre n'a par nature rien à documenter.
  const handleDismissCase = () => {
    if (!selectedAlert || !dismissReason.trim()) return;
    const result = storage.transitionStatus(selectedAlert.id, dismissTargetStatus, activeUser, dismissReason.trim());
    if (result.allowed) {
      setShowDismissModal(false);
      setDismissReason('');
      setDismissTargetStatus('duplicate');
    }
  };

  // Archive Alert (CDC 3.1.3)
  const handleArchiveAlert = () => {
    if (!selectedAlert) return;

    const updatedAlert: AlertRecord = {
      // === AMÉLIORATION AJOUTÉE (Risque de désynchronisation des statuts —
      // cause racine) === `applyCaseStatus` remplace la construction
      // manuelle — même synchronisation que handleCloseAlert.
      ...applyCaseStatus(selectedAlert, 'archived'),
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
  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
  // section) === `getPriorityBadge` déplacée telle quelle dans
  // src/components/investigation/getPriorityBadge.tsx (importé ci-dessus),
  // partagée avec le nouvel onglet "Allégations" extrait (TriageSection.tsx).

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
      {/* === AMÉLIORATION AJOUTÉE (Refonte Opérateur) === Bandeau de
          métriques masqué sur les écrans déjà spécialisés (voir prop
          `hideTopBanner` ci-dessus) — sans changer son contenu ni son
          comportement pour les appelants qui le gardent (ex. "Tous les
          dossiers").
          === AMÉLIORATION AJOUTÉE (Retours visuels — fiche dossier sans
          bandeau ni barre de filtres) === BUG PRÉEXISTANT CORRIGÉ,
          signalé par l'utilisateur (capture de référence) : ce bandeau
          s'affichait aussi en mode détail (`viewMode === 'detail'`, ex. un
          lien profond `/cases/:trackingNumber` depuis "Dossiers
          attribués") alors qu'il n'a de sens qu'au-dessus d'une LISTE.
          Ajout de `viewMode === 'list'` à la condition — comportement
          inchangé en liste, bandeau désormais absent en détail, quel que
          soit l'écran d'où l'on arrive. */}
      {!hideTopBanner && viewMode === 'list' && (
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
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 6 — routage indépendant) ===
          Bandeau neutre : jamais de nombre, jamais de nom, jamais de motif —
          uniquement une mention générique de l'existence du mécanisme, pour
          ne révéler à aucun utilisateur exclu qu'un dossier précis le
          concerne. Visible quel que soit viewMode (liste ou détail), sur
          toutes les routes /operator/ et /investigator/ qui réutilisent
          cet écran. */}
      {hasConfidentialRoutingExclusion && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Certains signalements sont soumis à un routage confidentiel.</span>
        </div>
      )}

      {/* === AMÉLIORATION AJOUTÉE (Retours visuels — fiche dossier sans
          bandeau ni barre de filtres) === même correction que le bandeau
          ci-dessus (BUG PRÉEXISTANT CORRIGÉ) : cette barre de filtres n'a de
          sens qu'au-dessus d'une LISTE — elle s'affichait aussi en mode
          détail.
          === AMÉLIORATION AJOUTÉE (Retours visuels — écran "Dossiers",
          même correction que côté Opérateur ; puis écran "Tableau de bord"
          Enquêteur, captures de référence) === BUG PRÉEXISTANT CORRIGÉ,
          signalé par l'utilisateur : ces écrans gardaient encore la barre
          de filtres complète (Statut/Entité/Criticité NOCA + 2 cases à
          cocher) alors que les écrans Opérateur sœurs (À attribuer, En
          attente d'infos, Dossiers attribués) avaient déjà été allégés à
          Recherche + Entité (pas de "Pays" ici : cet écran n'a jamais eu ce
          filtre, contrairement à `OperatorCaseDesk`). Gouverné par
          `simplifiedFilters`, indépendant de `hideTopBanner` (le Tableau de
          bord Enquêteur garde son bandeau tout en simplifiant cette barre).
          Les états (statusFilter/nocaFilter/les 2 cases) restent inchangés
          dans le code — seuls leurs contrôles disparaissent de cette
          variante. */}
      {viewMode === 'list' && simplifiedFilters && (
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
        {(entityFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => { setEntityFilter('all'); setSearchQuery(''); }}
            className="text-blue-700 hover:underline font-semibold"
          >
            Réinitialiser filtres
          </button>
        )}
      </div>
      )}
      {viewMode === 'list' && !simplifiedFilters && (
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
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 6 — liste et détail séparés) ===
          A real dedicated list screen and a real dedicated full-width detail
          screen, shown one at a time via viewMode — replacing the previous
          always-both split-pane. Same data, same filters, same handlers. */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) ===
              Onglets de filtre par panier de statut + bouton "+ Nouveau",
              façon maquette. Les filtres détaillés existants (recherche,
              statut précis, entité, NOCA, non-attribués, en retard) restent
              inchangés dans le bloc "Filtre bar" juste au-dessus — rien
              n'est retiré, ce nouveau raccourci s'ajoute simplement.
              === AMÉLIORATION AJOUTÉE (Retours visuels — écran "Tableau de
              bord" Enquêteur, capture de référence) === BUG PRÉEXISTANT
              CORRIGÉ, signalé par l'utilisateur : masquable via
              `hideStatusTabsBar` — un Tableau de bord a déjà ses propres
              cartes KPI juste au-dessus, cette rangée y fait doublon. */}
          {!hideStatusTabsBar && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(
                [
                  ['all', t.db_bucket_tous],
                  ['a_traiter', t.db_bucket_a_traiter],
                  ['en_cours', t.db_bucket_en_cours],
                  ['en_attente', t.db_bucket_en_attente],
                  ['clotures', t.db_bucket_clotures],
                  ['rejetes', t.db_bucket_rejetes],
                ] as [AlertStatusBucket | 'all', string][]
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
                  {label} ({bucketTabCounts[bucket]})
                </button>
              ))}
            </div>
            {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau
                dossier) === ouvre désormais la vraie modale de création
                (voir plus bas) plutôt que de renvoyer vers le formulaire
                public. `onCreateNewCase` reste une prop déclarée (câblée
                par tous les appelants existants dans App.tsx) mais n'est
                plus utilisée ici — conservée pour un éventuel appelant
                futur qui préférerait rediriger plutôt qu'ouvrir la
                modale. */}
            <button
              onClick={() => setShowCreateCaseModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> {t.db_new_case_button}
            </button>
          </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wider">
                Dossiers ({visibleAlerts.length})
              </span>
              <span className="text-[11px] text-slate-500">
                {isGlobalViewer ? 'Toutes filiales' : 'Assignés'}
              </span>
            </div>

            <div className="p-4">
              <DataTable
                columns={
                  [
                    {
                      key: 'id',
                      header: 'N° Dossier',
                      render: (alert) => (
                        <span className="font-mono font-bold text-[#0B2545] flex items-center gap-1.5">
                          {alert.trackingNumber}
                          {getConfidentialityBadge(alert)}
                        </span>
                      ),
                    },
                    {
                      key: 'object',
                      header: 'Objet',
                      render: (alert) => <span className="line-clamp-1 max-w-[220px]">{alert.detailedDescription}</span>,
                      hideOnMobile: true,
                    },
                    {
                      key: 'country_entity',
                      header: 'Pays / Entité',
                      render: (alert) => (
                        <span className="flex items-center gap-1 truncate max-w-[160px]">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          {alert.concernedEntity}
                        </span>
                      ),
                      hideOnMobile: true,
                    },
                    { key: 'category', header: 'Catégorie', render: (alert) => alert.category },
                    {
                      key: 'status',
                      header: 'Statut',
                      render: (alert) => (
                        <StatusBadge
                          status={alert.status === 'corrective_action' ? 'closed' : (alert.status as any)}
                          label={t[`status_${alert.status}` as keyof typeof t] ?? alert.status}
                          size="sm"
                        />
                      ),
                    },
                    { key: 'priority', header: 'Priorité', render: (alert) => getPriorityBadge(alert) },
                    {
                      key: 'received',
                      header: 'Reçu le',
                      render: (alert) => new Date(alert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR'),
                      hideOnMobile: true,
                    },
                  ] as DataTableColumn<AlertRecord>[]
                }
                rows={pagedAlerts}
                getRowKey={(alert) => alert.id}
                onRowClick={(alert) => {
                  setSelectedAlertId(alert.id);
                  setViewMode('detail');
                  storage.logAudit(
                    'ALERT_ACCESSED',
                    `Consultation de la fiche dossier ${alert.trackingNumber} par ${activeUser.name}.`,
                    { id: alert.id, trackingNumber: alert.trackingNumber },
                    activeUser
                  );
                }}
                emptyTitle="Aucun dossier ne correspond à vos critères de filtrage."
              />
            </div>

            {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) === */}
            {visibleAlerts.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span>{visibleAlerts.length} résultats</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-300">…</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg font-bold ${
                            p === currentPage ? 'bg-[#0B2545] text-white' : 'border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
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
                  {/* === AMÉLIORATION AJOUTÉE (Visibilité de l'escalade —
                      impasse UX corrigée) === BUG PRÉEXISTANT CORRIGÉ,
                      identifié lors d'une analyse critique du frontend :
                      une fois escaladé, rien dans l'interface ne montrait
                      qu'un dossier l'était — le badge "INVESTIGATION"
                      restait affiché sans changement visible (l'escalade
                      était absorbée dans l'étape générique "En
                      investigation" de la timeline "STATUT DU DOSSIER",
                      jamais une étape à part). Ce badge n'apparaît que
                      tant que `workflowStatus` est ENCORE 'escalated'
                      (état courant, disparaît naturellement dès que le
                      dossier avance à l'étape suivante) — la carte
                      "Dossier escaladé" ci-dessous, elle, reste visible en
                      permanence comme trace historique. */}
                  {currentWorkflowStatus === 'escalated' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-rose-200 text-rose-700 bg-rose-50">
                      <ArrowUpCircle className="w-3 h-3" />
                      {t.case_escalated_badge}
                    </span>
                  )}
                  {/* === AMÉLIORATION AJOUTÉE (Classement sans suite —
                      Doublon / Hors périmètre) === Sans ce badge, un
                      dossier classé "Doublon"/"Hors périmètre" afficherait
                      seulement le badge générique "CLOSED" hérité du
                      statut legacy (syncLegacyStatus), indiscernable d'une
                      vraie clôture après investigation complète. */}
                  {(currentWorkflowStatus === 'duplicate' || currentWorkflowStatus === 'out_of_scope') && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-slate-300 text-slate-600 bg-slate-100">
                      <Ban className="w-3 h-3" />
                      {currentWorkflowStatus === 'duplicate' ? t.dismiss_reason_duplicate : t.dismiss_reason_out_of_scope}
                    </span>
                  )}
                  {/* === AMÉLIORATION AJOUTÉE (Retours visuels 3) === BUG PRÉEXISTANT
                      CORRIGÉ, signalé par l'utilisateur (capture de référence) : le
                      score de risque était affiché dans une box flottante séparée à
                      droite ; l'utilisateur demande de le supprimer et d'afficher le
                      score sur la même ligne que le statut ("INVESTIGATION"). Même
                      donnée réelle qu'avant (riskEvaluation.totalScore/16, couleur
                      via nocaColor) — seul l'emplacement change. */}
                  {(() => {
                    const score = selectedAlert.riskEvaluation.totalScore;
                    const tone = nocaColor(score);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${tone.border} ${tone.text} bg-white`}>
                        {t.case_risk_score} : {score}/16
                      </span>
                    );
                  })()}
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

                    {/* === AMÉLIORATION AJOUTÉE (Classement sans suite —
                        Doublon / Hors périmètre) === BUG PRÉEXISTANT
                        CORRIGÉ, identifié lors d'une analyse critique du
                        frontend : 'duplicate'/'out_of_scope' (CaseStatus,
                        domain/caseTypes.ts) étaient structurellement
                        atteignables depuis 'new' (ALLOWED_TRANSITIONS,
                        domain/workflow.ts) mais aucun écran ne le
                        proposait — un signalement manifestement doublon ou
                        hors périmètre devait passer par tout le circuit
                        d'investigation (allégations, mesures correctives)
                        avant de pouvoir être clôturé. Même garde que
                        "Attribuer" (cases.assign, décision d'opérateur) ;
                        réservé aux dossiers pas encore attribués (voir
                        handleDismissCase). */}
                    {userCan(activeUser, 'cases.assign') && currentWorkflowStatus === 'new' && (
                      <button
                        id="btn-desk-dismiss"
                        onClick={() => {
                          setDismissTargetStatus('duplicate');
                          setDismissReason('');
                          setShowDismissModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        <Ban className="w-3.5 h-3.5 text-slate-500" />
                        <span>{t.btn_dismiss_case}</span>
                      </button>
                    )}

                    {/* === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
                        Escalade manuelle (brief §14/§44). Gardée par
                        `cases.reassign` (comme l'attribution, l'escalade
                        change la responsabilité du dossier) — un
                        investigateur de base n'a pas cette permission, un
                        senior_investigator/functional_admin/darc_compliance
                        oui. N'apparaît que s'il existe au moins un
                        destinataire actif dans le registre d'escalade
                        admin-éditable (Gouvernance) — REMPLACE
                        `getGroupEscalationOwners`, limité à 2 rôles codés
                        en dur. */}
                    {userCan(activeUser, 'cases.reassign') && storage.getEscalationRecipients().filter((r) => r.active).length > 0 && (
                      <button
                        id="btn-desk-escalate"
                        onClick={() => {
                          setEscalateReason('');
                          setEscalateOwnerId(storage.getEscalationRecipients().filter((r) => r.active)[0]?.id ?? '');
                          setShowEscalateModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{t.btn_escalate_case}</span>
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

                    {/* === AMÉLIORATION AJOUTÉE (Branchement du moteur de
                        workflow riche) === Rend réellement franchissables
                        les étapes "En attente d'informations" et "En revue"
                        de la timeline "STATUT DU DOSSIER" (jusqu'ici
                        toujours grisées — voir domain/workflow.ts,
                        storage.transitionStatus()). Visibles pendant la
                        phase active d'investigation uniquement. */}
                    {currentWorkflowStatus === 'investigation' && (
                      <button
                        id="btn-desk-request-info"
                        onClick={() => {
                          setShowRequestInfoModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-purple-50 text-purple-700 font-semibold text-left"
                      >
                        {/* === AMÉLIORATION AJOUTÉE : `text-left` — le libellé de cet
                            item est le plus long du menu et passe seul sur 2 lignes ;
                            sans cette classe, le `text-align: center` par défaut des
                            `<button>` centrait la 2e ligne au lieu de l'aligner sous
                            la 1re comme tous les autres items du menu. */}
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.btn_request_info}</span>
                      </button>
                    )}

                    {/* === AMÉLIORATION AJOUTÉE (Rapport d'investigation
                        obligatoire avant l'envoi en revue) === Rédiger le
                        rapport est désormais un préalable réel : "Envoyer en
                        revue" ci-dessous n'apparaît que si un rapport (texte
                        et/ou fichier importé) est renseigné — jamais un
                        bouton visible mais bloqué. Libellé toujours
                        "Rédiger" : réécrire remplace le contenu précédent,
                        pas de distinction création/modification. */}
                    {currentWorkflowStatus === 'investigation' && (
                      <button
                        id="btn-desk-write-report"
                        onClick={() => {
                          setReportDraft(selectedAlert.investigationReport ?? '');
                          setReportFile(selectedAlert.investigationReportFile);
                          setShowReportModal(true);
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-teal-50 text-teal-700 font-semibold text-left"
                      >
                        <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.btn_write_report}</span>
                      </button>
                    )}

                    {currentWorkflowStatus === 'investigation' && (!!selectedAlert.investigationReport || !!selectedAlert.investigationReportFile) && (
                      <button
                        id="btn-desk-send-review"
                        onClick={() => {
                          handleSendToReview();
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-indigo-50 text-indigo-700 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t.btn_send_review}</span>
                      </button>
                    )}

                    {(currentWorkflowStatus === 'pending_information' || currentWorkflowStatus === 'conclusion_pending' || currentWorkflowStatus === 'functional_review') && (
                      <button
                        id="btn-desk-resume-investigation"
                        onClick={() => {
                          handleResumeInvestigation();
                          setShowActionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-blue-50 text-blue-700 font-semibold"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>{t.btn_resume_investigation}</span>
                      </button>
                    )}

                    {/* === AMÉLIORATION AJOUTÉE (Fix — gate Clôturer par la
                        permission cases.close) === BUG PRÉEXISTANT CORRIGÉ :
                        ce bouton était visible pour tout compte pouvant
                        simplement ouvrir la fiche dossier (cases.edit), y
                        compris un enquêteur junior (role investigator) qui
                        n'a, selon domain/permissions.ts, PAS la permission
                        cases.close (réservée à senior_investigator/
                        functional_admin/darc_compliance/system_admin(*)) —
                        même garde que le bouton Attribuer/Réattribuer
                        (`canAssign`, cases.assign) déjà réel plus haut. */}
                    {selectedAlert.status !== 'closed' && selectedAlert.status !== 'archived' && userCan(activeUser, 'cases.close') && (
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

                    {/* === AMÉLIORATION AJOUTÉE (Fix — gate Réouvrir par la
                        permission cases.reopen) === BUG PRÉEXISTANT CORRIGÉ,
                        même nature que "Clôturer le dossier" ci-dessus : ce
                        bouton était visible pour tout compte ayant
                        simplement cases.edit, y compris un enquêteur junior,
                        qui n'a PAS cases.reopen (réservée à
                        functional_admin/darc_compliance/system_admin(*)). */}
                    {selectedAlert.status === 'closed' && userCan(activeUser, 'cases.reopen') && (
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

                    {/* === AMÉLIORATION AJOUTÉE (Fix — gate Archiver par la
                        permission cases.archive) === BUG PRÉEXISTANT
                        CORRIGÉ, même nature que "Clôturer"/"Rouvrir"
                        ci-dessus : ce bouton était visible pour tout compte
                        ayant simplement cases.edit. cases.archive est une
                        nouvelle permission dédiée (domain/permissions.ts),
                        réservée aux mêmes rôles que cases.reopen
                        (functional_admin/darc_compliance) — l'archivage
                        légal (conservation 10 ans) est une action au moins
                        aussi définitive qu'une réouverture. */}
                    {selectedAlert.status === 'closed' && userCan(activeUser, 'cases.archive') && (
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

            </div>
          </div>

          {/* === AMÉLIORATION AJOUTÉE (Retours visuels — cartes d'info du
              dossier) === BUG PRÉEXISTANT CORRIGÉ, signalé par l'utilisateur
              (capture de référence) : cette ligne d'info était une simple
              rangée de texte sans carte ("matching the mockup exactly" d'un
              choix antérieur, contredit par la nouvelle capture) — reprend
              désormais le même motif carte (icône + libellé + valeur) que la
              vignette "Score de risque" juste au-dessus. Même données, même
              grille, seule la présentation change. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
                <Tag className="w-4 h-4" />
              </span>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_category}</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.category}>{selectedAlert.category}</div>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
                <Building2 className="w-4 h-4" />
              </span>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_entity}</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.concernedEntity}>{selectedAlert.concernedEntity}</div>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
                <Globe2 className="w-4 h-4" />
              </span>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_country}</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.country}>{formatCountryLabel(storage.getCountries(), selectedAlert.country)}</div>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
                <Calendar className="w-4 h-4" />
              </span>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_received}</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {new Date(selectedAlert.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')}
              </div>
            </div>
            {(() => {
              const slaStatus = computeSlaStatus(selectedAlert);
              const tone = slaStatus === 'overdue' ? 'rose' : slaStatus === 'at_risk' ? 'amber' : 'blue';
              const iconBoxClass = tone === 'rose' ? 'bg-rose-50 text-rose-600' : tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700';
              const valueClass = tone === 'rose' ? 'text-rose-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900';
              // === AMÉLIORATION AJOUTÉE (Retours visuels) === délai restant
              // réel (jamais fabriqué) : différence entre `targetCompletionDate`
              // (déjà réel) et l'instant présent, en jours pleins.
              const daysDelta = selectedAlert.targetCompletionDate
                ? Math.ceil((new Date(selectedAlert.targetCompletionDate).getTime() - Date.now()) / (24 * 3600 * 1000))
                : null;
              return (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${iconBoxClass}`}>
                    <Hourglass className="w-4 h-4" />
                  </span>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_sla_due}</div>
                  <div className={`font-bold mt-0.5 ${valueClass}`}>
                    {selectedAlert.targetCompletionDate
                      ? new Date(selectedAlert.targetCompletionDate).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR')
                      : '—'}
                  </div>
                  {daysDelta !== null && (
                    <div className={`text-[11px] font-semibold mt-0.5 ${valueClass}`}>
                      {daysDelta >= 0 ? `Dans ${daysDelta} jour${daysDelta === 1 ? '' : 's'}` : `${t.case_info_late} (${Math.abs(daysDelta)} j)`}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
                <UserCog className="w-4 h-4" />
              </span>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.case_info_investigator}</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedAlert.assignedInvestigatorNames.join(', ')}>
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
              {/* === AMÉLIORATION AJOUTÉE (Onglet Entretiens) === */}
              <button
                onClick={() => setActiveCaseTab('interviews')}
                className={`py-3 px-4 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                  activeCaseTab === 'interviews'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.nav_interviews}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                  {(selectedAlert.interviews ?? []).length}
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

            {/* === BUG PRÉEXISTANT CORRIGÉ (bouton "+ Ajouter" de l'onglet
                Preuves dédié) === Cet <input type="file"> caché n'était
                jusqu'ici rendu que dans le bloc "Vue d'ensemble" ci-dessous
                (conditionné par activeCaseTab === 'overview'), donc
                démonté dès qu'un autre onglet était actif :
                evidenceFileInputRef.current valait alors `null`, et le
                bouton "+ Ajouter" de l'onglet Preuves dédié
                (EvidenceSection.tsx) ne déclenchait rien. Remonté ici,
                en dehors du switch par onglet, pour rester toujours monté
                tant qu'un dossier est affiché en mode détail — les deux
                boutons ("Vue d'ensemble" et "Preuves") continuent de
                cliquer exactement le même <input>, comportement inchangé
                pour le premier, corrigé pour le second. */}
            <input ref={evidenceFileInputRef} type="file" className="hidden" onChange={handleAddEvidenceFile} />

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: 1. VUE
                D'ENSEMBLE — reproduit exactement les 4 blocs de la maquette
                (Description avec "Modifier", Personnes impliquées + Témoins
                avec "+ Ajouter", Preuves avec "+ Ajouter"). L'origine du
                signalement et l'investigateur assigné restent affichés,
                juste ailleurs désormais (ligne d'infos + colonne "Informations
                complémentaires" — pas de perte, seulement une relocalisation
                fidèle à la maquette). */}
            {activeCaseTab === 'overview' && (
              <OverviewSection
                selectedAlert={selectedAlert}
                lang={lang}
                t={t}
                allUsers={allUsers}
                editingDescription={editingDescription}
                setEditingDescription={setEditingDescription}
                descriptionDraft={descriptionDraft}
                setDescriptionDraft={setDescriptionDraft}
                handleSaveDescription={handleSaveDescription}
                setReportDraft={setReportDraft}
                setReportFile={setReportFile}
                setShowReportModal={setShowReportModal}
                setAddPersonKind={setAddPersonKind}
                setLinkingPerson={setLinkingPerson}
                setLinkingUserId={setLinkingUserId}
                evidenceFileInputRef={evidenceFileInputRef}
              />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === Modal partagée pour "+ Ajouter" (Personnes impliquées / Témoins) */}
            {addPersonKind && (
              <AddPersonModal
                t={t}
                allUsers={allUsers}
                addPersonKind={addPersonKind}
                setAddPersonKind={setAddPersonKind}
                handleAddPerson={handleAddPerson}
                personNameInput={personNameInput}
                setPersonNameInput={setPersonNameInput}
                personPositionInput={personPositionInput}
                setPersonPositionInput={setPersonPositionInput}
                personHierarchyInput={personHierarchyInput}
                setPersonHierarchyInput={setPersonHierarchyInput}
                personLinkedUserId={personLinkedUserId}
                setPersonLinkedUserId={setPersonLinkedUserId}
              />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 2 — routage indépendant) === Modale "Lier à un compte" pour une personne/témoin déjà enregistré·e */}
            {linkingPerson && (
              <LinkPersonModal
                allUsers={allUsers}
                linkingPerson={linkingPerson}
                setLinkingPerson={setLinkingPerson}
                handleLinkPerson={handleLinkPerson}
                linkingUserId={linkingUserId}
                setLinkingUserId={setLinkingUserId}
              />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: PERSONNES
                — vue dédiée (reprend Personnes impliquées + Témoins, avec
                "+ Ajouter", partagée avec l'onglet Vue d'ensemble). */}
            {/* === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/PersonsSection.tsx. */}
            {activeCaseTab === 'persons' && (
              <PersonsSection
                selectedAlert={selectedAlert}
                allUsers={allUsers}
                t={t}
                setAddPersonKind={setAddPersonKind}
                setLinkingPerson={setLinkingPerson}
                setLinkingUserId={setLinkingUserId}
              />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: PREUVES —
                vue dédiée (reprend Preuves & pièces jointes, avec
                "+ Ajouter"), avec les métadonnées disponibles pour chaque
                fichier (aucun champ inventé : hash/version ne sont pas
                stockés par ce modèle, donc non affichés ici).
                === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/EvidenceSection.tsx. */}
            {activeCaseTab === 'evidence_tab' && (
              <EvidenceSection selectedAlert={selectedAlert} lang={lang} t={t} evidenceFileInputRef={evidenceFileInputRef} />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 11) === TAB CONTENT: RAPPORT —
                regroupe désormais la synthèse du dossier, les notes
                d'enquête internes (contenu inchangé) et les déclarations de
                conflit d'intérêt (contenu inchangé, voir plus bas) sous un
                seul onglet "Rapport", comme dans la maquette.
                === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/ReportSection.tsx — regroupe
                aussi le second bloc `activeCaseTab === 'report'` qui
                apparaissait plus bas dans ce fichier (déclarations de
                conflit d'intérêt), les deux blocs produisant déjà un rendu
                strictement adjacent (tous les blocs intercalés entre eux
                sont mutuellement exclusifs). */}
            {activeCaseTab === 'report' && (
              <ReportSection
                selectedAlert={selectedAlert}
                lang={lang}
                t={t}
                setShowPrintReport={setShowPrintReport}
                internalNoteText={internalNoteText}
                setInternalNoteText={setInternalNoteText}
                handleAddInternalNote={handleAddInternalNote}
                setConflictOutcome={setConflictOutcome}
                setConflictDetails={setConflictDetails}
                setShowConflictModal={setShowConflictModal}
              />
            )}

            {/* TAB CONTENT: 3. COMMUNICATION WITH WHISTLEBLOWER */}
            {/* === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/MessagesSection.tsx. */}
            {activeCaseTab === 'messages' && (
              <MessagesSection
                selectedAlert={selectedAlert}
                investigatorMsgText={investigatorMsgText}
                setInvestigatorMsgText={setInvestigatorMsgText}
                handleSendInvestigatorMessage={handleSendInvestigatorMessage}
              />
            )}

            {/* TAB CONTENT: 4. CORRECTIVE MEASURES (MANDATORY BEFORE CLOSURE - CDC 3.1.2)
                === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/CorrectiveMeasuresSection.tsx. */}
            {activeCaseTab === 'corrective' && (
              <CorrectiveMeasuresSection selectedAlert={selectedAlert} t={t} setShowAddMeasureModal={setShowAddMeasureModal} />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 6) === TAB CONTENT: TASKS.
                === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/TasksSection.tsx. */}
            {activeCaseTab === 'tasks' && (
              <TasksSection
                selectedAlert={selectedAlert}
                allUsers={allUsers}
                t={t}
                setShowAddTaskModal={setShowAddTaskModal}
                handleToggleTaskStatus={handleToggleTaskStatus}
              />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Onglet Entretiens) === même gabarit
                que l'onglet Tâches ci-dessus (liste + "+Ajouter").
                === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/InterviewsSection.tsx. */}
            {activeCaseTab === 'interviews' && (
              <InterviewsSection
                selectedAlert={selectedAlert}
                lang={lang}
                t={t}
                setShowAddInterviewModal={setShowAddInterviewModal}
              />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 6) === TAB CONTENT: TIMELINE — derived from real audit_logs + messages for this case, never hand-authored. */}
            {/* === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/CaseTimelineSection.tsx. */}
            {activeCaseTab === 'timeline' && (
              <CaseTimelineSection selectedAlert={selectedAlert} lang={lang} t={t} />
            )}

            {/* === AMÉLIORATION AJOUTÉE (Phase 6 — Triage) === repurposes the
                existing NOCA risk-matrix display (AlertSubmissionFlow /
                AdminConfigView) as an editable-override screen per the
                brief's §24: shows the 4-axis score already computed at
                submission time, then reuses the existing priority-override
                modal (same button as the top toolbar's "Modifier la
                priorité / Délais") rather than a second, parallel edit
                path. */}
            {/* === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk —
                extraction par section) === contenu déplacé tel quel dans
                son propre composant, voir
                src/components/investigation/TriageSection.tsx. */}
            {activeCaseTab === 'triage' && (
              <TriageSection
                selectedAlert={selectedAlert}
                t={t}
                setShowAssignModal={setShowAssignModal}
                setNewPriority={setNewPriority}
                setPriorityOverrideReason={setPriorityOverrideReason}
                setShowPriorityModal={setShowPriorityModal}
              />
            )}

          </div>

          {/* Right column: Statut du dossier / Informations complémentaires / Liens rapides */}
          <aside className="space-y-5">
            {/* === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow
                riche) === Statut du dossier — timeline verticale, dérivée
                du statut RICHE (workflowStatus, 14 valeurs,
                domain/workflow.ts) plutôt que du seul statut legacy
                (AlertStatus, 7 valeurs) : "En attente d'informations"
                (pending_information) et "En revue" (conclusion_pending +
                functional_review, une seule étape visuelle pour les deux
                sous-étapes du moteur riche) reflètent désormais l'état réel
                du dossier, via les actions "Demander des informations
                complémentaires"/"Envoyer en revue"/"Reprendre
                l'investigation" ci-dessus. */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {t.case_status_title}
              </h3>
              {(() => {
                const isClosed = ['closed', 'archived'].includes(selectedAlert.status);
                const ws = currentWorkflowStatus;
                const isPendingInfo = ws === 'pending_information';
                const isInReview = ws === 'conclusion_pending' || ws === 'functional_review';
                // "En investigation" reste l'étape courante tant qu'aucune des
                // 2 étapes suivantes n'a été atteinte et que le dossier n'est
                // pas clos — un aller-retour (ex. reprise après "En attente
                // d'informations") y ramène naturellement l'affichage.
                const isInvestigating = !isClosed && !isPendingInfo && !isInReview
                  ? ['investigation', 'corrective_action', 'reopened'].includes(selectedAlert.status) || ws === 'investigation' || ws === 'escalated'
                  : false;
                // === AMÉLIORATION AJOUTÉE : "fait" uniquement si le dossier
                // est RÉELLEMENT passé par cette étape (pendingInfoReachedAt
                // / reviewReachedAt, horodatés une seule fois par
                // handleRequestInfo/handleSendToReview) — jamais déduit du
                // seul fait que le dossier a depuis avancé plus loin, pour
                // ne jamais cocher une étape qu'il n'a pas traversée.
                const pendingInfoDone = !!selectedAlert.pendingInfoReachedAt && (isInReview || isClosed);
                const reviewDone = !!selectedAlert.reviewReachedAt && isClosed;
                type StepState = 'done' | 'current' | 'pending';
                const steps: { label: string; state: StepState; date?: string }[] = [
                  { label: t.case_status_received, state: 'done', date: selectedAlert.createdAt },
                  {
                    label: t.case_status_investigation,
                    state: isClosed || isPendingInfo || isInReview ? 'done' : isInvestigating ? 'current' : 'pending',
                    date: isInvestigating ? selectedAlert.updatedAt : undefined,
                  },
                  {
                    label: t.case_status_pending_info,
                    state: isPendingInfo ? 'current' : pendingInfoDone ? 'done' : 'pending',
                    date: isPendingInfo ? selectedAlert.updatedAt : selectedAlert.pendingInfoReachedAt,
                  },
                  {
                    label: t.case_status_review,
                    state: isInReview ? 'current' : reviewDone ? 'done' : 'pending',
                    date: isInReview ? selectedAlert.updatedAt : selectedAlert.reviewReachedAt,
                  },
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
              {/* === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête
                  ACTIVA) === Même motif que Synthèse du dossier ci-dessus. */}
              <button
                onClick={() => setShowPrintReport(true)}
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

      {/* === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête ACTIVA) ===
          Rendu inconditionnellement caché à l'écran (`.print-only`, voir
          index.css) — ne devient visible que dans la boîte de dialogue
          d'impression du navigateur, une fois `showPrintReport` à true
          (voir le useEffect plus haut, qui appelle window.print() puis le
          réinitialise). */}
      {selectedAlert && showPrintReport && (
        <CaseReportPrintView
          alert={selectedAlert}
          generatedByName={activeUser.name}
          locale={lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR'}
        />
      )}

      {/* MODAL: ASSIGN INVESTIGATORS */}
      {showAssignModal && selectedAlert && (
        <AssignModal
          selectedAlert={selectedAlert}
          assignCandidates={assignCandidates}
          selectedInvestigatorIds={selectedInvestigatorIds}
          setSelectedInvestigatorIds={setSelectedInvestigatorIds}
          setShowAssignModal={setShowAssignModal}
          handleAssignInvestigators={handleAssignInvestigators}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 5 — évolution multi-pays/multi-entité) ===
          MODAL: ESCALADE VERS LA DARC GROUPE */}
      {showEscalateModal && selectedAlert && (
        <EscalateModal
          t={t}
          selectedAlert={selectedAlert}
          allUsers={allUsers}
          escalateOwnerId={escalateOwnerId}
          setEscalateOwnerId={setEscalateOwnerId}
          escalateReason={escalateReason}
          setEscalateReason={setEscalateReason}
          setShowEscalateModal={setShowEscalateModal}
          handleEscalate={handleEscalate}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Classement sans suite — Doublon / Hors
          périmètre) === Même gabarit que la modale d'escalade ci-dessus. */}
      {showDismissModal && selectedAlert && (
        <DismissModal
          t={t}
          selectedAlert={selectedAlert}
          dismissTargetStatus={dismissTargetStatus}
          setDismissTargetStatus={setDismissTargetStatus}
          dismissReason={dismissReason}
          setDismissReason={setDismissReason}
          setShowDismissModal={setShowDismissModal}
          handleDismissCase={handleDismissCase}
        />
      )}

      {/* MODAL: MODIFY PRIORITY & SLA */}
      {showPriorityModal && selectedAlert && (
        <PriorityModal
          newPriority={newPriority}
          setNewPriority={setNewPriority}
          newSlaDays={newSlaDays}
          setNewSlaDays={setNewSlaDays}
          priorityOverrideReason={priorityOverrideReason}
          setPriorityOverrideReason={setPriorityOverrideReason}
          setShowPriorityModal={setShowPriorityModal}
          handleUpdatePriority={handleUpdatePriority}
        />
      )}

      {/* MODAL: ADD CORRECTIVE MEASURE */}
      {showAddMeasureModal && selectedAlert && (
        <AddMeasureModal
          measureTitle={measureTitle}
          setMeasureTitle={setMeasureTitle}
          measureDesc={measureDesc}
          setMeasureDesc={setMeasureDesc}
          measureResp={measureResp}
          setMeasureResp={setMeasureResp}
          measureDueDate={measureDueDate}
          setMeasureDueDate={setMeasureDueDate}
          measureStatus={measureStatus}
          setMeasureStatus={setMeasureStatus}
          setShowAddMeasureModal={setShowAddMeasureModal}
          handleAddCorrectiveMeasure={handleAddCorrectiveMeasure}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 6) === MODAL: ADD TASK */}
      {showAddTaskModal && selectedAlert && (
        <AddTaskModal
          t={t}
          selectedAlert={selectedAlert}
          investigatorUsers={investigatorUsers}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskDescription={taskDescription}
          setTaskDescription={setTaskDescription}
          taskOwnerId={taskOwnerId}
          setTaskOwnerId={setTaskOwnerId}
          taskDueDate={taskDueDate}
          setTaskDueDate={setTaskDueDate}
          taskPriority={taskPriority}
          setTaskPriority={setTaskPriority}
          setShowAddTaskModal={setShowAddTaskModal}
          handleAddTask={handleAddTask}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Onglet Entretiens) === MODAL: "+Nouvel
          entretien" — même structure que "+Nouvelle tâche" ci-dessus. */}
      {showAddInterviewModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.btn_add_interview}</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">{selectedAlert.trackingNumber}</p>
            </div>

            <form onSubmit={handleAddInterview} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.interview_link_person_label}</label>
                <select
                  value={interviewLinkedPersonId}
                  onChange={(e) => { setInterviewLinkedPersonId(e.target.value); if (e.target.value) setInterviewIntervieweeName(''); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">—</option>
                  {[...selectedAlert.involvedPersons, ...selectedAlert.witnesses].map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {!interviewLinkedPersonId && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.interview_interviewee_label} *</label>
                  <input
                    type="text"
                    value={interviewIntervieweeName}
                    onChange={(e) => setInterviewIntervieweeName(e.target.value)}
                    placeholder={t.interview_interviewee_placeholder}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.interview_scheduled_label}</label>
                  <input
                    type="date"
                    value={interviewScheduledAt}
                    onChange={(e) => setInterviewScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.interview_status_label}</label>
                  <div className="flex gap-1.5">
                    {(['planned', 'completed', 'cancelled'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInterviewStatus(s)}
                        className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-bold border transition ${
                          interviewStatus === s ? 'bg-[#0B2545] text-white border-[#0B2545]' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        {s === 'planned' ? t.interview_status_planned : s === 'completed' ? t.interview_status_completed : t.interview_status_cancelled}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.interview_summary_label}</label>
                <textarea
                  rows={3}
                  value={interviewSummary}
                  onChange={(e) => setInterviewSummary(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddInterviewModal(false)} className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100">
                  {t.btn_cancel}
                </button>
                <button type="submit" className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  {t.btn_add_interview}
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
                Synthèse interne de clôture pour le dossier d'enquête
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
                Message officiel transmis au lanceur d'alerte
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

      {/* MODAL: REOPEN CASE (WITH MANDATORY REASON - CDC 3.1.3)
          === AMÉLIORATION AJOUTÉE (Refactor — migration vers ConfirmDialog
          partagé) === Rendu et comportement identiques à l'ancienne modale
          ad hoc (mêmes couleurs rose-600/700, même icône, même placeholder,
          même bouton désactivé tant que le motif est vide) — seule
          l'implémentation change. */}
      {selectedAlert && (
        <ConfirmDialog
          open={showReopenModal}
          title={`Rouvrir le dossier ${selectedAlert.trackingNumber}`}
          description="Règle stricte : Motif de réouverture obligatoire consigné en piste d'audit."
          confirmLabel="Valider la réouverture"
          cancelLabel="Annuler"
          tone="danger"
          icon={<RotateCcw className="w-4 h-4" />}
          titleClassName="text-rose-700"
          requireReason
          reasonLabel="Motif obligatoire de réouverture *"
          reasonPlaceholder="Précisez les nouveaux faits constatés, l'incomplétude identifiée ou la demande du Comité d'audit..."
          reason={reopenReason}
          onReasonChange={setReopenReason}
          onConfirm={handleReopenAlert}
          onCancel={() => setShowReopenModal(false)}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow riche)
          === MODAL: demander des informations complémentaires
          (investigation → pending_information, storage.transitionStatus()).
          === AMÉLIORATION AJOUTÉE (Refactor — migration vers ConfirmDialog
          partagé) === Rendu et comportement identiques à l'ancienne modale
          ad hoc (variante purple-600/700 dédiée du bouton, même icône,
          même id sur le bouton de validation). */}
      {selectedAlert && (
        <ConfirmDialog
          open={showRequestInfoModal}
          title={`${t.request_info_modal_title} — ${selectedAlert.trackingNumber}`}
          description={t.request_info_modal_desc}
          confirmLabel={t.request_info_modal_submit}
          cancelLabel="Annuler"
          icon={<HelpCircle className="w-4 h-4" />}
          titleClassName="text-purple-700"
          confirmVariant="accent"
          confirmButtonId="btn-request-info-submit"
          requireReason
          reasonLabel={t.request_info_modal_label}
          reasonPlaceholder={t.request_info_modal_placeholder}
          reason={requestInfoReason}
          onReasonChange={setRequestInfoReason}
          onConfirm={handleRequestInfo}
          onCancel={() => setShowRequestInfoModal(false)}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Rapport d'investigation obligatoire avant
          l'envoi en revue) === MODAL: rédiger le rapport d'investigation —
          même structure que la modale "Demander des informations"
          ci-dessus, couleur distincte (teal). Texte et fichier importé sont
          tous deux facultatifs pris isolément, mais au moins l'un des deux
          est requis (voir handleSaveInvestigationReport). */}
      {showReportModal && selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 text-teal-700">
                <ClipboardList className="w-4 h-4" />
                {t.report_modal_title} — {selectedAlert.trackingNumber}
              </h3>
              <p className="text-slate-500 text-[11px] mt-0.5">{t.report_modal_desc}</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.report_modal_label}</label>
              <textarea
                rows={6}
                value={reportDraft}
                onChange={(e) => setReportDraft(e.target.value)}
                placeholder={t.report_modal_placeholder}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* === AMÉLIORATION AJOUTÉE (Import d'un rapport d'investigation
                en fichier) === Même mécanisme que "Preuves & pièces
                jointes" (handleAddEvidenceFile) : lecture locale en
                dataUrl, jamais d'upload réseau fabriqué. */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t.report_modal_import_label}</label>
              {reportFile ? (
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-800 block truncate">{reportFile.name}</span>
                    <span className="text-[10px] text-slate-400">{Math.round(reportFile.size / 1024)} Ko</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReportFile(undefined)}
                    className="text-slate-400 hover:text-rose-600 shrink-0"
                    title={t.report_modal_remove_file}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => reportFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 font-semibold"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {t.report_modal_import_btn}
                </button>
              )}
              <input id="report-file-input" ref={reportFileInputRef} type="file" className="hidden" onChange={handleImportReportFile} />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                id="btn-report-submit"
                onClick={handleSaveInvestigationReport}
                disabled={!reportDraft.trim() && !reportFile}
                className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold"
              >
                {t.report_modal_submit}
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

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
          Modale courte à 3 étapes façon maquette (Informations/
          Classification/Validation) — visuels validés par l'utilisateur
          avant intégration finale. */}
      {showCreateCaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau
              dossier) === un <div>, pas un <form> : avec 2 boutons qui
              partagent la même position mais changent de `type`
              (button → submit) selon l'étape, un <form> déclenchait une
              soumission native imprévue au moment même où React réécrit
              l'attribut `type` du bouton en place (juste avant l'action
              par défaut du clic) — bug confirmé en test Playwright, corrigé
              en gérant la validation "Suivant"/"Créer" entièrement par
              handlers, sans jamais dépendre de la sémantique native d'un
              formulaire. */}
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.create_case_title}</h3>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mt-2.5">
                {([1, 2, 3] as const).map((step) => (
                  <React.Fragment key={step}>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        step === createCaseStep
                          ? 'bg-blue-600 text-white'
                          : step < createCaseStep
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {step < createCaseStep ? <Check className="w-3 h-3" /> : step}
                    </span>
                    <span className={`text-[10px] font-semibold ${step === createCaseStep ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step === 1 ? t.create_case_step_info : step === 2 ? t.create_case_step_classification : t.create_case_step_validation}
                    </span>
                    {step < 3 && <span className="flex-1 h-px bg-slate-200" />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {createCaseStep === 1 && (
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.create_case_objet} *</label>
                  <textarea
                    autoFocus
                    rows={3}
                    value={newCaseObjet}
                    onChange={(e) => setNewCaseObjet(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t.create_case_country} *</label>
                    <select
                      value={newCaseCountry}
                      onChange={(e) => {
                        setNewCaseCountry(e.target.value);
                        setNewCaseEntity('');
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      required
                    >
                      <option value="">—</option>
                      {countries.map((c) => (
                        <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{t.create_case_entity} *</label>
                    <select
                      value={newCaseEntity}
                      onChange={(e) => setNewCaseEntity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      required
                    >
                      <option value="">—</option>
                      {newCaseEntityOptions.map((en) => (
                        <option key={en.id} value={en.name}>{en.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {createCaseStep === 2 && (
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.create_case_category} *</label>
                  <select
                    value={newCaseCategory}
                    onChange={(e) => {
                      setNewCaseCategory(e.target.value);
                      setNewCaseSubCategory('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    required
                  >
                    <option value="">—</option>
                    {categoriesConfig.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.create_case_subcategory} *</label>
                  <select
                    value={newCaseSubCategory}
                    onChange={(e) => setNewCaseSubCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    disabled={!newCaseCategory}
                    required
                  >
                    <option value="">—</option>
                    {newCaseSubCategoryOptions.map((sc) => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  {t.create_case_default_risk_notice}
                </p>
              </div>
            )}

            {createCaseStep === 3 && (
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between"><span className="text-slate-500">{t.create_case_objet}</span><span className="font-semibold text-slate-900 text-right max-w-[60%] truncate">{newCaseObjet}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t.create_case_country}</span><span className="font-semibold text-slate-900">{newCaseCountry}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t.create_case_entity}</span><span className="font-semibold text-slate-900">{newCaseEntity}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t.create_case_category}</span><span className="font-semibold text-slate-900">{newCaseCategory}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{t.create_case_subcategory}</span><span className="font-semibold text-slate-900">{newCaseSubCategory}</span></div>
                  <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-slate-500">{t.create_case_default_risk_label}</span><span className="font-bold text-amber-700">NOCA 2</span></div>
                </div>
                <p className="text-[11px] text-slate-500">{t.create_case_validation_notice}</p>
              </div>
            )}

            <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (createCaseStep === 1) setShowCreateCaseModal(false);
                  else setCreateCaseStep((s) => (s - 1) as 1 | 2 | 3);
                }}
                className="px-3 py-1.5 text-slate-600 rounded-lg hover:bg-slate-100"
              >
                {createCaseStep === 1 ? t.btn_cancel : t.create_case_back}
              </button>
              {createCaseStep < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (createCaseStep === 1 && (!newCaseObjet.trim() || !newCaseCountry || !newCaseEntity)) return;
                    setCreateCaseStep((s) => (s + 1) as 1 | 2 | 3);
                  }}
                  disabled={createCaseStep === 1 && (!newCaseObjet.trim() || !newCaseCountry || !newCaseEntity)}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold"
                >
                  {t.create_case_next}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCreateCase()}
                  disabled={isCreatingCase || !newCaseCategory || !newCaseSubCategory}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold"
                >
                  {isCreatingCase ? t.create_case_creating : t.create_case_confirm}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
