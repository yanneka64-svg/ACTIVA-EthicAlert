import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Lock,
  ArrowLeft,
  // === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow riche) ===
  HelpCircle,
  // === AMÉLIORATION AJOUTÉE (nettoyage des imports morts) === `Mic` (onglet
  // Entretiens), `Search`, `Filter`, `MessageSquare`, `Send`, `FileCheck2`,
  // `CheckSquare` et `Square` retirés : plus utilisés dans ce fichier depuis
  // l'extraction de leurs blocs dans ./investigation/.
} from 'lucide-react';
import {
  Language,
  AlertRecord,
  UserProfile,
  AlertStatus,
  CaseTask,
  EvidenceFile,
} from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { storage } from '../services/storage';
// === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
// section) === premier contenu d'onglet extrait dans son propre composant,
// voir src/components/investigation/CaseTimelineSection.tsx.
import { CaseTimelineSection } from './investigation/CaseTimelineSection';
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
import { CaseListView } from './investigation/CaseListView';
import { CaseDetailHeader } from './investigation/CaseDetailHeader';
import { CaseTabBar } from './investigation/CaseTabBar';
import { CaseDetailSidebar } from './investigation/CaseDetailSidebar';
import { AddInterviewModal } from './investigation/AddInterviewModal';
import { CloseModal } from './investigation/CloseModal';
import { ReportModal } from './investigation/ReportModal';
import { ConflictModal } from './investigation/ConflictModal';
import { CreateCaseModal } from './investigation/CreateCaseModal';
import { ConfirmDialog } from './ui';
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
// === AMÉLIORATION AJOUTÉE (Repère visuel — Liste des dossiers) === même
// regroupement en 5 paniers que le Tableau de bord (Phase 1), pour que les
// onglets de filtre affichent exactement les mêmes catégories.
import { AlertStatusBucket, getAlertStatusBucket, isRejectedBucket } from '../domain/alertStatusBuckets';
// === AMÉLIORATION AJOUTÉE (nettoyage des imports morts) === `trData`
// (traduction des données par défaut à l'affichage) et `PersonRow` ne sont
// plus importés ici : seuls les sous-composants de ./investigation/ qui les
// utilisent les importent désormais.
// === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par section) ===
// Formulaires d'ajout (état + gestionnaire) déplacés dans des hooks dédiés.
// Les types (CorrectiveMeasure, TaskPriority, ConflictDeclaration,
// InvolvedPerson, Witness, CaseInterview) et `computeRiskEvaluation`/
// `generateSalt`/`hashPassword`/`generateAccessPassword` (mêmes fonctions
// réelles que le formulaire public, jamais réimplémentées) ne sont plus
// utilisés que dans ces hooks, qui les importent eux-mêmes.
import { useCorrectiveMeasureForm } from './investigation/hooks/useCorrectiveMeasureForm';
import { useTaskForm } from './investigation/hooks/useTaskForm';
import { useInterviewForm } from './investigation/hooks/useInterviewForm';
import { useConflictForm } from './investigation/hooks/useConflictForm';
import { usePersonForms } from './investigation/hooks/usePersonForms';
import { useCreateCaseForm } from './investigation/hooks/useCreateCaseForm';
// === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par section) ===
// Modales d'action du dossier déplacées dans des hooks dédiés. Les types
// PriorityLevel/InternalNote/CaseMessage, `notifyAssignmentToInvestigators`/
// `notifyEscalationRecipient` (notifications e-mail) et
// `evaluateEscalationCriteria` ne sont plus utilisés que dans ces hooks, qui
// les importent eux-mêmes.
import { useAssignForm } from './investigation/hooks/useAssignForm';
import { usePriorityForm } from './investigation/hooks/usePriorityForm';
import { useCloseForm } from './investigation/hooks/useCloseForm';
import { useReopenForm } from './investigation/hooks/useReopenForm';
import { useRequestInfoForm } from './investigation/hooks/useRequestInfoForm';
import { useInvestigationReportForm } from './investigation/hooks/useInvestigationReportForm';
import { useEscalateForm } from './investigation/hooks/useEscalateForm';
import { useDismissForm } from './investigation/hooks/useDismissForm';
import { useCaseMessaging } from './investigation/hooks/useCaseMessaging';

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

  

  // === AMÉLIORATION AJOUTÉE (rapports PDF réels avec en-tête ACTIVA) ===
  // Dès que `showPrintReport` passe à true, CaseReportPrintView.tsx (rendu
  // plus bas, cf. `.print-only` dans index.css) devient le SEUL contenu
  // visible dans la boîte de dialogue d'impression du navigateur — jamais
  // toute la page comme auparavant (BUG PRÉEXISTANT CORRIGÉ, signalé par
  // l'utilisateur). Un seul modèle désormais (synthèse), sur demande
  // explicite — plus besoin du menu de choix entre plusieurs modèles.
  const [showPrintReport, setShowPrintReport] = useState(false);

  // === AMÉLIORATION AJOUTÉE (Phase 11 — actions "Modifier"/"+ Ajouter" de
  // l'onglet Vue d'ensemble, telles que montrées dans la maquette) ===
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
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
  // === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
  const countries = storage.getCountries();
  const categoriesConfig = storage.getCategories();
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

  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par section) ===
  // État + gestionnaire de chaque formulaire d'ajout déplacés tels quels dans
  // ./investigation/hooks/ (voir l'en-tête de chaque fichier) ; mêmes noms
  // déstructurés ici, donc JSX et props des modales/sections inchangés.
  // Appelés après `selectedAlert`, dont leurs gestionnaires ont besoin.
  const {
    showAddMeasureModal,
    setShowAddMeasureModal,
    measureTitle,
    setMeasureTitle,
    measureDesc,
    setMeasureDesc,
    measureResp,
    setMeasureResp,
    measureDueDate,
    setMeasureDueDate,
    measureStatus,
    setMeasureStatus,
    handleAddCorrectiveMeasure,
  } = useCorrectiveMeasureForm(selectedAlert, activeUser);
  const {
    showAddTaskModal,
    setShowAddTaskModal,
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
    handleAddTask,
  } = useTaskForm(selectedAlert, activeUser);
  const {
    showAddInterviewModal,
    setShowAddInterviewModal,
    interviewIntervieweeName,
    setInterviewIntervieweeName,
    interviewLinkedPersonId,
    setInterviewLinkedPersonId,
    interviewScheduledAt,
    setInterviewScheduledAt,
    interviewSummary,
    setInterviewSummary,
    interviewStatus,
    setInterviewStatus,
    handleAddInterview,
  } = useInterviewForm(selectedAlert, activeUser);
  const {
    showConflictModal,
    setShowConflictModal,
    conflictOutcome,
    setConflictOutcome,
    conflictDetails,
    setConflictDetails,
    handleDeclareConflict,
  } = useConflictForm(selectedAlert, activeUser);
  const {
    addPersonKind,
    setAddPersonKind,
    personNameInput,
    setPersonNameInput,
    personPositionInput,
    setPersonPositionInput,
    personHierarchyInput,
    setPersonHierarchyInput,
    personLinkedUserId,
    setPersonLinkedUserId,
    linkingPerson,
    setLinkingPerson,
    linkingUserId,
    setLinkingUserId,
    handleAddPerson,
    handleLinkPerson,
  } = usePersonForms(selectedAlert, activeUser);
  const {
    showCreateCaseModal,
    setShowCreateCaseModal,
    createCaseStep,
    setCreateCaseStep,
    newCaseObjet,
    setNewCaseObjet,
    newCaseCountry,
    setNewCaseCountry,
    newCaseEntity,
    setNewCaseEntity,
    newCaseCategory,
    setNewCaseCategory,
    newCaseSubCategory,
    setNewCaseSubCategory,
    isCreatingCase,
    handleCreateCase,
  } = useCreateCaseForm(activeUser, t, setSelectedAlertId, setViewMode);
  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par section) ===
  // Modales d'action du dossier (attribution, priorité, clôture, réouverture,
  // demande d'infos, rapport, escalade, classement) et saisie note/message :
  // état + gestionnaire déplacés tels quels dans ./investigation/hooks/.
  // Les actions sans état propre (reprendre, envoyer en revue, archiver…)
  // restent ci-dessous.
  const {
    showAssignModal,
    setShowAssignModal,
    selectedInvestigatorIds,
    setSelectedInvestigatorIds,
    handleAssignInvestigators,
  } = useAssignForm(selectedAlert, activeUser, investigatorUsers);
  const {
    showPriorityModal,
    setShowPriorityModal,
    newPriority,
    setNewPriority,
    newSlaDays,
    setNewSlaDays,
    priorityOverrideReason,
    setPriorityOverrideReason,
    handleUpdatePriority,
  } = usePriorityForm(selectedAlert, activeUser);
  const {
    showCloseModal,
    setShowCloseModal,
    closureSummary,
    setClosureSummary,
    closureMessageToWb,
    setClosureMessageToWb,
    handleCloseAlert,
  } = useCloseForm(selectedAlert, activeUser, t, setActiveCaseTab);
  const {
    showReopenModal,
    setShowReopenModal,
    reopenReason,
    setReopenReason,
    handleReopenAlert,
  } = useReopenForm(selectedAlert, activeUser);
  const {
    showRequestInfoModal,
    setShowRequestInfoModal,
    requestInfoReason,
    setRequestInfoReason,
    handleRequestInfo,
  } = useRequestInfoForm(selectedAlert, activeUser);
  const {
    showReportModal,
    setShowReportModal,
    reportDraft,
    setReportDraft,
    reportFile,
    setReportFile,
    reportFileInputRef,
    handleSaveInvestigationReport,
    handleImportReportFile,
  } = useInvestigationReportForm(selectedAlert, activeUser);
  const {
    showEscalateModal,
    setShowEscalateModal,
    escalateReason,
    setEscalateReason,
    escalateOwnerId,
    setEscalateOwnerId,
    handleEscalate,
  } = useEscalateForm(selectedAlert, activeUser);
  const {
    showDismissModal,
    setShowDismissModal,
    dismissTargetStatus,
    setDismissTargetStatus,
    dismissReason,
    setDismissReason,
    handleDismissCase,
  } = useDismissForm(selectedAlert, activeUser);
  const {
    internalNoteText,
    setInternalNoteText,
    investigatorMsgText,
    setInvestigatorMsgText,
    handleAddInternalNote,
    handleSendInvestigatorMessage,
  } = useCaseMessaging(selectedAlert, activeUser);

  const handleToggleTaskStatus = (task: CaseTask) => {
    if (!selectedAlert) return;
    const nextStatus: CaseTask['status'] = task.status === 'completed' ? 'not_started' : 'completed';
    storage.updateTask(selectedAlert.id, task.id, {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined,
    }, activeUser);
  };

  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
  // section) === `taskEffectiveStatus` déplacée telle quelle dans
  // src/components/investigation/TasksSection.tsx (importé ci-dessus),
  // son seul appelant.

  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
  // section) === `RISK_AXIS_LABELS` déplacée telle quelle dans
  // src/components/investigation/TriageSection.tsx, son seul appelant.

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

  // === AMÉLIORATION AJOUTÉE (Branchement du moteur de workflow riche) ===
  // Statut riche courant (14 valeurs) — `workflowStatus` s'il a déjà été
  // renseigné par une de ces actions, sinon dérivé du statut legacy
  // (`deriveCaseStatus`, déjà utilisé par storage.transitionStatus()
  // lui-même) pour qu'un dossier jamais touché par ce nouveau chemin
  // affiche des actions cohérentes dès le premier clic.
  const currentWorkflowStatus = selectedAlert ? selectedAlert.workflowStatus ?? deriveCaseStatus(selectedAlert) : undefined;

  // "Reprendre l'investigation" — depuis pending_information, conclusion_pending
  // ou functional_review, toutes structurellement valides vers investigation
  // (domain/workflow.ts, ALLOWED_TRANSITIONS).
  const handleResumeInvestigation = () => {
    if (!selectedAlert) return;
    storage.transitionStatus(selectedAlert.id, 'investigation', activeUser);
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

  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
  // section) === `getPriorityBadge` déplacée telle quelle dans
  // src/components/investigation/getPriorityBadge.tsx, désormais importée
  // directement par CaseDetailHeader.tsx/CaseListView.tsx/TriageSection.tsx
  // (plus aucun appel direct depuis ce fichier).

  // === AMÉLIORATION AJOUTÉE (Refactor InvestigationDesk — extraction par
  // section) === `getConfidentialityBadge` déplacée telle quelle dans
  // src/components/investigation/CaseListView.tsx (seule appelante).

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
      {viewMode === 'list' && (
        <CaseListView
          t={t}
          lang={lang}
          activeUser={activeUser}
          hideTopBanner={hideTopBanner}
          simplifiedFilters={simplifiedFilters}
          hideStatusTabsBar={hideStatusTabsBar}
          hasConfidentialRoutingExclusion={hasConfidentialRoutingExclusion}
          alerts={alerts}
          isGlobalViewer={isGlobalViewer}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          entityFilter={entityFilter}
          setEntityFilter={setEntityFilter}
          entities={entities}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          nocaFilter={nocaFilter}
          setNocaFilter={setNocaFilter}
          unassignedOnlyFilter={unassignedOnlyFilter}
          setUnassignedOnlyFilter={setUnassignedOnlyFilter}
          overdueOnlyFilter={overdueOnlyFilter}
          setOverdueOnlyFilter={setOverdueOnlyFilter}
          bucketFilter={bucketFilter}
          setBucketFilter={setBucketFilter}
          bucketTabCounts={bucketTabCounts}
          setShowCreateCaseModal={setShowCreateCaseModal}
          visibleAlerts={visibleAlerts}
          pagedAlerts={pagedAlerts}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          setSelectedAlertId={setSelectedAlertId}
          setViewMode={setViewMode}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 6 — routage indépendant) ===
          Bandeau neutre : jamais de nombre, jamais de nom, jamais de motif —
          uniquement une mention générique de l'existence du mécanisme, pour
          ne révéler à aucun utilisateur exclu qu'un dossier précis le
          concerne. Visible quel que soit viewMode (liste ou détail) ;
          l'occurrence pour le mode liste est désormais dans
          CaseListView.tsx (voir ci-dessus) — celle-ci ne couvre plus que le
          mode détail. */}
      {viewMode === 'detail' && hasConfidentialRoutingExclusion && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{t.desk_confidential_routing_note}</span>
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
          <CaseDetailHeader
            t={t}
            lang={lang}
            activeUser={activeUser}
            selectedAlert={selectedAlert}
            currentWorkflowStatus={currentWorkflowStatus}
            setViewMode={setViewMode}
            showActionsMenu={showActionsMenu}
            setShowActionsMenu={setShowActionsMenu}
            setSelectedInvestigatorIds={setSelectedInvestigatorIds}
            setShowAssignModal={setShowAssignModal}
            setDismissTargetStatus={setDismissTargetStatus}
            setDismissReason={setDismissReason}
            setShowDismissModal={setShowDismissModal}
            setEscalateReason={setEscalateReason}
            setEscalateOwnerId={setEscalateOwnerId}
            setShowEscalateModal={setShowEscalateModal}
            setNewPriority={setNewPriority}
            setShowPriorityModal={setShowPriorityModal}
            setShowRequestInfoModal={setShowRequestInfoModal}
            setReportDraft={setReportDraft}
            setReportFile={setReportFile}
            setShowReportModal={setShowReportModal}
            handleSendToReview={handleSendToReview}
            handleResumeInvestigation={handleResumeInvestigation}
            setShowCloseModal={setShowCloseModal}
            setShowReopenModal={setShowReopenModal}
            handleArchiveAlert={handleArchiveAlert}
          />

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
            <CaseTabBar
              t={t}
              selectedAlert={selectedAlert}
              activeCaseTab={activeCaseTab}
              setActiveCaseTab={setActiveCaseTab}
            />

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
          <CaseDetailSidebar
            t={t}
            lang={lang}
            selectedAlert={selectedAlert}
            currentWorkflowStatus={currentWorkflowStatus}
            setActiveCaseTab={setActiveCaseTab}
            setShowPrintReport={setShowPrintReport}
          />
          </div>
        </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400 text-xs space-y-3">
            <p>{t.desk_no_match}</p>
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
        <AddInterviewModal
          t={t}
          selectedAlert={selectedAlert}
          interviewLinkedPersonId={interviewLinkedPersonId}
          setInterviewLinkedPersonId={setInterviewLinkedPersonId}
          interviewIntervieweeName={interviewIntervieweeName}
          setInterviewIntervieweeName={setInterviewIntervieweeName}
          interviewScheduledAt={interviewScheduledAt}
          setInterviewScheduledAt={setInterviewScheduledAt}
          interviewStatus={interviewStatus}
          setInterviewStatus={setInterviewStatus}
          interviewSummary={interviewSummary}
          setInterviewSummary={setInterviewSummary}
          setShowAddInterviewModal={setShowAddInterviewModal}
          handleAddInterview={handleAddInterview}
        />
      )}

      {/* MODAL: CLOSE CASE */}
      {showCloseModal && selectedAlert && (
        <CloseModal
          t={t}
          selectedAlert={selectedAlert}
          closureSummary={closureSummary}
          setClosureSummary={setClosureSummary}
          closureMessageToWb={closureMessageToWb}
          setClosureMessageToWb={setClosureMessageToWb}
          setShowCloseModal={setShowCloseModal}
          setActiveCaseTab={setActiveCaseTab}
          handleCloseAlert={handleCloseAlert}
        />
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
          title={t.desk_reopen_title.replace('{tracking}', selectedAlert.trackingNumber)}
          description={t.desk_reopen_desc}
          confirmLabel={t.desk_reopen_confirm}
          cancelLabel={t.btn_cancel}
          tone="danger"
          icon={<RotateCcw className="w-4 h-4" />}
          titleClassName="text-rose-700"
          requireReason
          reasonLabel={t.desk_reopen_reason_label}
          reasonPlaceholder={t.desk_reopen_reason_ph}
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
          cancelLabel={t.btn_cancel}
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
        <ReportModal
          t={t}
          selectedAlert={selectedAlert}
          reportDraft={reportDraft}
          setReportDraft={setReportDraft}
          reportFile={reportFile}
          setReportFile={setReportFile}
          reportFileInputRef={reportFileInputRef}
          setShowReportModal={setShowReportModal}
          handleImportReportFile={handleImportReportFile}
          handleSaveInvestigationReport={handleSaveInvestigationReport}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Phase 6) === MODAL: DECLARE CONFLICT OF INTEREST */}
      {showConflictModal && selectedAlert && (
        <ConflictModal
          t={t}
          selectedAlert={selectedAlert}
          activeUser={activeUser}
          conflictOutcome={conflictOutcome}
          setConflictOutcome={setConflictOutcome}
          conflictDetails={conflictDetails}
          setConflictDetails={setConflictDetails}
          setShowConflictModal={setShowConflictModal}
          handleDeclareConflict={handleDeclareConflict}
        />
      )}

      {/* === AMÉLIORATION AJOUTÉE (Repère visuel — Créer un nouveau dossier) ===
          Modale courte à 3 étapes façon maquette (Informations/
          Classification/Validation) — visuels validés par l'utilisateur
          avant intégration finale. */}
      {showCreateCaseModal && (
        <CreateCaseModal
          t={t}
          lang={lang}
          entities={entities}
          countries={countries}
          categoriesConfig={categoriesConfig}
          createCaseStep={createCaseStep}
          setCreateCaseStep={setCreateCaseStep}
          newCaseObjet={newCaseObjet}
          setNewCaseObjet={setNewCaseObjet}
          newCaseCountry={newCaseCountry}
          setNewCaseCountry={setNewCaseCountry}
          newCaseEntity={newCaseEntity}
          setNewCaseEntity={setNewCaseEntity}
          newCaseCategory={newCaseCategory}
          setNewCaseCategory={setNewCaseCategory}
          newCaseSubCategory={newCaseSubCategory}
          setNewCaseSubCategory={setNewCaseSubCategory}
          isCreatingCase={isCreatingCase}
          setShowCreateCaseModal={setShowCreateCaseModal}
          handleCreateCase={handleCreateCase}
        />
      )}
    </div>
  );
};
